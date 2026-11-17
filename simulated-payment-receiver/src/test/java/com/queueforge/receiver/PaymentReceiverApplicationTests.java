package com.queueforge.receiver;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.receiver.dto.PaymentChargeRequest;
import com.queueforge.receiver.dto.PaymentChargeResponse;
import com.queueforge.receiver.repository.ChargeRepository;
import com.queueforge.receiver.repository.InboxDeduplicationRepository;
import com.queueforge.receiver.service.PaymentReceiverService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:5435/queueforge_payment_receiver",
        "queueforge.receiver.test-endpoints-enabled=false"
})
class PaymentReceiverApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PaymentReceiverService receiverService;

    @Autowired
    private ChargeRepository chargeRepository;

    @Autowired
    private InboxDeduplicationRepository inboxRepository;

    @BeforeEach
    void setup() {
        receiverService.resetAll();
    }

    @Test
    @DisplayName("Fresh charge is created with 201 Created and idempotent replay returns 200 OK")
    void testChargeLifecycle() throws Exception {
        UUID orderId = UUID.randomUUID();
        String key = "test-key-" + UUID.randomUUID();
        String fp = "fp-1000";

        PaymentChargeRequest request = new PaymentChargeRequest(orderId, "CUST-1", 1000L, "USD", key, fp);

        // First attempt -> 201 Created
        mockMvc.perform(post("/api/v1/payments/charges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.idempotentReplay", is(false)))
                .andExpect(jsonPath("$.status", is("SUCCEEDED")));

        // Duplicate attempt -> 200 OK (idempotent replay)
        mockMvc.perform(post("/api/v1/payments/charges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idempotentReplay", is(true)))
                .andExpect(jsonPath("$.status", is("SUCCEEDED")));

        // DB state verification
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(1);
        assertThat(inboxRepository.findByIdempotencyKey(key)).isPresent();
    }

    @Test
    @DisplayName("Conflicting fingerprint with same idempotency key returns 409 Conflict")
    void testConflictingFingerprint() throws Exception {
        UUID orderId = UUID.randomUUID();
        String key = "conflict-key-" + UUID.randomUUID();

        PaymentChargeRequest req1 = new PaymentChargeRequest(orderId, "CUST-1", 1000L, "USD", key, "fp-A");
        PaymentChargeRequest req2 = new PaymentChargeRequest(orderId, "CUST-1", 2000L, "USD", key, "fp-B");

        mockMvc.perform(post("/api/v1/payments/charges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/payments/charges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("IDEMPOTENCY_CONFLICT")));

        // Exactly 1 charge exists in DB
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(1);
    }

    @Test
    @DisplayName("Security: Test and destructive endpoints return 404 when test-endpoints-enabled is false")
    void testTestEndpointsDisabledByDefaultReturn404() throws Exception {
        mockMvc.perform(post("/api/v1/payments/reset"))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/payments/simulate/lost-ack?enabled=true"))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/payments/simulate/unavailable?enabled=true"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/payments/charges/count?orderId=" + UUID.randomUUID()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/payments/inbox/test-key"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Concurrency: Two concurrent identical requests result in exactly 1 charge and 1 replay")
    void testTwoConcurrentMatchingRequests() throws Exception {
        UUID orderId = UUID.randomUUID();
        String key = "conc2-key-" + UUID.randomUUID();
        PaymentChargeRequest request = new PaymentChargeRequest(orderId, "CUST-CONC2", 2500L, "USD", key, "fp-conc2");
        String json = objectMapper.writeValueAsString(request);

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CyclicBarrier barrier = new CyclicBarrier(threads);
        List<Future<MvcResult>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                barrier.await();
                return mockMvc.perform(post("/api/v1/payments/charges")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json))
                        .andReturn();
            }));
        }

        AtomicInteger createdCount = new AtomicInteger(0);
        AtomicInteger replayCount = new AtomicInteger(0);

        for (Future<MvcResult> f : futures) {
            MvcResult res = f.get(10, TimeUnit.SECONDS);
            int code = res.getResponse().getStatus();
            assertThat(code).isIn(200, 201);
            PaymentChargeResponse body = objectMapper.readValue(res.getResponse().getContentAsString(), PaymentChargeResponse.class);
            if (body.idempotentReplay()) {
                replayCount.incrementAndGet();
            } else {
                createdCount.incrementAndGet();
            }
        }
        executor.shutdown();

        assertThat(createdCount.get()).isEqualTo(1);
        assertThat(replayCount.get()).isEqualTo(1);
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(1);
    }

    @Test
    @DisplayName("Concurrency: Ten concurrent identical requests result in exactly 1 charge and 9 replays")
    void testTenConcurrentMatchingRequests() throws Exception {
        UUID orderId = UUID.randomUUID();
        String key = "conc10-key-" + UUID.randomUUID();
        PaymentChargeRequest request = new PaymentChargeRequest(orderId, "CUST-CONC10", 7500L, "USD", key, "fp-conc10");
        String json = objectMapper.writeValueAsString(request);

        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CyclicBarrier barrier = new CyclicBarrier(threads);
        List<Future<MvcResult>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                barrier.await();
                return mockMvc.perform(post("/api/v1/payments/charges")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json))
                        .andReturn();
            }));
        }

        AtomicInteger createdCount = new AtomicInteger(0);
        AtomicInteger replayCount = new AtomicInteger(0);

        for (Future<MvcResult> f : futures) {
            MvcResult res = f.get(15, TimeUnit.SECONDS);
            int code = res.getResponse().getStatus();
            assertThat(code).isIn(200, 201);
            PaymentChargeResponse body = objectMapper.readValue(res.getResponse().getContentAsString(), PaymentChargeResponse.class);
            if (body.idempotentReplay()) {
                replayCount.incrementAndGet();
            } else {
                createdCount.incrementAndGet();
            }
        }
        executor.shutdown();

        assertThat(createdCount.get()).isEqualTo(1);
        assertThat(replayCount.get()).isEqualTo(9);
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(1);
    }

    @Test
    @DisplayName("Concurrency: Concurrent conflicting requests result in 1 success and 1 409 Conflict")
    void testConcurrentConflictingRequests() throws Exception {
        UUID orderId1 = UUID.randomUUID();
        UUID orderId2 = UUID.randomUUID();
        String key = "conc-conf-" + UUID.randomUUID();

        PaymentChargeRequest req1 = new PaymentChargeRequest(orderId1, "CUST-CONF", 1000L, "USD", key, "fp-X");
        PaymentChargeRequest req2 = new PaymentChargeRequest(orderId2, "CUST-CONF", 2000L, "USD", key, "fp-Y");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);

        Future<MvcResult> f1 = executor.submit(() -> {
            barrier.await();
            return mockMvc.perform(post("/api/v1/payments/charges")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req1)))
                    .andReturn();
        });

        Future<MvcResult> f2 = executor.submit(() -> {
            barrier.await();
            return mockMvc.perform(post("/api/v1/payments/charges")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req2)))
                    .andReturn();
        });

        MvcResult r1 = f1.get(10, TimeUnit.SECONDS);
        MvcResult r2 = f2.get(10, TimeUnit.SECONDS);
        executor.shutdown();

        List<Integer> statuses = List.of(r1.getResponse().getStatus(), r2.getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);

        // Verify only 1 charge total in DB
        long totalCharges = chargeRepository.count();
        assertThat(totalCharges).isEqualTo(1);
    }

    @Test
    @DisplayName("Atomicity: Validation failure causes complete rollback with zero charges or inbox records")
    void testTransactionRollbackOnInvalidRequest() throws Exception {
        UUID orderId = UUID.randomUUID();
        String key = "invalid-key-" + UUID.randomUUID();

        // Invalid request: currency not 3 characters
        PaymentChargeRequest invalidRequest = new PaymentChargeRequest(orderId, "CUST-ERR", 1000L, "INVALID_CURRENCY", key, "fp");

        mockMvc.perform(post("/api/v1/payments/charges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());

        // Assert 0 rows persisted
        assertThat(chargeRepository.countByOrderId(orderId)).isEqualTo(0);
        assertThat(inboxRepository.findByIdempotencyKey(key)).isEmpty();
    }
}
