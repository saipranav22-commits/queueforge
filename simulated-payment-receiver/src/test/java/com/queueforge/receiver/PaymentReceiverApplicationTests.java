package com.queueforge.receiver;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.receiver.dto.PaymentChargeRequest;
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

import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:5435/queueforge_payment_receiver"
})
class PaymentReceiverApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PaymentReceiverService receiverService;

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
    }
}
