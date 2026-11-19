package com.queueforge.receiver;

import com.queueforge.receiver.controller.PaymentReceiverTestController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://${RECEIVER_DB_HOST:${DB_HOST:127.0.0.1}}:${RECEIVER_DB_PORT:${DB_PORT:5435}}/${RECEIVER_DB_NAME:queueforge_payment_receiver}",
        "queueforge.receiver.test-endpoints-enabled=true",
        "queueforge.receiver.test-secret=qf_test_secret_internal_2026"
})
class PaymentReceiverTestEndpointSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Security: Test endpoint without X-Test-Secret returns 401 Unauthorized")
    void testMissingSecretReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/payments/simulate/lost-ack?enabled=true"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Security: Test endpoint with invalid X-Test-Secret returns 401 Unauthorized")
    void testInvalidSecretReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/payments/simulate/lost-ack?enabled=true")
                        .header(PaymentReceiverTestController.TEST_SECRET_HEADER, "wrong-secret"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Security: Test endpoint with valid X-Test-Secret returns 200 OK")
    void testValidSecretReturns200() throws Exception {
        mockMvc.perform(post("/api/v1/payments/simulate/lost-ack?enabled=true")
                        .header(PaymentReceiverTestController.TEST_SECRET_HEADER, "qf_test_secret_internal_2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.simulateLostAck").value(true));

        // Clean up
        mockMvc.perform(post("/api/v1/payments/simulate/lost-ack?enabled=false")
                        .header(PaymentReceiverTestController.TEST_SECRET_HEADER, "qf_test_secret_internal_2026"))
                .andExpect(status().isOk());
    }
}
