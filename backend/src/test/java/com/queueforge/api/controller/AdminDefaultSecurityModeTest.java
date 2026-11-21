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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 10C Security Regression Test Suite: Default Security Mode.
 * Verifies that when public-demo-mode=false (the production default):
 * 1. Anonymous requests to ANY /api/v1/admin/** endpoint are strictly REJECTED with 401.
 * 2. Authorized administrators supplying valid X-Admin-Key are permitted.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false",
        "queueforge.outbox.payment.client-type=DIRECT",
        "queueforge.security.public-demo-mode=false"
})
class AdminDefaultSecurityModeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AdminProperties adminProperties;

    @Test
    @DisplayName("Default Mode Gate: Anonymous GET /api/v1/admin/dlq is REJECTED with 401")
    void testAnonymousGetDlqRejectedInDefaultMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Default Mode Gate: Anonymous GET /api/v1/admin/outbox/stats is REJECTED with 401")
    void testAnonymousGetOutboxStatsRejectedInDefaultMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/outbox/stats"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Default Mode Gate: Anonymous GET /api/v1/admin/tenants is REJECTED with 401")
    void testAnonymousGetTenantsRejectedInDefaultMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Default Mode Gate: Anonymous GET /api/v1/admin/tenants/scheduler-config is REJECTED with 401")
    void testAnonymousGetSchedulerConfigRejectedInDefaultMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants/scheduler-config"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Default Mode Authorized: Authenticated GET /api/v1/admin/dlq with valid X-Admin-Key returns 200 OK")
    void testAuthorizedGetDlqAllowedWithAdminKey() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey()))
                .andExpect(status().isOk());
    }
}
