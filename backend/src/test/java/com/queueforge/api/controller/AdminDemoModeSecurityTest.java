package com.queueforge.api.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the Public Demo Mode security guarantees:
 * Unauthenticated visitors can view monitoring data (GET /dlq, /outbox, /tenants),
 * but are STRICTLY BLOCKED from any state-mutating administrative actions (POST, PUT, DELETE).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false",
        "queueforge.outbox.payment.client-type=DIRECT",
        "queueforge.security.public-demo-mode=true"
})
class AdminDemoModeSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Demo Mode: Unauthenticated GET /api/v1/admin/dlq returns 200 OK")
    void testAnonymousGetDlqAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Demo Mode: Unauthenticated GET /api/v1/admin/outbox/status returns 200 OK")
    void testAnonymousGetOutboxStatusAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/outbox/status"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Demo Mode: Unauthenticated GET /api/v1/admin/tenants returns 200 OK")
    void testAnonymousGetTenantsAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Demo Mode Security Gate: Unauthenticated POST /api/v1/admin/dlq/replay is STRICTLY REJECTED with 401")
    void testAnonymousPostDlqReplayRejectedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/dlq/replay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\": 10}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Security Gate: Unauthenticated POST /api/v1/admin/outbox/dispatch is STRICTLY REJECTED with 401")
    void testAnonymousPostOutboxDispatchRejectedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/outbox/dispatch"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Security Gate: Unauthenticated POST /api/v1/admin/tenants is STRICTLY REJECTED with 401")
    void testAnonymousPostTenantRejectedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tenantId\": \"malicious\", \"weight\": 100}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Security Gate: Unauthenticated DELETE /api/v1/admin/tenants/{id} is STRICTLY REJECTED with 401")
    void testAnonymousDeleteTenantRejectedWith401() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/tenants/demo-test"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }
}
