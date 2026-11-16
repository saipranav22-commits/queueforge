package com.queueforge.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false"
})
@AutoConfigureMockMvc
class DashboardControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDb() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    private JobEntity insertJob(String type, JobStatus status, int priority) {
        ObjectNode payload = objectMapper.createObjectNode().put("test", "data");
        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                type,
                payload,
                priority,
                3,
                Instant.now().minusSeconds(10)
        );
        job.setStatus(status);
        return jobRepository.saveAndFlush(job);
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/stats returns real queue statistics")
    void getDashboardStats_returnsRealData() throws Exception {
        insertJob("GENERATE_REPORT", JobStatus.PENDING, 50);
        insertJob("GENERATE_REPORT", JobStatus.COMPLETED, 80);

        mockMvc.perform(get("/api/v1/dashboard/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerStatus", notNullValue()))
                .andExpect(jsonPath("$.workerCapacity", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.activeWorkers", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/v1/system/health returns database and worker health status")
    void getSystemHealth_returnsHealthData() throws Exception {
        mockMvc.perform(get("/api/v1/system/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dbStatus", is("UP")))
                .andExpect(jsonPath("$.workerStatus", notNullValue()))
                .andExpect(jsonPath("$.workerCapacity", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.uptimeSeconds", greaterThanOrEqualTo(0)));
    }

    @Test
    @DisplayName("GET /api/v1/system/metrics-summary returns aggregated metrics")
    void getMetricsSummary_returnsSummary() throws Exception {
        mockMvc.perform(get("/api/v1/system/metrics-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.submittedTotal", notNullValue()))
                .andExpect(jsonPath("$.completedTotal", notNullValue()))
                .andExpect(jsonPath("$.failuresByCategory", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/v1/jobs lists jobs with pagination and filters")
    void listJobs_withPaginationAndFilters() throws Exception {
        JobEntity j1 = insertJob("GENERATE_REPORT", JobStatus.PENDING, 90);
        JobEntity j2 = insertJob("SEND_EMAIL", JobStatus.COMPLETED, 20);

        mockMvc.perform(get("/api/v1/jobs?page=0&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page", is(0)))
                .andExpect(jsonPath("$.totalElements", is(2)))
                .andExpect(jsonPath("$.content", hasSize(2)));

        // Filter by status
        mockMvc.perform(get("/api/v1/jobs?status=PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].jobId", is(j1.getId().toString())));

        // Filter by jobType
        mockMvc.perform(get("/api/v1/jobs?jobType=SEND_EMAIL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].jobId", is(j2.getId().toString())));
    }

    @Test
    @DisplayName("GET /api/v1/jobs/{jobId}/detail returns full payload and execution logs when authenticated")
    void getJobDetail_returnsFullInfo() throws Exception {
        JobEntity job = insertJob("GENERATE_REPORT", JobStatus.COMPLETED, 75);

        // Insert a simulated execution log
        jdbcTemplate.update("""
            INSERT INTO qf_job_execution_logs (job_id, worker_id, attempt, status, execution_time_ms, created_at)
            VALUES (?, 'worker-test-1', 1, 'COMPLETED', 125, CURRENT_TIMESTAMP)
            """, job.getId());

        mockMvc.perform(get("/api/v1/jobs/" + job.getId() + "/detail")
                        .header("X-Admin-Key", "qf_admin_dev_secret_2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId", is(job.getId().toString())))
                .andExpect(jsonPath("$.status", is("COMPLETED")))
                .andExpect(jsonPath("$.priority", is(75)))
                .andExpect(jsonPath("$.payload.test", is("data")))
                .andExpect(jsonPath("$.executionLogs", hasSize(1)))
                .andExpect(jsonPath("$.executionLogs[0].workerId", is("worker-test-1")))
                .andExpect(jsonPath("$.executionLogs[0].executionTimeMs", is(125)));
    }

    @Test
    @DisplayName("GET /api/v1/jobs/{jobId}/detail masks payload and internal worker details for unauthenticated requests")
    void getJobDetail_unauthenticated_masksSensitivePayloadAndWorkerInfo() throws Exception {
        JobEntity job = insertJob("GENERATE_REPORT", JobStatus.COMPLETED, 75);

        jdbcTemplate.update("""
            INSERT INTO qf_job_execution_logs (job_id, worker_id, attempt, status, execution_time_ms, created_at)
            VALUES (?, 'worker-internal-node-9', 1, 'COMPLETED', 125, CURRENT_TIMESTAMP)
            """, job.getId());

        mockMvc.perform(get("/api/v1/jobs/" + job.getId() + "/detail"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId", is(job.getId().toString())))
                .andExpect(jsonPath("$.payload._masked", is(true)))
                .andExpect(jsonPath("$.payload.test").doesNotExist())
                .andExpect(jsonPath("$.executionLogs", hasSize(1)))
                .andExpect(jsonPath("$.executionLogs[0].workerId", is("worker-***")));
    }
}
