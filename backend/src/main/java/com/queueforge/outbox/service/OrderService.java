package com.queueforge.outbox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.metrics.QueueForgeMetrics;
import com.queueforge.outbox.domain.OrderEntity;
import com.queueforge.outbox.domain.OutboxEventEntity;
import com.queueforge.outbox.dto.CreateOrderRequest;
import com.queueforge.outbox.dto.OrderResponse;
import com.queueforge.outbox.repository.OrderRepository;
import com.queueforge.outbox.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Handles order creation with transactional outbox guarantees.
 * The order row and outbox event row are written in the EXACT SAME database transaction.
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;
    private final QueueForgeMetrics metrics;

    public OrderService(OrderRepository orderRepository,
                        OutboxEventRepository outboxEventRepository,
                        ObjectMapper objectMapper,
                        QueueForgeMetrics metrics) {
        this.orderRepository = orderRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
    }

    /**
     * Atomically creates an order and its corresponding outbox event in ONE PostgreSQL transaction.
     * If this method throws or rolls back, neither the order nor the outbox event is persisted.
     */
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        return createOrder(request, false);
    }

    /**
     * Overload with simulation flag to test transaction rollback.
     */
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request, boolean simulatePreCommitFailure) {
        // 1. Persist Order entity
        OrderEntity order = new OrderEntity(
                request.orderNumber().trim(),
                request.customerId().trim(),
                request.amountCents(),
                request.currency().trim().toUpperCase()
        );
        OrderEntity savedOrder = orderRepository.save(order);

        // 2. Build Outbox Event with durable idempotency key and fingerprint
        String idempotencyKey = "order-payment-" + savedOrder.getId();
        String fingerprint = PaymentReceiverService.computeFingerprint(
                savedOrder.getId(),
                savedOrder.getCustomerId(),
                savedOrder.getAmountCents(),
                savedOrder.getCurrency()
        );

        Map<String, Object> payloadMap = Map.of(
                "orderId", savedOrder.getId().toString(),
                "orderNumber", savedOrder.getOrderNumber(),
                "customerId", savedOrder.getCustomerId(),
                "amountCents", savedOrder.getAmountCents(),
                "currency", savedOrder.getCurrency(),
                "idempotencyKey", idempotencyKey,
                "fingerprint", fingerprint
        );
        JsonNode payloadJson = objectMapper.valueToTree(payloadMap);

        OutboxEventEntity outboxEvent = new OutboxEventEntity(
                "ORDER",
                savedOrder.getId().toString(),
                "ORDER_PAYMENT_REQUESTED",
                idempotencyKey,
                payloadJson,
                fingerprint,
                5 // maxRetries
        );

        outboxEventRepository.save(outboxEvent);

        if (simulatePreCommitFailure) {
            log.warn("Simulating pre-commit failure in order creation transaction for orderNumber={}", request.orderNumber());
            throw new SimulatedTransactionRollbackException("Simulated failure before transaction commit");
        }

        log.info("Atomically created order id={} (number={}) and outbox event id={} in single transaction",
                savedOrder.getId(), savedOrder.getOrderNumber(), outboxEvent.getId());

        metrics.incrementOutboxCreated("ORDER_PAYMENT_REQUESTED");

        return toResponse(savedOrder);
    }

    @Transactional(readOnly = true)
    public Optional<OrderResponse> getOrder(UUID id) {
        return orderRepository.findById(id).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<OrderResponse> getOrderByNumber(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber).map(this::toResponse);
    }

    private OrderResponse toResponse(OrderEntity order) {
        return new OrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getCustomerId(),
                order.getAmountCents(),
                order.getCurrency(),
                order.getStatus().name(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }

    public static class SimulatedTransactionRollbackException extends RuntimeException {
        public SimulatedTransactionRollbackException(String message) {
            super(message);
        }
    }
}
