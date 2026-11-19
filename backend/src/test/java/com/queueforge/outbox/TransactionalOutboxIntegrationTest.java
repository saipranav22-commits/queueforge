package com.queueforge.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.common.exception.IdempotencyConflictException;
import com.queueforge.outbox.domain.OrderStatus;
import com.queueforge.outbox.domain.OutboxStatus;
import com.queueforge.outbox.dto.CreateOrderRequest;
import com.queueforge.outbox.dto.OrderResponse;
import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import com.queueforge.outbox.repository.InboxDeduplicationRepository;
import com.queueforge.outbox.repository.OrderRepository;
import com.queueforge.outbox.repository.OutboxEventRepository;
import com.queueforge.outbox.repository.SimulatedPaymentChargeRepository;
import com.queueforge.outbox.service.OrderService;
import com.queueforge.outbox.service.OutboxDispatcherService;
import com.queueforge.outbox.service.PaymentReceiverService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false",
        "queueforge.outbox.payment.client-type=DIRECT"
})
class TransactionalOutboxIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OutboxDispatcherService dispatcherService;

    @Autowired
    private PaymentReceiverService paymentReceiverService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private SimulatedPaymentChargeRepository chargeRepository;

    @Autowired
    private InboxDeduplicationRepository inboxRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        paymentReceiverService.setSimulateLostAck(false);
        paymentReceiverService.setSimulateUnavailable(false);
        dispatcherService.setSimulateCrashAfterClaim(false);

        jdbcTemplate.execute("DELETE FROM inbox_deduplication");
        jdbcTemplate.execute("DELETE FROM simulated_payment_charges");
        jdbcTemplate.execute("DELETE FROM outbox_events");
        jdbcTemplate.execute("DELETE FROM orders");
    }

    @Test
    @DisplayName("Atomic Commit: Order and outbox event are persisted together in single transaction")
    void testAtomicCommit_OrderAndOutboxPersistedTogether() {
        CreateOrderRequest request = new CreateOrderRequest("ORD-1001", "CUST-A", 4999L, "USD");
        OrderResponse response = orderService.createOrder(request);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("CREATED");

        // Verify Order persisted
        var orderOpt = orderRepository.findByOrderNumber("ORD-1001");
        assertThat(orderOpt).isPresent();
        assertThat(orderOpt.get().getAmountCents()).isEqualTo(4999L);

        // Verify Outbox Event persisted in PENDING state
        var outboxOpt = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", orderOpt.get().getId().toString());
        assertThat(outboxOpt).isPresent();
        var outbox = outboxOpt.get();
        assertThat(outbox.getStatus()).isEqualTo(OutboxStatus.PENDING);
        assertThat(outbox.getIdempotencyKey()).isEqualTo("order-payment-" + orderOpt.get().getId());
        assertThat(outbox.getAttemptCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("Scenario A: Crash before commit rolls back both order and outbox event")
    void testTransactionRollback_NeitherOrderNorOutboxPersisted() {
        CreateOrderRequest request = new CreateOrderRequest("ORD-FAIL-1", "CUST-B", 2500L, "USD");

        assertThatThrownBy(() -> orderService.createOrder(request, true))
                .isInstanceOf(OrderService.SimulatedTransactionRollbackException.class);

        // Neither record may remain committed in the database
        assertThat(orderRepository.findByOrderNumber("ORD-FAIL-1")).isEmpty();
        Integer outboxCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_events WHERE payload::text LIKE '%ORD-FAIL-1%'", Integer.class);
        assertThat(outboxCount).isEqualTo(0);
    }

    @Test
    @DisplayName("Scenario B: Crash after commit - Dispatcher discovers and delivers un-dispatched event")
    void testCrashImmediatelyAfterCommit_DispatcherRecoversAndDelivers() {
        // Order committed, but in-memory process halts before dispatch
        CreateOrderRequest request = new CreateOrderRequest("ORD-RECOVER-1", "CUST-C", 1200L, "USD");
        OrderResponse order = orderService.createOrder(request);

        // Sweeper / Dispatcher polls database
        int dispatched = dispatcherService.dispatchPendingEvents(10, 10);
        assertThat(dispatched).isEqualTo(1);

        // Verify outbox state transitioned to DELIVERED
        var outbox = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outbox.getStatus()).isEqualTo(OutboxStatus.DELIVERED);
        assertThat(outbox.getDeliveredAt()).isNotNull();

        // Verify Order state transitioned to PAID
        var updatedOrder = orderRepository.findById(order.id()).orElseThrow();
        assertThat(updatedOrder.getStatus()).isEqualTo(OrderStatus.PAID);

        // Verify Receiver state
        assertThat(chargeRepository.countByOrderId(order.id())).isEqualTo(1);
    }

    @Test
    @DisplayName("Scenario C: Dispatcher crash after claim - Lease expires and second dispatcher recovers")
    void testDispatcherCrashAfterClaim_LeaseExpiresAndSecondDispatcherRecovers() throws InterruptedException {
        CreateOrderRequest request = new CreateOrderRequest("ORD-LEASE-1", "CUST-D", 3500L, "USD");
        OrderResponse order = orderService.createOrder(request);

        // Dispatcher 1 claims with short lease of 1 second, then crashes
        dispatcherService.setSimulateCrashAfterClaim(true);
        assertThatThrownBy(() -> dispatcherService.dispatchPendingEvents(10, 1))
                .isInstanceOf(OutboxDispatcherService.SimulatedDispatcherCrashException.class);

        // Verify event is in DISPATCHING state with active lease
        var outboxAfterCrash = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxAfterCrash.getStatus()).isEqualTo(OutboxStatus.DISPATCHING);
        assertThat(outboxAfterCrash.getClaimToken()).isNotNull();

        // Wait for lease to expire
        Thread.sleep(1200);

        // Dispatcher 2 recovers and dispatches successfully
        dispatcherService.setSimulateCrashAfterClaim(false);
        int dispatched = dispatcherService.dispatchPendingEvents(10, 10);
        assertThat(dispatched).isEqualTo(1);

        var outboxDelivered = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxDelivered.getStatus()).isEqualTo(OutboxStatus.DELIVERED);
        assertThat(chargeRepository.countByOrderId(order.id())).isEqualTo(1);
    }

    @Test
    @DisplayName("Scenario D & Critical Crash Experiment: Lost Acknowledgement - Receiver deduplicates, exactly 1 charge committed")
    void testLostAcknowledgement_ReceiverDeduplicatesAndSingleChargeCommitted() {
        CreateOrderRequest request = new CreateOrderRequest("ORD-LOST-ACK-1", "CUST-E", 9999L, "USD");
        OrderResponse order = orderService.createOrder(request);

        // 1. First Dispatch: Receiver commits charge, but network cuts before ack reaches sender
        paymentReceiverService.setSimulateLostAck(true);
        int dispatched1 = dispatcherService.dispatchPendingEvents(10, 10);
        assertThat(dispatched1).isEqualTo(0); // Sender considered dispatch failed due to lost ack

        // Check Sender database: event still pending retry, attempt_count = 1
        var outboxUncertain = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxUncertain.getStatus()).isEqualTo(OutboxStatus.PENDING);
        assertThat(outboxUncertain.getAttemptCount()).isEqualTo(1);
        assertThat(outboxUncertain.getLastError()).contains("Simulated network timeout");

        // Check Receiver database: Charge was already committed!
        assertThat(chargeRepository.countByOrderId(order.id())).isEqualTo(1);
        assertThat(inboxRepository.findByIdempotencyKey("order-payment-" + order.id())).isPresent();

        // 2. Network restored: Sender retries dispatching the same event
        paymentReceiverService.setSimulateLostAck(false);
        // Reset next_retry_at to NOW for deterministic test execution
        jdbcTemplate.update("UPDATE outbox_events SET next_retry_at = CURRENT_TIMESTAMP WHERE id = ?", outboxUncertain.getId());

        int dispatched2 = dispatcherService.dispatchPendingEvents(10, 10);
        assertThat(dispatched2).isEqualTo(1); // Successfully delivered via idempotent replay

        // 3. Final Verification across both Sender and Receiver persistence boundaries
        var outboxFinal = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxFinal.getStatus()).isEqualTo(OutboxStatus.DELIVERED);
        assertThat(outboxFinal.getAttemptCount()).isEqualTo(2);

        var orderFinal = orderRepository.findById(order.id()).orElseThrow();
        assertThat(orderFinal.getStatus()).isEqualTo(OrderStatus.PAID);

        // CRITICAL INVARIANT: Exactly one charge was committed despite duplicate delivery!
        assertThat(chargeRepository.countByOrderId(order.id())).isEqualTo(1);
    }

    @Test
    @DisplayName("Scenario E: Concurrent Dispatchers - Mutual exclusion via SKIP LOCKED")
    void testConcurrentDispatchers_MutualExclusionViaSkipLocked() throws Exception {
        // Create 20 orders
        for (int i = 0; i < 20; i++) {
            orderService.createOrder(new CreateOrderRequest("ORD-CONC-" + i, "CUST-CONC", 1000L + i, "USD"));
        }

        int threads = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        List<Callable<List<UUID>>> tasks = new ArrayList<>();

        for (int t = 0; t < threads; t++) {
            final String workerName = "conc-worker-" + t;
            tasks.add(() -> {
                var claimed = dispatcherService.claimEvents(10, 15, workerName);
                return claimed.stream().map(OutboxDispatcherService.ClaimedOutboxEvent::id).toList();
            });
        }

        List<Future<List<UUID>>> results = executor.invokeAll(tasks);
        executor.shutdown();

        Set<UUID> allClaimed = new HashSet<>();
        int totalClaimed = 0;

        for (Future<List<UUID>> fut : results) {
            List<UUID> batch = fut.get();
            totalClaimed += batch.size();
            for (UUID id : batch) {
                boolean unique = allClaimed.add(id);
                assertThat(unique).as("Event %s claimed by multiple dispatchers concurrently!", id).isTrue();
            }
        }

        assertThat(totalClaimed).isEqualTo(20);
        assertThat(allClaimed).hasSize(20);
    }

    @Test
    @DisplayName("Scenario F: Temporary Receiver Unavailability - Backoff and eventual delivery")
    void testReceiverUnavailableTemporarily_ExponentialBackoffAndEventualDelivery() {
        CreateOrderRequest request = new CreateOrderRequest("ORD-TEMP-UNAVAIL-1", "CUST-F", 5000L, "USD");
        OrderResponse order = orderService.createOrder(request);

        // 1. Receiver is 503 unavailable
        paymentReceiverService.setSimulateUnavailable(true);
        int dispatched = dispatcherService.dispatchPendingEvents(10, 10);
        assertThat(dispatched).isEqualTo(0);

        var outboxFailed = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxFailed.getStatus()).isEqualTo(OutboxStatus.PENDING);
        assertThat(outboxFailed.getAttemptCount()).isEqualTo(1);
        assertThat(outboxFailed.getLastError()).contains("503");

        // 2. Receiver recovers
        paymentReceiverService.setSimulateUnavailable(false);
        jdbcTemplate.update("UPDATE outbox_events SET next_retry_at = CURRENT_TIMESTAMP WHERE id = ?", outboxFailed.getId());

        int retryDispatched = dispatcherService.dispatchPendingEvents(10, 10);
        assertThat(retryDispatched).isEqualTo(1);

        var outboxSuccess = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxSuccess.getStatus()).isEqualTo(OutboxStatus.DELIVERED);
        assertThat(chargeRepository.countByOrderId(order.id())).isEqualTo(1);
    }

    @Test
    @DisplayName("Scenario G: Conflicting payload with same idempotency key is rejected with conflict")
    void testConflictingPayloadWithSameIdempotencyKey_RejectedAsConflict() {
        UUID orderId = UUID.randomUUID();
        String key = "payment-key-conflicting";
        String fp1 = PaymentReceiverService.computeFingerprint(orderId, "CUST-G", 1000L, "USD");
        PaymentChargeRequest req1 = new PaymentChargeRequest(orderId, "CUST-G", 1000L, "USD", key, fp1);

        PaymentChargeResponse resp1 = paymentReceiverService.processCharge(req1);
        assertThat(resp1.idempotentReplay()).isFalse();

        // Second request with SAME key but conflicting amount (2000L instead of 1000L)
        String fp2 = PaymentReceiverService.computeFingerprint(orderId, "CUST-G", 2000L, "USD");
        PaymentChargeRequest req2 = new PaymentChargeRequest(orderId, "CUST-G", 2000L, "USD", key, fp2);

        assertThatThrownBy(() -> paymentReceiverService.processCharge(req2))
                .isInstanceOf(IdempotencyConflictException.class);

        // Ensure no second charge was committed
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(1);
    }

    @Test
    @DisplayName("Scenario H: Repeated transient failures exhaust retries and route to DEAD_LETTER")
    void testRetryExhaustion_TransitionsToDeadLetter() {
        CreateOrderRequest request = new CreateOrderRequest("ORD-EXHAUST-1", "CUST-H", 7777L, "USD");
        OrderResponse order = orderService.createOrder(request);

        paymentReceiverService.setSimulateUnavailable(true);

        // Fail attempts 1 through 5 (maxRetries = 5)
        for (int i = 1; i <= 5; i++) {
            jdbcTemplate.update("UPDATE outbox_events SET next_retry_at = CURRENT_TIMESTAMP WHERE aggregate_id = ?", order.id().toString());
            dispatcherService.dispatchPendingEvents(10, 10);
        }

        var outboxDeadLetter = outboxEventRepository.findByAggregateTypeAndAggregateId("ORDER", order.id().toString()).orElseThrow();
        assertThat(outboxDeadLetter.getStatus()).isEqualTo(OutboxStatus.DEAD_LETTER);
        assertThat(outboxDeadLetter.getAttemptCount()).isEqualTo(5);
        assertThat(outboxDeadLetter.getLastError()).contains("Exhausted retries");

        // Receiver never committed any charge
        assertThat(chargeRepository.countByOrderId(order.id())).isEqualTo(0);
    }

    @Test
    @DisplayName("Receiver Thread-Safety: 10 concurrent duplicate requests produce exactly 1 charge")
    void testConcurrentDuplicateRequestsToReceiver_ThreadSafeDeduplication() throws Exception {
        UUID orderId = UUID.randomUUID();
        String key = "concurrent-key-" + UUID.randomUUID();
        String fp = PaymentReceiverService.computeFingerprint(orderId, "CUST-MULTI", 5000L, "USD");
        PaymentChargeRequest req = new PaymentChargeRequest(orderId, "CUST-MULTI", 5000L, "USD", key, fp);

        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        List<Callable<PaymentChargeResponse>> tasks = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            tasks.add(() -> paymentReceiverService.processCharge(req));
        }

        List<Future<PaymentChargeResponse>> futures = executor.invokeAll(tasks);
        executor.shutdown();

        Set<UUID> chargeIds = new HashSet<>();
        int replayCount = 0;

        for (Future<PaymentChargeResponse> f : futures) {
            PaymentChargeResponse res = f.get();
            chargeIds.add(res.chargeId());
            if (res.idempotentReplay()) {
                replayCount++;
            }
        }

        // All 10 requests returned the EXACT same charge ID
        assertThat(chargeIds).hasSize(1);
        // 9 out of 10 requests were idempotent replays
        assertThat(replayCount).isEqualTo(9);

        // Database verified: exactly 1 simulated charge row exists!
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(1);
        assertThat(inboxRepository.findByIdempotencyKey(key)).isPresent();
    }
}
