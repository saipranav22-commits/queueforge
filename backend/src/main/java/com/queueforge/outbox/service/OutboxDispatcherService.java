package com.queueforge.outbox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.common.exception.IdempotencyConflictException;
import com.queueforge.metrics.QueueForgeMetrics;
import com.queueforge.outbox.client.PaymentClient;
import com.queueforge.outbox.domain.OrderStatus;
import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import com.queueforge.outbox.repository.OrderRepository;
import com.queueforge.service.retry.BackoffCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Transactional Outbox Event Dispatcher.
 * Claims pending outbox events using PostgreSQL SELECT FOR UPDATE SKIP LOCKED.
 * Dispatches events to the receiver, handles transient/permanent errors, applies backoff,
 * routes to DEAD_LETTER on retry exhaustion, and only marks DELIVERED after acknowledged acceptance.
 */
@Service
public class OutboxDispatcherService {

    private static final Logger log = LoggerFactory.getLogger(OutboxDispatcherService.class);

    private final JdbcTemplate jdbcTemplate;
    private final PaymentClient paymentClient;
    private final OrderRepository orderRepository;
    private final BackoffCalculator backoffCalculator;
    private final QueueForgeMetrics metrics;
    private final ObjectMapper objectMapper;

    // Dispatcher instance identity
    private final String dispatcherId = "outbox-disp-" + UUID.randomUUID().toString().substring(0, 8);

    // Test fault-injection controls
    private final AtomicBoolean simulateCrashAfterClaim = new AtomicBoolean(false);

    public record ClaimedOutboxEvent(
            UUID id,
            String aggregateType,
            String aggregateId,
            String eventType,
            String idempotencyKey,
            JsonNode payload,
            String payloadFingerprint,
            int attemptCount,
            int maxRetries,
            UUID claimToken
    ) {}

    private final RowMapper<ClaimedOutboxEvent> rowMapper;

    public OutboxDispatcherService(JdbcTemplate jdbcTemplate,
                                  PaymentClient paymentClient,
                                  OrderRepository orderRepository,
                                  BackoffCalculator backoffCalculator,
                                  QueueForgeMetrics metrics,
                                  ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.paymentClient = paymentClient;
        this.orderRepository = orderRepository;
        this.backoffCalculator = backoffCalculator;
        this.metrics = metrics;
        this.objectMapper = objectMapper;

        this.rowMapper = (rs, rowNum) -> {
            try {
                UUID id = rs.getObject("id", UUID.class);
                String aggType = rs.getString("aggregate_type");
                String aggId = rs.getString("aggregate_id");
                String eventType = rs.getString("event_type");
                String idempotencyKey = rs.getString("idempotency_key");
                String payloadStr = rs.getString("payload");
                JsonNode payload = objectMapper.readTree(payloadStr);
                String fingerprint = rs.getString("payload_fingerprint");
                int attemptCount = rs.getInt("attempt_count");
                int maxRetries = rs.getInt("max_retries");
                UUID claimToken = rs.getObject("claim_token", UUID.class);

                return new ClaimedOutboxEvent(id, aggType, aggId, eventType, idempotencyKey,
                        payload, fingerprint, attemptCount, maxRetries, claimToken);
            } catch (Exception e) {
                throw new RuntimeException("Failed to map claimed outbox event", e);
            }
        };
    }

    /**
     * Atomically claims a batch of pending or expired-lease outbox events using SKIP LOCKED.
     */
    @Transactional
    public List<ClaimedOutboxEvent> claimEvents(int batchSize, int leaseDurationSeconds, String workerId) {
        if (batchSize <= 0) {
            return Collections.emptyList();
        }

        String sql = """
            UPDATE outbox_events
            SET status = 'DISPATCHING',
                claimed_by = ?,
                claim_token = gen_random_uuid(),
                claim_expires_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                attempt_count = attempt_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (
                SELECT id
                FROM outbox_events
                WHERE (status = 'PENDING' OR (status = 'DISPATCHING' AND claim_expires_at <= CURRENT_TIMESTAMP))
                  AND next_retry_at <= CURRENT_TIMESTAMP
                ORDER BY next_retry_at ASC, created_at ASC
                LIMIT ?
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, aggregate_type, aggregate_id, event_type, idempotency_key,
                      payload::text, payload_fingerprint, attempt_count, max_retries, claim_token
            """;

        return jdbcTemplate.query(sql, rowMapper, workerId, leaseDurationSeconds, batchSize);
    }

    /**
     * Claims and dispatches pending outbox events. Returns count of successfully dispatched events.
     */
    public int dispatchPendingEvents(int batchSize, int leaseDurationSeconds) {
        List<ClaimedOutboxEvent> claimed = claimEvents(batchSize, leaseDurationSeconds, dispatcherId);
        if (claimed.isEmpty()) {
            return 0;
        }

        log.info("[{}] Claimed {} outbox events for dispatch (leaseDuration={}s)",
                dispatcherId, claimed.size(), leaseDurationSeconds);

        if (simulateCrashAfterClaim.get()) {
            log.warn("[{}] FAULT INJECTED: Dispatcher crashed immediately after claiming {} events! Abandoning in DISPATCHING state.",
                    dispatcherId, claimed.size());
            throw new SimulatedDispatcherCrashException("Simulated dispatcher crash after claiming outbox events");
        }

        int deliveredCount = 0;
        for (ClaimedOutboxEvent event : claimed) {
            boolean success = dispatchSingleEvent(event);
            if (success) {
                deliveredCount++;
            }
        }
        return deliveredCount;
    }

    /**
     * Dispatches a single claimed event to the external receiver.
     */
    public boolean dispatchSingleEvent(ClaimedOutboxEvent event) {
        long startTime = System.currentTimeMillis();
        metrics.incrementOutboxAttempt(event.eventType());

        try {
            JsonNode payload = event.payload();
            UUID orderId = UUID.fromString(payload.path("orderId").asText());
            String customerId = payload.path("customerId").asText();
            long amountCents = payload.path("amountCents").asLong();
            String currency = payload.path("currency").asText();

            PaymentChargeRequest chargeRequest = new PaymentChargeRequest(
                    orderId,
                    customerId,
                    amountCents,
                    currency,
                    event.idempotencyKey(),
                    event.payloadFingerprint()
            );

            log.info("[{}] Dispatching event id={} key='{}' to payment receiver (attempt={})",
                    dispatcherId, event.id(), event.idempotencyKey(), event.attemptCount());

            // Synchronous call to consumer consistency boundary
            PaymentChargeResponse response = paymentClient.charge(chargeRequest);

            // Acknowledged acceptance: mark event DELIVERED
            boolean completed = markDelivered(event.id(), event.claimToken(), event.aggregateType(), event.aggregateId());
            if (completed) {
                long durationMs = System.currentTimeMillis() - startTime;
                metrics.incrementOutboxDelivered(event.eventType());
                metrics.recordOutboxDeliveryDuration(event.eventType(), Duration.ofMillis(durationMs));
                log.info("[{}] Successfully delivered outbox event id={} in {}ms (replay={})",
                        dispatcherId, event.id(), durationMs, response.idempotentReplay());
                return true;
            } else {
                log.warn("[{}] Failed to mark event id={} as DELIVERED: Fenced out by token mismatch or expired lease.",
                        dispatcherId, event.id());
                return false;
            }
        } catch (IdempotencyConflictException e) {
            // Permanent failure: conflicting payload submitted with same key
            log.error("[{}] Permanent idempotency conflict for event id={}: {}", dispatcherId, event.id(), e.getMessage());
            markDeadLetter(event.id(), event.claimToken(), e.getMessage());
            metrics.incrementOutboxDeadLetter(event.eventType());
            return false;
        } catch (Exception e) {
            // Transient or unexpected failure: schedule retry with backoff or route to DLQ
            log.warn("[{}] Error delivering outbox event id={} (attempt={}/{}): {}",
                    dispatcherId, event.id(), event.attemptCount(), event.maxRetries(), e.getMessage());

            if (event.attemptCount() >= event.maxRetries()) {
                String errorMsg = "Exhausted retries (" + event.attemptCount() + "/" + event.maxRetries() + "): " + e.getMessage();
                markDeadLetter(event.id(), event.claimToken(), errorMsg);
                metrics.incrementOutboxDeadLetter(event.eventType());
            } else {
                int delaySeconds = backoffCalculator.calculateBackoffSeconds(event.attemptCount());
                rescheduleRetry(event.id(), event.claimToken(), delaySeconds, e.getMessage());
                metrics.incrementOutboxFailed(event.eventType(), "TRANSIENT_ERROR");
            }
            return false;
        }
    }

    /**
     * Marks an outbox event as DELIVERED and updates aggregate business state.
     */
    @Transactional
    public boolean markDelivered(UUID eventId, UUID claimToken, String aggregateType, String aggregateId) {
        String updateEventSql = """
            UPDATE outbox_events
            SET status = 'DELIVERED',
                delivered_at = CURRENT_TIMESTAMP,
                claimed_by = NULL,
                claim_token = NULL,
                claim_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND claim_token = ?
            """;

        int rows = jdbcTemplate.update(updateEventSql, eventId, claimToken);
        if (rows > 0) {
            // Update Order aggregate status to PAID
            if ("ORDER".equalsIgnoreCase(aggregateType)) {
                try {
                    UUID orderId = UUID.fromString(aggregateId);
                    orderRepository.findById(orderId).ifPresent(order -> {
                        order.setStatus(OrderStatus.PAID);
                        orderRepository.save(order);
                        log.info("Transitioned Order id={} to PAID after outbox delivery", orderId);
                    });
                } catch (Exception ex) {
                    log.error("Failed to update Order status after outbox delivery for aggregateId={}", aggregateId, ex);
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Reschedules an outbox event for retry after exponential backoff with jitter.
     */
    @Transactional
    public void rescheduleRetry(UUID eventId, UUID claimToken, int delaySeconds, String errorMessage) {
        String sql = """
            UPDATE outbox_events
            SET status = 'PENDING',
                claimed_by = NULL,
                claim_token = NULL,
                claim_expires_at = NULL,
                next_retry_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                last_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND claim_token = ?
            """;
        jdbcTemplate.update(sql, delaySeconds, errorMessage, eventId, claimToken);
        log.info("Rescheduled outbox event id={} for retry in {} seconds", eventId, delaySeconds);
    }

    /**
     * Marks an outbox event as DEAD_LETTER when retries are exhausted or on permanent business conflict.
     */
    @Transactional
    public void markDeadLetter(UUID eventId, UUID claimToken, String errorMessage) {
        String sql = """
            UPDATE outbox_events
            SET status = 'DEAD_LETTER',
                claimed_by = NULL,
                claim_token = NULL,
                claim_expires_at = NULL,
                last_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND claim_token = ?
            """;
        jdbcTemplate.update(sql, errorMessage, eventId, claimToken);
        log.error("Moved outbox event id={} to DEAD_LETTER: {}", eventId, errorMessage);
    }

    public void setSimulateCrashAfterClaim(boolean simulate) {
        this.simulateCrashAfterClaim.set(simulate);
    }

    public static class SimulatedDispatcherCrashException extends RuntimeException {
        public SimulatedDispatcherCrashException(String message) {
            super(message);
        }
    }
}
