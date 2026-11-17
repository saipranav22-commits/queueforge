package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.config.AdminProperties;
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
                .andExpect(jsonPath("$.status", is(403)));
    }

    @Test
    @DisplayName("Test 3: Submission with valid X-Tenant-Key sets job tenant_id")
    void testSubmissionWithValidTenantKeySetsJobTenant() throws Exception {
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
                        .header("X-Tenant-Key", TENANT_A_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.tenantId", is("tenant-alpha")));
    }

    @Test
    @DisplayName("Test 4: Tenant A submitting with tenantId: 'tenant-beta' returns 403 Forbidden")
    void testTenantCrossSpoofingReturns403() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("action", "sync");

        CreateJobRequest request = new CreateJobRequest(
                "SEND_EMAIL",
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
                .andExpect(jsonPath("$.status", is(403)));
    }

    @Test
    @DisplayName("Test 5: Tenant A attempting to read Tenant B's job detail returns 404 Not Found")
    void testTenantCannotReadOtherTenantJob() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
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

        // Tenant A attempts to read Tenant B's job
        mockMvc.perform(get("/api/v1/jobs/" + jobB.getId())
                        .header("X-Tenant-Key", TENANT_A_KEY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)));
    }

    @Test
    @DisplayName("Test 6: Tenant A listJobs returns only Tenant A jobs (Tenant B jobs hidden)")
    void testTenantListJobsIsScoped() throws Exception {
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
}
