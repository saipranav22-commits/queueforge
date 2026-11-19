package com.queueforge.api.controller;

import com.queueforge.api.security.AdminAuthInterceptor;
import com.queueforge.config.AdminProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false",
        "queueforge.outbox.payment.client-type=DIRECT"
})
class AdminOutboxControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AdminProperties adminProperties;

    @Test
    @DisplayName("Security: Unauthenticated request to /api/v1/admin/outbox/dispatch returns 401 Unauthorized")
    void testDispatchWithoutAuthReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/outbox/dispatch"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Security: Request with invalid X-Admin-Key returns 401 Unauthorized")
    void testDispatchWithInvalidKeyReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/outbox/dispatch")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, "invalid-key-value"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Security: Obsolete unauthenticated endpoint /api/v1/outbox/dispatch returns 404 Not Found")
    void testOldUnauthenticatedEndpointReturns404() throws Exception {
        mockMvc.perform(post("/api/v1/outbox/dispatch"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Security: Authenticated request with valid X-Admin-Key returns 200 OK")
    void testDispatchWithValidKeyReturns200() throws Exception {
        mockMvc.perform(post("/api/v1/admin/outbox/dispatch")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey())
                        .param("batchSize", "10")
                        .param("leaseDurationSeconds", "15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.batchSize", is(10)))
                .andExpect(jsonPath("$.leaseDurationSeconds", is(15)));
    }

    @Test
    @DisplayName("Security: Excessive batch and lease parameters are safely bounded")
    void testExcessiveParametersAreBounded() throws Exception {
        mockMvc.perform(post("/api/v1/admin/outbox/dispatch")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey())
                        .param("batchSize", "500")
                        .param("leaseDurationSeconds", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.batchSize", is(50)))
                .andExpect(jsonPath("$.leaseDurationSeconds", is(60)));
    }
}
