package com.queueforge.worker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.core.handler.JobExecutionContext;
import com.queueforge.core.handler.JobHandler;
import com.queueforge.core.handler.JobHandlerRegistry;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestPropertySource(properties = {
        "queueforge.worker.enabled=true",
        "queueforge.worker.concurrency=2",
        "queueforge.worker.poll-interval-ms=100",
        "queueforge.worker.lease-duration-seconds=10",
        "queueforge.worker.recovery-poll-interval-ms=500"
})
class WorkerCoordinatorIntegrationTest {

    @Autowired
    private WorkerCoordinator coordinator;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JobHandlerRegistry handlerRegistry;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    private JobEntity createPendingJob(String jobType, int priority, JsonNode payload) {
        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fingerprint-" + UUID.randomUUID(),
                jobType,
                payload,
                priority,
                3,
                Instant.now().minusSeconds(1)
        );
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("Worker concurrency never exceeds configured capacity (concurrency=2)")
    void workerConcurrency_neverExceedsConfiguredCapacity() throws Exception {
        int maxConcurrency = coordinator.getPoolCapacity();
        assertThat(maxConcurrency).isEqualTo(2);

        CountDownLatch blockingLatch = new CountDownLatch(1);
        CountDownLatch enteredLatch = new CountDownLatch(2);
        AtomicInteger maxObservedConcurrency = new AtomicInteger(0);
        AtomicInteger activeHandlers = new AtomicInteger(0);

        // Register a temporary test handler that blocks
        handlerRegistry.register(new JobHandler() {
            @Override
            public String getJobType() {
                return "CONCURRENCY_TEST_BLOCK";
            }

            @Override
            public void handle(JobExecutionContext context) throws Exception {
                int active = activeHandlers.incrementAndGet();
                maxObservedConcurrency.accumulateAndGet(active, Math::max);
                enteredLatch.countDown();

                // Block until released by test
                blockingLatch.await(5, TimeUnit.SECONDS);
                activeHandlers.decrementAndGet();
            }
        });

        JsonNode payload = objectMapper.createObjectNode();
        // Submit 4 jobs to a pool with capacity 2
        for (int i = 0; i < 4; i++) {
            createPendingJob("CONCURRENCY_TEST_BLOCK", 50, payload);
        }

        // Wait for 2 handlers to be actively running
        boolean reachedTwo = enteredLatch.await(5, TimeUnit.SECONDS);
        assertThat(reachedTwo).isTrue();

        // Concurrency should be exactly 2 and never exceed capacity of 2
        assertThat(maxObservedConcurrency.get()).isLessThanOrEqualTo(2);
        assertThat(coordinator.getActiveWorkerCount()).isLessThanOrEqualTo(2);

        // Unblock handlers so tasks complete cleanly
        blockingLatch.countDown();
    }

    @Test
    @DisplayName("Unhandled job types are safely failed and never remain indefinitely RUNNING")
    void unhandledJobType_isFailedAndDoesNotRemainRunning() throws Exception {
        JsonNode payload = objectMapper.createObjectNode().put("email", "test@test.com");
        // SEND_EMAIL has no handler registered in Phase 2A
        JobEntity job = createPendingJob("SEND_EMAIL", 50, payload);

        // Wait up to 5 seconds for coordinator to poll and process
        JobEntity processed = null;
        for (int i = 0; i < 50; i++) {
            Thread.sleep(100);
            JobEntity check = jobRepository.findById(job.getId()).orElse(null);
            if (check != null && check.getStatus() != JobStatus.PENDING && check.getStatus() != JobStatus.RUNNING) {
                processed = check;
                break;
            }
        }

        assertThat(processed).isNotNull();
        // Unhandled job types must be routed to DEAD_LETTER and never remain RUNNING
        assertThat(processed.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(processed.getLastErrorMessage()).contains("No registered handler found for job type: 'SEND_EMAIL'");

        // Attempt logged in execution logs
        Integer logCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_job_execution_logs WHERE job_id = ? AND status = 'FAILED'",
                Integer.class,
                job.getId()
        );
        assertThat(logCount).isEqualTo(1);
    }

    @Test
    @DisplayName("Demonstration GENERATE_REPORT job executes end-to-end via coordinator to COMPLETED")
    void demonstrationJob_completesEndToEnd() throws Exception {
        JsonNode payload = objectMapper.createObjectNode()
                .put("reportName", "e2e-summary-report")
                .put("format", "PDF");

        JobEntity job = createPendingJob("GENERATE_REPORT", 80, payload);

        // Await coordinator execution
        JobEntity completedJob = null;
        for (int i = 0; i < 50; i++) {
            Thread.sleep(100);
            JobEntity check = jobRepository.findById(job.getId()).orElse(null);
            if (check != null && check.getStatus() == JobStatus.COMPLETED) {
                completedJob = check;
                break;
            }
        }

        assertThat(completedJob).isNotNull();
        assertThat(completedJob.getStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(completedJob.getCompletedAt()).isNotNull();

        Integer logCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_job_execution_logs WHERE job_id = ? AND status = 'COMPLETED'",
                Integer.class,
                job.getId()
        );
        assertThat(logCount).isEqualTo(1);
    }
}
