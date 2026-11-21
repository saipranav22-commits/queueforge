package com.queueforge.api.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Phase 10C Security Regression Test Suite.
 * Exhaustively validates Public Demo Mode authorization boundaries:
 * 1. Anonymously permitted ONLY on exact safe summary telemetry endpoints.
 * 2. Strictly BLOCKED from nested detail endpoints (protecting raw payloads, stack traces, and API keys).
 * 3. Strictly BLOCKED from all mutating HTTP verbs (POST, PUT, DELETE, PATCH).
 * 4. Strictly BLOCKED from method override headers/parameters.
 * 5. Strictly BLOCKED from forged identity headers.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false",
        "queueforge.outbox.payment.client-type=DIRECT",
        "queueforge.security.public-demo-mode=true",
        "spring.datasource.hikari.maximum-pool-size=3",
        "spring.datasource.hikari.minimum-idle=1"
})
class AdminDemoModeSecurityTest {

    private static final String DUMMY_UUID = "00000000-0000-0000-0000-000000000001";

    @Autowired
    private MockMvc mockMvc;

    // =========================================================================
    // 1. Permitted Safe Summary Endpoints
    // =========================================================================

    @Test
    @DisplayName("Demo Mode Positive: Anonymous GET /api/v1/admin/dlq returns 200 OK")
    void testAnonymousGetDlqSummaryAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("Demo Mode Positive: Anonymous GET /api/v1/admin/outbox/stats returns 200 OK")
    void testAnonymousGetOutboxStatsAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/outbox/stats"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Demo Mode Positive: Anonymous GET /api/v1/admin/outbox/events returns 200 OK")
    void testAnonymousGetOutboxEventsSummaryAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/outbox/events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("Demo Mode Positive: Anonymous GET /api/v1/admin/tenants returns 200 OK and leaks no API keys")
    void testAnonymousGetTenantsAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[*].apiKey").doesNotExist())
                .andExpect(jsonPath("$[*].apiKeyHash").doesNotExist());
    }

    @Test
    @DisplayName("Demo Mode Positive: Anonymous GET /api/v1/admin/tenants/scheduler-config returns 200 OK")
    void testAnonymousGetSchedulerConfigAllowedInDemoMode() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants/scheduler-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseQuantum").exists());
    }

    // =========================================================================
    // 2. Sensitive Detail Routes Strictly Guarded (401 Unauthorized)
    // =========================================================================

    @Test
    @DisplayName("Demo Mode Sensitive Gate: Anonymous GET /api/v1/admin/dlq/{jobId} is BLOCKED (401) to protect stack traces and payloads")
    void testAnonymousGetDlqDetailBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq/" + DUMMY_UUID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Sensitive Gate: Anonymous GET /api/v1/admin/outbox/events/{id} is BLOCKED (401) to protect raw payment payloads")
    void testAnonymousGetOutboxEventDetailBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/outbox/events/" + DUMMY_UUID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Sensitive Gate: Anonymous GET /api/v1/admin/tenants/{id} is BLOCKED (401) to protect tenant credentials")
    void testAnonymousGetTenantDetailBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants/default"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    // =========================================================================
    // 3. Mutating Endpoints Strictly Guarded (401 Unauthorized)
    // =========================================================================

    @Test
    @DisplayName("Demo Mode Mutating Gate: Anonymous POST /api/v1/admin/dlq/{jobId}/replay is BLOCKED (401)")
    void testAnonymousPostDlqReplayBlockedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/dlq/" + DUMMY_UUID + "/replay"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Mutating Gate: Anonymous POST /api/v1/admin/dlq/{jobId}/discard is BLOCKED (401)")
    void testAnonymousPostDlqDiscardBlockedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/dlq/" + DUMMY_UUID + "/discard"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Mutating Gate: Anonymous DELETE /api/v1/admin/dlq/{jobId}/discard is BLOCKED (401)")
    void testAnonymousDeleteDlqDiscardBlockedWith401() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/dlq/" + DUMMY_UUID + "/discard"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Mutating Gate: Anonymous POST /api/v1/admin/outbox/dispatch is BLOCKED (401)")
    void testAnonymousPostOutboxDispatchBlockedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/outbox/dispatch"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Mutating Gate: Anonymous POST /api/v1/admin/tenants is BLOCKED (401)")
    void testAnonymousPostTenantBlockedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\": \"hacker\", \"name\": \"Malicious\", \"weight\": 100}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Mutating Gate: Anonymous PUT /api/v1/admin/tenants/{id} is BLOCKED (401)")
    void testAnonymousPutTenantBlockedWith401() throws Exception {
        mockMvc.perform(put("/api/v1/admin/tenants/default")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Hijacked\", \"weight\": 99}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    // =========================================================================
    // 4. Method Overrides & Forgery Attempts Strictly Guarded
    // =========================================================================

    @Test
    @DisplayName("Demo Mode Bypass Defense: X-HTTP-Method-Override header cannot bypass read-only policy")
    void testMethodOverrideHeaderBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq")
                        .header("X-HTTP-Method-Override", "DELETE"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Bypass Defense: _method query parameter cannot bypass read-only policy")
    void testMethodOverrideParamBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants?_method=DELETE"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Path Guard: Unexpected admin route is BLOCKED (401)")
    void testUnexpectedAdminRouteBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/internal-unregistered-route"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Demo Mode Forgery Defense: Forged X-Forwarded-User or role header cannot elevate privileges")
    void testForgedIdentityHeaderBlockedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants/default")
                        .header("X-Forwarded-User", "admin")
                        .header("X-Role", "ADMIN")
                        .header("X-Admin", "true"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }
}
