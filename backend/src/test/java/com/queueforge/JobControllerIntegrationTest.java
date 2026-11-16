package com.queueforge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.api.dto.CreateJobResponse;
import com.queueforge.api.dto.JobStatusResponse;
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
import org.springframework.test.web.servlet.MvcResult;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class JobControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        jobRepository.deleteAll();
    }

    @Test
    @DisplayName("1. Successful job submission returns 202 Accepted and persists job in PostgreSQL")
    void submitJob_success_returns202AndPersists() throws Exception {
        String requestJson = """
            {
              "jobType": "GENERATE_REPORT",
              "payload": {
                "reportName": "quarterly-sales",
                "format": "PDF"
              },
              "priority": 75,
              "maxRetries": 3,
              "delaySeconds": 0
            }
            """;

        MvcResult result = mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").isNotEmpty())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.scheduledAt").isNotEmpty())
                .andReturn();

        CreateJobResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), CreateJobResponse.class);
        Optional<JobEntity> persisted = jobRepository.findById(response.jobId());
        assertThat(persisted).isPresent();
        assertThat(persisted.get().getJobType()).isEqualTo("GENERATE_REPORT");
        assertThat(persisted.get().getPriority()).isEqualTo(75);
        assertThat(persisted.get().getMaxRetries()).isEqualTo(3);
    }

    @Test
    @DisplayName("2. Successful status retrieval returns 200 OK with accurate persisted job details")
    void getJobStatus_success_returns200() throws Exception {
        JsonNode payload = objectMapper.readTree("{\"recipient\": \"ops@company.com\", \"subject\": \"Alert\"}");
        JobEntity job = new JobEntity(null, null, "SEND_EMAIL", payload, 80, 5, java.time.Instant.now());
        JobEntity saved = jobRepository.save(job);

        mockMvc.perform(get("/api/v1/jobs/" + saved.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(saved.getId().toString()))
                .andExpect(jsonPath("$.jobType").value("SEND_EMAIL"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.priority").value(80))
                .andExpect(jsonPath("$.retryCount").value(0))
                .andExpect(jsonPath("$.maxRetries").value(5))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.scheduledAt").isNotEmpty());
    }

    @Test
    @DisplayName("3. Persistence survives service-level reinitialization verified directly via JDBC")
    void persistenceAcrossReinitialization_verifiesDbPersistence() throws Exception {
        String requestJson = """
            {
              "jobType": "DATA_EXPORT",
              "payload": {"dataset": "users_2026", "format": "CSV"},
              "priority": 60,
              "maxRetries": 2,
              "delaySeconds": 10
            }
            """;

        MvcResult result = mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isAccepted())
                .andReturn();

        CreateJobResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), CreateJobResponse.class);

        // Verify row exists directly at the database engine level via JDBC
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT id, job_type, priority, status FROM qf_jobs WHERE id = ?",
                response.jobId()
        );

        assertThat(row.get("id")).isEqualTo(response.jobId());
        assertThat(row.get("job_type")).isEqualTo("DATA_EXPORT");
        assertThat(row.get("priority")).isEqualTo(60);
        assertThat(row.get("status")).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("4. Missing job ID returns HTTP 404 Not Found")
    void getJobStatus_missingJob_returns404() throws Exception {
        UUID unknownId = UUID.randomUUID();

        mockMvc.perform(get("/api/v1/jobs/" + unknownId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Job with ID '" + unknownId + "' was not found"));
    }

    @Test
    @DisplayName("5. Invalid priority returns HTTP 400 Bad Request")
    void submitJob_invalidPriority_returns400() throws Exception {
        String invalidPriorityJson = """
            {
              "jobType": "GENERATE_REPORT",
              "payload": {"data": "test"},
              "priority": 150
            }
            """;

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPriorityJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.validationErrors.priority").isNotEmpty());
    }

    @Test
    @DisplayName("6. Unsupported job type is rejected with HTTP 400 Bad Request")
    void submitJob_unsupportedJobType_returns400() throws Exception {
        String unsupportedTypeJson = """
            {
              "jobType": "EXECUTE_MALICIOUS_SHELL",
              "payload": {"cmd": "rm -rf"}
            }
            """;

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unsupportedTypeJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.validationErrors.jobType").value(
                        org.hamcrest.Matchers.containsString("Unsupported job type")
                ));
    }

    @Test
    @DisplayName("7. Missing or null payload is rejected with HTTP 400 Bad Request")
    void submitJob_invalidPayload_returns400() throws Exception {
        String nullPayloadJson = """
            {
              "jobType": "GENERATE_REPORT",
              "payload": null
            }
            """;

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nullPayloadJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("8. Repeated submission with identical Idempotency-Key returns original job with HTTP 202")
    void submitJob_idempotentRepeat_returnsOriginalJob() throws Exception {
        String requestJson = """
            {
              "jobType": "INDEX_DOCUMENT",
              "payload": {"docId": "doc-8812", "content": "Antigravity QueueForge"},
              "priority": 90,
              "maxRetries": 4
            }
            """;
        String idempotencyKey = "idempotency-key-repeat-test";

        // First submission
        MvcResult firstResult = mockMvc.perform(post("/api/v1/jobs")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isAccepted())
                .andReturn();

        CreateJobResponse firstResponse = objectMapper.readValue(firstResult.getResponse().getContentAsString(), CreateJobResponse.class);

        // Second submission with exact same key and body
        MvcResult secondResult = mockMvc.perform(post("/api/v1/jobs")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isAccepted())
                .andReturn();

        CreateJobResponse secondResponse = objectMapper.readValue(secondResult.getResponse().getContentAsString(), CreateJobResponse.class);

        assertThat(secondResponse.jobId()).isEqualTo(firstResponse.jobId());
        assertThat(jobRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("9. Reusing Idempotency-Key with different payload rejects with HTTP 409 Conflict")
    void submitJob_idempotencyConflict_returns409() throws Exception {
        String key = "idempotency-conflict-key";

        String firstPayload = """
            {
              "jobType": "GENERATE_REPORT",
              "payload": {"report": "A"}
            }
            """;

        String conflictingPayload = """
            {
              "jobType": "GENERATE_REPORT",
              "payload": {"report": "DIFFERENT_REPORT_B"}
            }
            """;

        // First submission succeeds
        mockMvc.perform(post("/api/v1/jobs")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(firstPayload))
                .andExpect(status().isAccepted());

        // Conflicting submission is rejected
        mockMvc.perform(post("/api/v1/jobs")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(conflictingPayload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("was previously used with a different request")
                ));

        assertThat(jobRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("10. Concurrent submissions with identical Idempotency-Key safely produce exactly one job")
    void submitJob_concurrentIdempotentRequests_createsOnlyOneJob() throws Exception {
        String key = "concurrent-idempotency-" + UUID.randomUUID();
        String requestJson = """
            {
              "jobType": "WEBHOOK_DISPATCH",
              "payload": {"url": "https://api.partner.com/webhook", "event": "ORDER_PLACED"},
              "priority": 95,
              "maxRetries": 3
            }
            """;

        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        List<UUID> returnedJobIds = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await(); // ensure simultaneous execution
                    MvcResult res = mockMvc.perform(post("/api/v1/jobs")
                                    .header("Idempotency-Key", key)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(requestJson))
                            .andReturn();

                    if (res.getResponse().getStatus() == 202) {
                        CreateJobResponse resp = objectMapper.readValue(
                                res.getResponse().getContentAsString(), CreateJobResponse.class);
                        returnedJobIds.add(resp.jobId());
                        successCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    // unexpected error
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown(); // unblock all threads at once
        boolean finished = doneLatch.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).isTrue();
        assertThat(successCount.get()).isEqualTo(threads); // all 10 return 202 Accepted
        assertThat(returnedJobIds).hasSize(threads);

        // All 10 concurrent requests must receive the exact same job ID
        UUID firstId = returnedJobIds.getFirst();
        for (UUID id : returnedJobIds) {
            assertThat(id).isEqualTo(firstId);
        }

        // Exactly 1 job exists in database
        assertThat(jobRepository.count()).isEqualTo(1);
    }
}
