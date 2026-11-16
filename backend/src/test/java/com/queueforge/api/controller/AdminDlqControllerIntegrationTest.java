package com.queueforge.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.api.security.AdminAuthInterceptor;
import com.queueforge.config.AdminProperties;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false" // Disable background polling for predictable testing
})
@AutoConfigureMockMvc
class AdminDlqControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AdminProperties adminProperties;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    private JobEntity createJob(String type, JobStatus status, FailureCategory category, String error) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("test", "data");

        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                type,
                payload,
                50,
                3,
                Instant.now()
        );
        job.setStatus(status);
        job.setFailureCategory(category);
        job.setLastErrorMessage(error);
        job.setLastErrorStack("java.lang.RuntimeException: " + error);
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("Admin Security: Request missing X-Admin-Key returns 401 Unauthorized")
    void missingAdminKey_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value(containsString("Missing or invalid administrative authentication key")));
    }

    @Test
    @DisplayName("Admin Security: Request with invalid X-Admin-Key returns 401 Unauthorized")
    void invalidAdminKey_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dlq")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, "wrong-key"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("Admin DLQ: List DLQ jobs with pagination")
    void listDlqJobs_paginated() throws Exception {
        for (int i = 0; i < 5; i++) {
            createJob("GENERATE_REPORT", JobStatus.DEAD_LETTER, FailureCategory.TRANSIENT_FAILURE, "Timeout error " + i);
        }
        // Also create a COMPLETED job that should NOT appear in DLQ
        createJob("GENERATE_REPORT", JobStatus.COMPLETED, null, null);

        mockMvc.perform(get("/api/v1/admin/dlq")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey())
                        .param("page", "0")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(3)))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(3));
    }

    @Test
    @DisplayName("Admin DLQ: Filter by jobType and failureCategory")
    void listDlqJobs_withFilters() throws Exception {
        createJob("GENERATE_REPORT", JobStatus.DEAD_LETTER, FailureCategory.TRANSIENT_FAILURE, "Network error");
        createJob("GENERATE_REPORT", JobStatus.DEAD_LETTER, FailureCategory.PERMANENT_FAILURE, "Invalid schema");
        createJob("SEND_EMAIL", JobStatus.DEAD_LETTER, FailureCategory.HANDLER_NOT_FOUND, "No handler");

        mockMvc.perform(get("/api/v1/admin/dlq")
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey())
                        .param("jobType", "GENERATE_REPORT")
                        .param("failureCategory", "PERMANENT_FAILURE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].jobType").value("GENERATE_REPORT"))
                .andExpect(jsonPath("$.content[0].failureCategory").value("PERMANENT_FAILURE"));
    }

    @Test
    @DisplayName("Admin DLQ: Inspect single DLQ job diagnostics")
    void getDlqJob_success() throws Exception {
        JobEntity job = createJob("GENERATE_REPORT", JobStatus.DEAD_LETTER, FailureCategory.PERMANENT_FAILURE, "Fatal business error");

        mockMvc.perform(get("/api/v1/admin/dlq/{jobId}", job.getId())
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(job.getId().toString()))
                .andExpect(jsonPath("$.status").value("DEAD_LETTER"))
                .andExpect(jsonPath("$.failureCategory").value("PERMANENT_FAILURE"))
                .andExpect(jsonPath("$.lastErrorMessage").value("Fatal business error"))
                .andExpect(jsonPath("$.lastErrorStack").value(containsString("Fatal business error")))
                .andExpect(jsonPath("$.payload.test").value("data"));
    }

    @Test
    @DisplayName("Admin DLQ: Inspect job not in DEAD_LETTER returns 409 Conflict")
    void getDlqJob_notInDlq_returns409() throws Exception {
        JobEntity job = createJob("GENERATE_REPORT", JobStatus.PENDING, null, null);

        mockMvc.perform(get("/api/v1/admin/dlq/{jobId}", job.getId())
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    @DisplayName("Admin DLQ: Replay DLQ job transitions to PENDING and clears failure metadata")
    void replayDlqJob_success() throws Exception {
        JobEntity job = createJob("GENERATE_REPORT", JobStatus.DEAD_LETTER, FailureCategory.TRANSIENT_FAILURE, "Exhausted retries");

        mockMvc.perform(post("/api/v1/admin/dlq/{jobId}/replay", job.getId())
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(job.getId().toString()))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.message").value(containsString("successfully returned to PENDING")));

        JobEntity updated = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(updated.getAttemptCount()).isEqualTo(0);
        assertThat(updated.getRetryCount()).isEqualTo(0);
        assertThat(updated.getFailureCategory()).isNull();
        assertThat(updated.getLastErrorMessage()).isNull();
        assertThat(updated.getClaimToken()).isNull();

        Integer logCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_job_execution_logs WHERE job_id = ? AND status = 'REPLAYED'",
                Integer.class,
                job.getId()
        );
        assertThat(logCount).isEqualTo(1);
    }

    @Test
    @DisplayName("Admin DLQ: Discard DLQ job transitions to ARCHIVED")
    void discardDlqJob_success() throws Exception {
        JobEntity job = createJob("GENERATE_REPORT", JobStatus.DEAD_LETTER, FailureCategory.PERMANENT_FAILURE, "Bad input");

        mockMvc.perform(post("/api/v1/admin/dlq/{jobId}/discard", job.getId())
                        .header(AdminAuthInterceptor.ADMIN_KEY_HEADER, adminProperties.getApiKey()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(job.getId().toString()))
                .andExpect(jsonPath("$.status").value("ARCHIVED"))
                .andExpect(jsonPath("$.message").value(containsString("archived")));

        JobEntity updated = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(JobStatus.ARCHIVED);
    }
}
