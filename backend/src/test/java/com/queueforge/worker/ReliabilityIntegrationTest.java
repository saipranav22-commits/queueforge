package com.queueforge.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.common.exception.TransientJobException;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.core.handler.JobExecutionContext;
import com.queueforge.core.handler.JobHandler;
import com.queueforge.core.handler.JobHandlerRegistry;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.service.AdminDlqService;
import com.queueforge.service.JobClaimService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false" // Manual step-by-step dispatch for absolute determinism
})
class ReliabilityIntegrationTest {

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private AdminDlqService adminDlqService;

    @Autowired
    private JobHandlerRegistry handlerRegistry;

    @Autowired
    private WorkerCoordinator coordinator;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    private JobEntity createPendingJob(String jobType, int maxRetries) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("test", "reliability");

        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                jobType,
                payload,
                50,
                maxRetries,
                Instant.now().minusSeconds(60)
        );
        return jobRepository.saveAndFlush(job);
    }

    @Test
    @DisplayName("Reliability Area A: Strict Lease Fencing prevents stale worker from completing, failing or extending")
    void leaseFencing_strictNonNullableUnexpiredRequirement() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);
        ClaimedJob claim = claimService.claimJobs(1, 30, "worker-fenced").getFirst();

        // 1. Manually expire the lease
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = ?", job.getId());

        // Worker attempts to complete -> Must be fenced out!
        boolean completeResult = claimService.completeJob(claim.id(), claim.claimToken(), 1, 100L, "worker-fenced");
        assertThat(completeResult).isFalse();

        // Worker attempts to record failure -> Must be fenced out!
        boolean failResult = claimService.failJob(
                claim.id(), claim.claimToken(), claim.attemptCount(), claim.retryCount(), claim.maxRetries(),
                FailureCategory.TRANSIENT_FAILURE, "Late failure", null, 100L, "worker-fenced"
        );
        assertThat(failResult).isFalse();

        // Worker attempts to extend lease -> Must be fenced out!
        boolean extendResult = claimService.extendLease(claim.id(), claim.claimToken(), 30, "worker-fenced");
        assertThat(extendResult).isFalse();

        // 2. Also verify if lease_until is explicitly set to NULL (e.g. after recovery or replay), worker cannot write
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = NULL WHERE id = ?", job.getId());

        boolean completeWithNullLease = claimService.completeJob(claim.id(), claim.claimToken(), 1, 100L, "worker-fenced");
        assertThat(completeWithNullLease).isFalse();

        // Verify status was never corrupted from RUNNING
        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.RUNNING);
    }

    @Test
    @DisplayName("Reliability Area B: Recoverable DLQ Replay drives job from DEAD_LETTER to COMPLETED")
    void recoverableDlqReplay_eventuallyReachesCompleted() {
        // Create job that failed into DEAD_LETTER
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);
        jdbcTemplate.update("""
            UPDATE qf_jobs
            SET status = 'DEAD_LETTER',
                failure_category = 'TRANSIENT_FAILURE',
                last_error_message = 'Simulated prior failure before admin replay',
                claim_token = NULL,
                locked_by = NULL,
                lease_until = NULL
            WHERE id = ?
            """, job.getId());

        // 1. Admin triggers replay
        adminDlqService.replayDlqJob(job.getId());

        JobEntity afterReplay = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(afterReplay.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(afterReplay.getAttemptCount()).isEqualTo(0);
        assertThat(afterReplay.getRetryCount()).isEqualTo(0);
        assertThat(afterReplay.getLastErrorMessage()).isNull();

        // 2. Worker claims replayed job
        List<ClaimedJob> claimedList = claimService.claimJobs(1, 30, "worker-recovery");
        assertThat(claimedList).hasSize(1);
        ClaimedJob claimed = claimedList.getFirst();
        assertThat(claimed.id()).isEqualTo(job.getId());
        assertThat(claimed.attemptCount()).isEqualTo(1);
        assertThat(claimed.retryCount()).isEqualTo(0);

        // 3. Worker executes handler and completes
        boolean completed = claimService.completeJob(claimed.id(), claimed.claimToken(), "GENERATE_REPORT", claimed.attemptCount(), 45L, "worker-recovery");
        assertThat(completed).isTrue();

        // 4. Verification: The job is truly COMPLETED, not just left in PENDING
        JobEntity finalState = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(finalState.getStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(finalState.getCompletedAt()).isNotNull();
        assertThat(finalState.getCompletedAt()).isAfterOrEqualTo(afterReplay.getUpdatedAt());
    }

    @Test
    @DisplayName("Reliability Area B: Unrecoverable DLQ Replay (missing handler) transitions back to DEAD_LETTER, not false success")
    void unrecoverableDlqReplay_returnsToDeadLetter() {
        JobEntity job = createPendingJob("MISSING_HANDLER_TYPE", 2);
        jdbcTemplate.update("UPDATE qf_jobs SET status = 'DEAD_LETTER', failure_category = 'HANDLER_NOT_FOUND' WHERE id = ?", job.getId());

        // Admin replays
        adminDlqService.replayDlqJob(job.getId());

        // Worker claims
        ClaimedJob claimed = claimService.claimJobs(1, 30, "worker-recovery").getFirst();

        // No handler registered -> failJob with HANDLER_NOT_FOUND
        claimService.failJob(
                claimed.id(), claimed.claimToken(), "MISSING_HANDLER_TYPE",
                claimed.attemptCount(), claimed.retryCount(), claimed.maxRetries(),
                FailureCategory.HANDLER_NOT_FOUND, "No handler registered", null, 5L, "worker-recovery"
        );

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(inDb.getFailureCategory()).isEqualTo(FailureCategory.HANDLER_NOT_FOUND);
    }

    @Test
    @DisplayName("Reliability Area C: Deterministic Transient Recovery: PENDING -> RUNNING -> RETRY -> RUNNING -> COMPLETED")
    void transientRecovery_fullLifecycleProgression() throws Exception {
        String testJobType = "FLAKY_TRANSIENT_JOB";
        AtomicInteger executions = new AtomicInteger(0);

        // Register custom test handler: fails on attempt 1, succeeds on attempt 2
        JobHandler flakyHandler = new JobHandler() {
            @Override
            public String getJobType() {
                return testJobType;
            }

            @Override
            public void handle(JobExecutionContext context) {
                int run = executions.incrementAndGet();
                if (run == 1) {
                    throw new TransientJobException("Transient network timeout on attempt 1");
                }
                // Attempt 2 succeeds
            }
        };
        handlerRegistry.register(flakyHandler);

        // Step 1: Create job in PENDING
        JobEntity job = createPendingJob(testJobType, 3);
        Instant t0 = job.getCreatedAt();
        assertThat(job.getStatus()).isEqualTo(JobStatus.PENDING);

        // Step 2: Worker claims Attempt 1
        ClaimedJob claim1 = claimService.claimJobs(1, 30, "worker-1").getFirst();
        assertThat(claim1.attemptCount()).isEqualTo(1);
        assertThat(claim1.retryCount()).isEqualTo(0);

        // Execute attempt 1 -> throws TransientJobException
        try {
            flakyHandler.handle(new JobExecutionContext(claim1.id(), claim1.jobType(), claim1.payload(), claim1.claimToken(), 1, "worker-1"));
        } catch (TransientJobException ex) {
            claimService.failJob(
                    claim1.id(), claim1.claimToken(), claim1.jobType(),
                    claim1.attemptCount(), claim1.retryCount(), claim1.maxRetries(),
                    FailureCategory.TRANSIENT_FAILURE, ex.getMessage(), null, 25L, "worker-1"
            );
        }

        // Verify status after attempt 1 failure: PENDING with future scheduled_at
        JobEntity stateAfterAttempt1 = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(stateAfterAttempt1.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(stateAfterAttempt1.getFailureCategory()).isEqualTo(FailureCategory.TRANSIENT_FAILURE);
        assertThat(stateAfterAttempt1.getScheduledAt()).isAfter(t0);

        // Step 3: Fast-forward scheduled_at to simulate backoff elapse
        jdbcTemplate.update("UPDATE qf_jobs SET scheduled_at = CURRENT_TIMESTAMP WHERE id = ?", job.getId());

        // Step 4: Worker claims Attempt 2 (First Retry)
        ClaimedJob claim2 = claimService.claimJobs(1, 30, "worker-2").getFirst();
        assertThat(claim2.attemptCount()).isEqualTo(2);
        assertThat(claim2.retryCount()).isEqualTo(1);

        // Execute attempt 2 -> succeeds!
        flakyHandler.handle(new JobExecutionContext(claim2.id(), claim2.jobType(), claim2.payload(), claim2.claimToken(), 2, "worker-2"));
        boolean completed = claimService.completeJob(claim2.id(), claim2.claimToken(), claim2.jobType(), claim2.attemptCount(), 30L, "worker-2");
        assertThat(completed).isTrue();

        // Step 5: Verify final state
        JobEntity finalState = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(finalState.getStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(finalState.getAttemptCount()).isEqualTo(2);
        assertThat(finalState.getRetryCount()).isEqualTo(1);
        assertThat(finalState.getCompletedAt()).isNotNull();
        assertThat(finalState.getCompletedAt()).isAfter(t0);
        assertThat(executions.get()).isEqualTo(2);
    }
}
