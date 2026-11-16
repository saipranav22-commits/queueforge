package com.queueforge.service.retry;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.common.exception.PermanentJobException;
import com.queueforge.common.exception.TransientJobException;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.core.handler.JobExecutionContext;
import com.queueforge.core.handler.JobHandlerRegistry;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.service.AdminDlqService;
import com.queueforge.service.JobClaimService;
import com.queueforge.worker.WorkerCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false" // Manual coordination for deterministic test execution
})
class RetryAndDlqIntegrationTest {

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
        payload.put("action", "test-retry");

        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                jobType,
                payload,
                50,
                maxRetries,
                Instant.now().minusSeconds(1)
        );
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("1. Attempt and Retry Accounting: Initial claim produces attempt_count=1, retry_count=0")
    void initialClaim_attemptAndRetryAccounting() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);

        List<ClaimedJob> claimedList = claimService.claimJobs(1, 30, "worker-1");
        assertThat(claimedList).hasSize(1);

        ClaimedJob claimed = claimedList.getFirst();
        assertThat(claimed.attemptCount()).isEqualTo(1);
        assertThat(claimed.retryCount()).isEqualTo(0);

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getAttemptCount()).isEqualTo(1);
        assertThat(inDb.getRetryCount()).isEqualTo(0);
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.RUNNING);
    }

    @Test
    @DisplayName("2. Attempt and Retry Accounting: Subsequent retry produces attempt_count=2, retry_count=1")
    void subsequentRetryClaim_incrementsBothCounters() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);

        // Claim attempt 1
        ClaimedJob firstClaim = claimService.claimJobs(1, 30, "worker-1").getFirst();
        assertThat(firstClaim.attemptCount()).isEqualTo(1);
        assertThat(firstClaim.retryCount()).isEqualTo(0);

        // Fail attempt 1 with transient failure
        claimService.failJob(
                firstClaim.id(),
                firstClaim.claimToken(),
                firstClaim.attemptCount(),
                firstClaim.retryCount(),
                firstClaim.maxRetries(),
                FailureCategory.TRANSIENT_FAILURE,
                "Temporary timeout",
                null,
                100,
                "worker-1"
        );

        // Fast-forward scheduled_at so it can be claimed immediately for retry
        jdbcTemplate.update("UPDATE qf_jobs SET scheduled_at = CURRENT_TIMESTAMP WHERE id = ?", job.getId());

        // Claim retry 1 (attempt 2)
        List<ClaimedJob> secondClaimList = claimService.claimJobs(1, 30, "worker-2");
        assertThat(secondClaimList).hasSize(1);

        ClaimedJob secondClaim = secondClaimList.getFirst();
        assertThat(secondClaim.attemptCount()).isEqualTo(2);
        assertThat(secondClaim.retryCount()).isEqualTo(1);

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getAttemptCount()).isEqualTo(2);
        assertThat(inDb.getRetryCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("3. Transient failure applies exponential backoff into the future")
    void transientFailure_appliesFutureScheduledAt() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);
        ClaimedJob claimed = claimService.claimJobs(1, 30, "worker-1").getFirst();

        Instant beforeFail = Instant.now();
        claimService.failJob(
                claimed.id(),
                claimed.claimToken(),
                claimed.attemptCount(),
                claimed.retryCount(),
                claimed.maxRetries(),
                FailureCategory.TRANSIENT_FAILURE,
                "Temporary gateway 502",
                null,
                50,
                "worker-1"
        );

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(inDb.getFailureCategory()).isEqualTo(FailureCategory.TRANSIENT_FAILURE);
        // Next retry delay for retry 1 is ~5 seconds nominal (+/- jitter)
        assertThat(inDb.getScheduledAt()).isAfter(beforeFail.plusSeconds(3));
    }

    @Test
    @DisplayName("4. Exhausting retry budget transitions job to DEAD_LETTER")
    void exhaustedRetries_transitionsToDeadLetter() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 1); // maxRetries = 1 (up to 2 attempts total)

        // Attempt 1 (retry 0)
        ClaimedJob claim1 = claimService.claimJobs(1, 30, "worker-1").getFirst();
        claimService.failJob(claim1.id(), claim1.claimToken(), claim1.attemptCount(), claim1.retryCount(),
                claim1.maxRetries(), FailureCategory.TRANSIENT_FAILURE, "Fail 1", null, 10, "worker-1");

        jdbcTemplate.update("UPDATE qf_jobs SET scheduled_at = CURRENT_TIMESTAMP WHERE id = ?", job.getId());

        // Attempt 2 (retry 1 == maxRetries)
        ClaimedJob claim2 = claimService.claimJobs(1, 30, "worker-2").getFirst();
        assertThat(claim2.retryCount()).isEqualTo(1);

        // Fail attempt 2: retry budget exhausted!
        claimService.failJob(claim2.id(), claim2.claimToken(), claim2.attemptCount(), claim2.retryCount(),
                claim2.maxRetries(), FailureCategory.TRANSIENT_FAILURE, "Fail 2 (final)", null, 10, "worker-2");

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(inDb.getFailureCategory()).isEqualTo(FailureCategory.TRANSIENT_FAILURE);
        assertThat(inDb.getLastErrorMessage()).isEqualTo("Fail 2 (final)");
        assertThat(inDb.getClaimToken()).isNull();
    }

    @Test
    @DisplayName("5. PermanentJobException immediately routes to DEAD_LETTER without retrying")
    void permanentFailure_bypassesRetries() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 5); // 5 retries configured

        ClaimedJob claimed = claimService.claimJobs(1, 30, "worker-1").getFirst();
        assertThat(claimed.retryCount()).isEqualTo(0);

        // Permanent failure on very first execution
        claimService.failJob(
                claimed.id(),
                claimed.claimToken(),
                claimed.attemptCount(),
                claimed.retryCount(),
                claimed.maxRetries(),
                FailureCategory.PERMANENT_FAILURE,
                "Fatal format error: PDF schema unparseable",
                "com.queueforge.common.exception.PermanentJobException...",
                15,
                "worker-1"
        );

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(inDb.getFailureCategory()).isEqualTo(FailureCategory.PERMANENT_FAILURE);
        assertThat(inDb.getRetryCount()).isEqualTo(0); // Did NOT burn any retries!
        assertThat(inDb.getAttemptCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("6. Missing handler immediately routes to DEAD_LETTER with HANDLER_NOT_FOUND")
    void missingHandler_routesToDeadLetter() {
        JobEntity job = createPendingJob("UNKNOWN_JOB_TYPE", 3);

        ClaimedJob claimed = claimService.claimJobs(1, 30, "worker-1").getFirst();
        claimService.failJob(
                claimed.id(),
                claimed.claimToken(),
                claimed.attemptCount(),
                claimed.retryCount(),
                claimed.maxRetries(),
                FailureCategory.HANDLER_NOT_FOUND,
                "No registered handler found for job type: 'UNKNOWN_JOB_TYPE'",
                null,
                5,
                "worker-1"
        );

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(inDb.getFailureCategory()).isEqualTo(FailureCategory.HANDLER_NOT_FOUND);
    }

    @Test
    @DisplayName("7. Sweeper moves exhausted expired leases directly to DEAD_LETTER")
    void leaseSweeper_exhaustedLease_transitionsToDeadLetter() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 1);

        // Claim and simulate retry_count = 1 (budget exhausted)
        ClaimedJob claim = claimService.claimJobs(1, 30, "worker-crashed").getFirst();
        jdbcTemplate.update("UPDATE qf_jobs SET retry_count = 1, lease_until = CURRENT_TIMESTAMP - INTERVAL '10 seconds' WHERE id = ?", job.getId());

        int recovered = claimService.recoverExpiredLeases();
        assertThat(recovered).isEqualTo(1);

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(inDb.getFailureCategory()).isEqualTo(FailureCategory.LEASE_EXPIRED);
    }

    @Test
    @DisplayName("8. Active Lease Guard: Worker cannot complete job after lease has expired")
    void activeLeaseGuard_expiredLeaseFailsCompletion() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);
        ClaimedJob claim = claimService.claimJobs(1, 30, "worker-slow").getFirst();

        // Simulate lease expiration
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = ?", job.getId());

        boolean completed = claimService.completeJob(claim.id(), claim.claimToken(), claim.attemptCount(), 500, "worker-slow");
        assertThat(completed).isFalse();

        // Job status was NOT updated to COMPLETED
        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.RUNNING);
    }

    @Test
    @DisplayName("9. Active Lease Guard: Worker cannot fail job after lease has expired")
    void activeLeaseGuard_expiredLeaseFailsFailJob() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);
        ClaimedJob claim = claimService.claimJobs(1, 30, "worker-slow").getFirst();

        // Simulate lease expiration
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = ?", job.getId());

        boolean recorded = claimService.failJob(
                claim.id(),
                claim.claimToken(),
                claim.attemptCount(),
                claim.retryCount(),
                claim.maxRetries(),
                FailureCategory.TRANSIENT_FAILURE,
                "Late error",
                null,
                500,
                "worker-slow"
        );
        assertThat(recorded).isFalse();
    }

    @Test
    @DisplayName("10. Concurrent Replay Race Safety: Multiple concurrent replays result in exactly 1 transition")
    void concurrentReplay_raceSafety() throws Exception {
        JobEntity job = createPendingJob("GENERATE_REPORT", 3);
        // Put in DEAD_LETTER
        jdbcTemplate.update("UPDATE qf_jobs SET status = 'DEAD_LETTER', failure_category = 'TRANSIENT_FAILURE' WHERE id = ?", job.getId());

        int threads = 6;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    adminDlqService.replayDlqJob(job.getId());
                    successCount.incrementAndGet();
                } catch (IllegalStateException e) {
                    conflictCount.incrementAndGet();
                } catch (Exception e) {
                    // unexpected
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean finished = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).isTrue();
        // Exactly ONE thread should successfully transition from DEAD_LETTER to PENDING
        assertThat(successCount.get()).isEqualTo(1);
        // All other 5 threads should encounter IllegalStateException (409 Conflict equivalent)
        assertThat(conflictCount.get()).isEqualTo(threads - 1);

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.PENDING);
    }
}
