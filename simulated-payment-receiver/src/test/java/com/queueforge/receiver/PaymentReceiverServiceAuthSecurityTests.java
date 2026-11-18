package com.queueforge.receiver;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.receiver.controller.PaymentReceiverController;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:5435/queueforge_payment_receiver",
        "queueforge.receiver.test-endpoints-enabled=false",
        "queueforge.receiver.service-auth-enabled=true",
        "queueforge.receiver.service-key=test_isolated_service_secret_2026"
})
class PaymentReceiverServiceAuthSecurityTests {

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
    @DisplayName("Request without X-Service-Key header returns 401 Unauthorized in secure mode")
    void testMissingServiceKeyRejected() throws Exception {
        PaymentChargeRequest request = new PaymentChargeRequest(
                UUID.randomUUID(), "CUST-SEC-1", 5000L, "USD", "sec-key-" + UUID.randomUUID(), "fp-sec-1"
        );

        mockMvc.perform(post("/api/v1/payments/charges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Missing or invalid service-to-service authorization key"));
    }

    @Test
    @DisplayName("Request with invalid X-Service-Key header returns 401 Unauthorized")
    void testInvalidServiceKeyRejected() throws Exception {
        PaymentChargeRequest request = new PaymentChargeRequest(
                UUID.randomUUID(), "CUST-SEC-2", 5000L, "USD", "sec-key-" + UUID.randomUUID(), "fp-sec-2"
        );

        mockMvc.perform(post("/api/v1/payments/charges")
                        .header(PaymentReceiverController.SERVICE_KEY_HEADER, "wrong-unauthorized-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Request with valid X-Service-Key header succeeds with 201 Created")
    void testValidServiceKeyAccepted() throws Exception {
        PaymentChargeRequest request = new PaymentChargeRequest(
                UUID.randomUUID(), "CUST-SEC-3", 5000L, "USD", "sec-key-" + UUID.randomUUID(), "fp-sec-3"
        );

        mockMvc.perform(post("/api/v1/payments/charges")
                        .header(PaymentReceiverController.SERVICE_KEY_HEADER, "test_isolated_service_secret_2026")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUCCEEDED"));
    }
}
