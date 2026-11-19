package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.config.AdminProperties;
import com.queueforge.config.TenantSecurityProperties;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.core.domain.TenantStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.entity.TenantEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.persistence.repository.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false"
})
@AutoConfigureMockMvc
public class TenantSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AdminProperties adminProperties;

    @Autowired
    private TenantSecurityProperties tenantSecurityProperties;

    private static final String TENANT_A_KEY = "key_tenant_alpha";
    private static final String TENANT_B_KEY = "key_tenant_beta";

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
        jdbcTemplate.execute("DELETE FROM qf_tenants WHERE id NOT IN ('default')");

        // Seed Tenant Alpha
        TenantEntity alpha = new TenantEntity("tenant-alpha", "Tenant Alpha", 3, 5, TENANT_A_KEY);
        alpha.setStatus(TenantStatus.ACTIVE);
        tenantRepository.save(alpha);

        // Seed Tenant Beta
        TenantEntity beta = new TenantEntity("tenant-beta", "Tenant Beta", 1, 2, TENANT_B_KEY);
        beta.setStatus(TenantStatus.ACTIVE);
        tenantRepository.save(beta);

        tenantSecurityProperties.setAllowAnonymousDefault(true);
    }

    @Test
    @DisplayName("Test 1: Anonymous submission defaults to 'default' tenant")
    void testAnonymousSubmissionDefaultsToDefaultTenant() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("action", "sync");

        CreateJobRequest request = new CreateJobRequest(
                "SEND_EMAIL",
                payload,
                50,
                3,
                0
        );

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.tenantId", is("default")))
                .andExpect(jsonPath("$.status", is("PENDING")));
    }

    @Test
    @DisplayName("Test 2: Anonymous submission specifying non-default tenant returns 403 Forbidden")
    void testAnonymousSubmissionSpecifyingNonDefaultTenantReturns403() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("action", "sync");

        CreateJobRequest request = new CreateJobRequest(
                "SEND_EMAIL",
                payload,
                50,
                3,
                0,
                "tenant-alpha"
        );

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status", is(403)))
                .andExpect(jsonPath("$.error", is("Forbidden")));
    }

    @Test
    @DisplayName("Test 3: Authenticated Tenant Alpha submission succeeds and is scoped to tenant-alpha")
    void testAuthenticatedTenantSubmissionSucceeds() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("reportName", "alpha-q3");

        CreateJobRequest request = new CreateJobRequest(
                "GENERATE_REPORT",
                payload,
                75,
                3,
                0
        );

        mockMvc.perform(post("/api/v1/jobs")
                        .header("X-Tenant-Key", TENANT_A_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.tenantId", is("tenant-alpha")))
                .andExpect(jsonPath("$.status", is("PENDING")));
    }

    @Test
    @DisplayName("Test 4: Tenant Alpha attempting to spoof Tenant Beta in payload returns 403 Forbidden")
    void testTenantCrossImpersonationRejectedWith403() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("action", "fraud-attempt");

        CreateJobRequest request = new CreateJobRequest(
                "GENERATE_REPORT",
                payload,
                50,
                3,
                0,
                "tenant-beta"
        );

        mockMvc.perform(post("/api/v1/jobs")
                        .header("X-Tenant-Key", TENANT_A_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status", is(403)))
                .andExpect(jsonPath("$.error", is("Forbidden")));
    }

    @Test
    @DisplayName("Test 5: Tenant Alpha cannot view Tenant Beta's job details (returns 404 to avoid enumeration)")
    void testTenantCannotViewOtherTenantsJob() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        JobEntity betaJob = new JobEntity(
                "tenant-beta",
                "key-b-" + UUID.randomUUID(),
                "fp-b-" + UUID.randomUUID(),
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        jobRepository.save(betaJob);

        mockMvc.perform(get("/api/v1/jobs/" + betaJob.getId())
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)));
    }

    @Test
    @DisplayName("Test 6: Tenant Alpha list jobs is strictly scoped to tenant-alpha")
    void testTenantJobListingIsStrictlyIsolated() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        JobEntity jobA = new JobEntity(
                "tenant-alpha",
                "key-a-" + UUID.randomUUID(),
                "fp-a-" + UUID.randomUUID(),
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        jobRepository.save(jobA);

        JobEntity jobB = new JobEntity(
                "tenant-beta",
                "key-b-" + UUID.randomUUID(),
                "fp-b-" + UUID.randomUUID(),
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        jobRepository.save(jobB);

        mockMvc.perform(get("/api/v1/jobs")
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].jobId", is(jobA.getId().toString())))
                .andExpect(jsonPath("$.content[0].tenantId", is("tenant-alpha")));
    }

    @Test
    @DisplayName("Test 7: Master Admin with X-Admin-Key can view, filter, and submit for any tenant")
    void testMasterAdminCanAccessAllTenants() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        JobEntity jobA = new JobEntity(
                "tenant-alpha",
                "key-a-" + UUID.randomUUID(),
                "fp-a-" + UUID.randomUUID(),
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        jobRepository.save(jobA);

        JobEntity jobB = new JobEntity(
                "tenant-beta",
                "key-b-" + UUID.randomUUID(),
                "fp-b-" + UUID.randomUUID(),
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        jobRepository.save(jobB);

        // Admin lists all jobs across tenants
        mockMvc.perform(get("/api/v1/jobs")
                        .header("X-Admin-Key", adminProperties.getApiKey()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(2)));

        // Admin filters specifically for Tenant Beta
        mockMvc.perform(get("/api/v1/jobs")
                        .header("X-Admin-Key", adminProperties.getApiKey())
                        .param("tenantId", "tenant-beta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].tenantId", is("tenant-beta")));

        // Admin submits on behalf of Tenant Beta
        CreateJobRequest request = new CreateJobRequest(
                "GENERATE_REPORT",
                payload,
                50,
                3,
                0,
                "tenant-beta"
        );

        mockMvc.perform(post("/api/v1/jobs")
                        .header("X-Admin-Key", adminProperties.getApiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.tenantId", is("tenant-beta")));
    }

    @Test
    @DisplayName("Test 8: Tenant A attempting to replay or discard Tenant B's DLQ job returns 404")
    void testTenantCannotReplayOrDiscardOtherTenantDlqJob() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        JobEntity dlqJobB = new JobEntity(
                "tenant-beta",
                "key-dlq-b-" + UUID.randomUUID(),
                "fp-dlq-b-" + UUID.randomUUID(),
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        dlqJobB.setStatus(JobStatus.DEAD_LETTER);
        dlqJobB.setFailureCategory(FailureCategory.PERMANENT_FAILURE);
        dlqJobB.setLastErrorMessage("Fatal error in Beta");
        jobRepository.save(dlqJobB);

        // Tenant A attempting to replay Tenant B's DLQ job
        mockMvc.perform(post("/api/v1/admin/dlq/" + dlqJobB.getId() + "/replay")
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isNotFound());

        // Tenant A attempting to discard Tenant B's DLQ job
        mockMvc.perform(post("/api/v1/admin/dlq/" + dlqJobB.getId() + "/discard")
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Test 9: Invalid X-Tenant-Key returns 401 Unauthorized")
    void testInvalidTenantKeyReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/jobs")
                        .header("X-Tenant-Key", "non-existent-key"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status", is(401)))
                .andExpect(jsonPath("$.error", is("Unauthorized")));
    }

    @Test
    @DisplayName("Test 10: Hardcoded default tenant key 'qf_tenant_default_key' is explicitly rejected with 401")
    void testHardcodedDefaultTenantKeyIsExplicitlyRejected() throws Exception {
        mockMvc.perform(get("/api/v1/jobs")
                        .header("X-Tenant-Key", "qf_tenant_default_key"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status", is(401)))
                .andExpect(jsonPath("$.message", containsString("Hardcoded default development keys are disabled")));
    }

    @Test
    @DisplayName("Test 11: Tenant key cannot access administrative tenant management (/api/v1/admin/tenants)")
    void testTenantKeyCannotAccessAdminTenantManagement() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tenants")
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Test 12: Anonymous requests rejected when allow-anonymous-default is disabled")
    void testAnonymousRequestsRejectedWhenDisabled() throws Exception {
        tenantSecurityProperties.setAllowAnonymousDefault(false);
        try {
            mockMvc.perform(get("/api/v1/jobs"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message", containsString("anonymous default access is disabled")));
        } finally {
            tenantSecurityProperties.setAllowAnonymousDefault(true);
        }
    }

    @Test
    @DisplayName("Test 13: Suspended tenant key returns 401 Unauthorized")
    void testSuspendedTenantKeyReturns401() throws Exception {
        TenantEntity beta = tenantRepository.findById("tenant-beta").orElseThrow();
        beta.setStatus(TenantStatus.SUSPENDED);
        tenantRepository.save(beta);

        mockMvc.perform(get("/api/v1/jobs")
                        .header("X-Tenant-Key", TENANT_B_KEY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Invalid or inactive tenant credentials")));
    }

    @Test
    @DisplayName("Test 14: Tenant A cannot inspect execution logs for Tenant B's job (returns 404 Not Found)")
    void testTenantCannotViewAnotherTenantsJobHistory() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("data", "beta-history-data");

        JobEntity jobB = new JobEntity(
                "tenant-beta",
                null,
                null,
                "GENERATE_REPORT",
                payload,
                50,
                3,
                Instant.now()
        );
        jobB.setStatus(JobStatus.COMPLETED);
        jobRepository.save(jobB);

        jdbcTemplate.update("""
            INSERT INTO qf_job_execution_logs (job_id, worker_id, attempt, status, execution_time_ms, tenant_id, created_at)
            VALUES (?, 'worker-b', 1, 'COMPLETED', 15, 'tenant-beta', CURRENT_TIMESTAMP)
            """, jobB.getId());

        // Tenant A attempting to inspect Tenant B's execution logs -> 404
        mockMvc.perform(get("/api/v1/jobs/" + jobB.getId() + "/history")
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isNotFound());

        // Master Admin can view Tenant B's execution logs -> 200 OK
        mockMvc.perform(get("/api/v1/jobs/" + jobB.getId() + "/history")
                        .header("X-Admin-Key", adminProperties.getApiKey()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("Test 15: Production release gate rejects startup if default admin key is detected")
    void testProductionReleaseGateRejectsDefaultAdminSecret() {
        AdminProperties testProps = new AdminProperties();
        testProps.setApiKey(AdminProperties.DEFAULT_DEV_SECRET);

        TenantSecurityProperties secProps = new TenantSecurityProperties();
        secProps.setEnforceStrongAdminKey(true);

        org.springframework.test.util.ReflectionTestUtils.setField(testProps, "tenantSecurityProperties", secProps);

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, testProps::validateSecurity,
                "Expected validateSecurity to throw IllegalStateException when default dev secret is active in strict mode");
    }
}
