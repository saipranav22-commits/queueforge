package com.queueforge.worker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.service.JobClaimService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class JobClaimServiceIntegrationTest {

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    private JobEntity createPendingJob(String jobType, int priority, Instant scheduledAt) {
        JsonNode payload = objectMapper.createObjectNode().put("test", "data-" + UUID.randomUUID());
        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fingerprint-" + UUID.randomUUID(),
                jobType,
                payload,
                priority,
                3,
                scheduledAt
        );
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("1. A PENDING job is claimed successfully")
    void pendingJob_isClaimedSuccessfully() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(5));

        List<ClaimedJob> claimed = claimService.claimJobs(1, 30, "test-worker-1");

        assertThat(claimed).hasSize(1);
        ClaimedJob claimedJob = claimed.getFirst();
        assertThat(claimedJob.id()).isEqualTo(job.getId());
        assertThat(claimedJob.claimToken()).isNotNull();
        assertThat(claimedJob.claimVersion()).isGreaterThanOrEqualTo(1);
        assertThat(claimedJob.lockedBy()).isEqualTo("test-worker-1");
    }

    @Test
    @DisplayName("2. A claimed job transitions to RUNNING in PostgreSQL")
    void claimedJob_transitionsToRunning() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 60, Instant.now().minusSeconds(2));

        List<ClaimedJob> claimed = claimService.claimJobs(1, 30, "test-worker-2");
        assertThat(claimed).hasSize(1);

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.RUNNING);
        assertThat(inDb.getClaimToken()).isEqualTo(claimed.getFirst().claimToken());
        assertThat(inDb.getLeaseUntil()).isAfter(Instant.now());
        assertThat(inDb.getAttemptCount()).isEqualTo(1);
        assertThat(inDb.getRetryCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("3. A successful handler transitions the job to COMPLETED with execution log")
    void successfulCompletion_transitionsToCompleted() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 70, Instant.now().minusSeconds(5));
        ClaimedJob claimed = claimService.claimJobs(1, 30, "test-worker-3").getFirst();

        boolean completed = claimService.completeJob(claimed.id(), claimed.claimToken(), claimed.retryCount(), 120, "test-worker-3");

        assertThat(completed).isTrue();

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(inDb.getCompletedAt()).isNotNull();
        assertThat(inDb.getLeaseUntil()).isNull();
        assertThat(inDb.getLockedBy()).isNull();

        Integer logCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_job_execution_logs WHERE job_id = ? AND status = 'COMPLETED'",
                Integer.class,
                job.getId()
        );
        assertThat(logCount).isEqualTo(1);
    }

    @Test
    @DisplayName("4. Multiple workers claim different jobs concurrently without duplicate ownership")
    void concurrentClaiming_noDuplicateOwnership() throws Exception {
        int totalJobs = 20;
        for (int i = 0; i < totalJobs; i++) {
            createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(1));
        }

        int workerCount = 5;
        int batchSize = 4;
        ExecutorService executor = Executors.newFixedThreadPool(workerCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(workerCount);

        List<UUID> allClaimedJobIds = Collections.synchronizedList(new ArrayList<>());
        Set<UUID> allClaimTokens = Collections.synchronizedSet(new HashSet<>());

        for (int w = 0; w < workerCount; w++) {
            final String workerId = "concurrent-worker-" + w;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    List<ClaimedJob> claimed = claimService.claimJobs(batchSize, 30, workerId);
                    for (ClaimedJob cj : claimed) {
                        allClaimedJobIds.add(cj.id());
                        allClaimTokens.add(cj.claimToken());
                    }
                } catch (Exception e) {
                    // unexpected error
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        assertThat(allClaimedJobIds).hasSize(totalJobs);

        // Crucial: Exactly 20 distinct IDs claimed — zero duplicates!
        Set<UUID> uniqueJobIds = new HashSet<>(allClaimedJobIds);
        assertThat(uniqueJobIds).hasSize(totalJobs);
        assertThat(allClaimTokens).hasSize(totalJobs);
    }

    @Test
    @DisplayName("5. A higher priority job is preferred when eligible")
    void priorityOrdering_claimsHighestPriorityFirst() {
        createPendingJob("GENERATE_REPORT", 10, Instant.now().minusSeconds(10));
        JobEntity highPriority = createPendingJob("GENERATE_REPORT", 95, Instant.now().minusSeconds(5));
        createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(8));

        List<ClaimedJob> claimed = claimService.claimJobs(1, 30, "priority-worker");

        assertThat(claimed).hasSize(1);
        assertThat(claimed.getFirst().id()).isEqualTo(highPriority.getId());
        assertThat(claimed.getFirst().priority()).isEqualTo(95);
    }

    @Test
    @DisplayName("6. A delayed job is not claimed early")
    void delayedJob_isNotClaimedEarly() {
        createPendingJob("GENERATE_REPORT", 90, Instant.now().plusSeconds(120)); // Future

        List<ClaimedJob> claimed = claimService.claimJobs(5, 30, "delay-worker");

        assertThat(claimed).isEmpty();

        JobEntity inDb = jobRepository.findAll().getFirst();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.PENDING);
    }

    @Test
    @DisplayName("7. A failed handler records failure attempt and does not terminate other workers")
    void failedHandler_recordsFailureAttempt() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(5));
        ClaimedJob claimed = claimService.claimJobs(1, 30, "fail-worker").getFirst();

        boolean failedRecorded = claimService.failJob(
                claimed.id(),
                claimed.claimToken(),
                claimed.attemptCount(),
                claimed.retryCount(),
                claimed.maxRetries(),
                FailureCategory.TRANSIENT_FAILURE,
                "Simulated error: remote service down",
                "java.lang.RuntimeException: remote service down\n\tat com.test...",
                250,
                "fail-worker"
        );

        assertThat(failedRecorded).isTrue();

        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.PENDING); // Scheduled for retry in this phase
        assertThat(inDb.getLastErrorMessage()).contains("Simulated error: remote service down");
        assertThat(inDb.getLeaseUntil()).isNull();
        assertThat(inDb.getLockedBy()).isNull();

        Integer logCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_job_execution_logs WHERE job_id = ? AND status = 'FAILED'",
                Integer.class,
                job.getId()
        );
        assertThat(logCount).isEqualTo(1);
    }

    @Test
    @DisplayName("8. A stale ownership token cannot complete a job (Fencing Protection)")
    void staleOwnershipToken_cannotCompleteJob() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(5));
        ClaimedJob originalClaim = claimService.claimJobs(1, 30, "worker-1").getFirst();

        UUID staleToken = UUID.randomUUID(); // Different token from active claim_token

        boolean completed = claimService.completeJob(
                originalClaim.id(),
                staleToken,
                1,
                100,
                "worker-1"
        );

        assertThat(completed).isFalse();

        // Job status remains RUNNING under original claim
        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.RUNNING);
        assertThat(inDb.getClaimToken()).isEqualTo(originalClaim.claimToken());
    }

    @Test
    @DisplayName("9. An expired lease can be recovered and reclaimed")
    void expiredLease_isRecoveredAndReclaimed() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(5));
        ClaimedJob firstClaim = claimService.claimJobs(1, 30, "worker-crashed").getFirst();

        // Simulate lease expiration by setting lease_until in the past
        jdbcTemplate.update(
                "UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '10 seconds' WHERE id = ?",
                job.getId()
        );

        int recoveredCount = claimService.recoverExpiredLeases();
        assertThat(recoveredCount).isEqualTo(1);

        JobEntity recoveredJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(recoveredJob.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(recoveredJob.getClaimToken()).isNull();
        assertThat(recoveredJob.getLockedBy()).isNull();
        assertThat(recoveredJob.getLeaseUntil()).isNull();

        // Reclaim by a surviving worker
        List<ClaimedJob> secondClaim = claimService.claimJobs(1, 30, "worker-survivor");
        assertThat(secondClaim).hasSize(1);
        assertThat(secondClaim.getFirst().id()).isEqualTo(job.getId());
        assertThat(secondClaim.getFirst().claimToken()).isNotEqualTo(firstClaim.claimToken());
        assertThat(secondClaim.getFirst().attemptCount()).isEqualTo(2); // Attempt count increased
        assertThat(secondClaim.getFirst().retryCount()).isEqualTo(1); // First retry
    }

    @Test
    @DisplayName("10. A stale worker cannot overwrite a reclaimed and completed job")
    void staleWorker_cannotOverwriteReclaimedJob() {
        JobEntity job = createPendingJob("GENERATE_REPORT", 50, Instant.now().minusSeconds(5));
        ClaimedJob oldClaim = claimService.claimJobs(1, 30, "worker-slow").getFirst();

        // Lease expires and recovery sweeper resets to PENDING
        jdbcTemplate.update(
                "UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '5 seconds' WHERE id = ?",
                job.getId()
        );
        claimService.recoverExpiredLeases();

        // Fast worker claims and completes the job
        ClaimedJob newClaim = claimService.claimJobs(1, 30, "worker-fast").getFirst();
        boolean fastCompleted = claimService.completeJob(newClaim.id(), newClaim.claimToken(), newClaim.retryCount(), 80, "worker-fast");
        assertThat(fastCompleted).isTrue();

        // Slow worker finally wakes up and attempts to complete with its old claimToken
        boolean slowCompleted = claimService.completeJob(oldClaim.id(), oldClaim.claimToken(), oldClaim.retryCount(), 5000, "worker-slow");
        assertThat(slowCompleted).isFalse();

        // Database status remains COMPLETED from worker-fast
        JobEntity inDb = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(inDb.getStatus()).isEqualTo(JobStatus.COMPLETED);
    }

    @Test
    @DisplayName("11. Multi-worker stress test with 100 jobs verifying transactional claiming and unique ownership")
    void multiWorkerStressTest_100Jobs() throws Exception {
        int jobCount = 100;
        for (int i = 0; i < jobCount; i++) {
            createPendingJob("GENERATE_REPORT", (i % 100) + 1, Instant.now().minusSeconds(1));
        }

        int workerThreads = 8;
        ExecutorService executor = Executors.newFixedThreadPool(workerThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(workerThreads);

        AtomicInteger totalProcessed = new AtomicInteger(0);

        for (int w = 0; w < workerThreads; w++) {
            final String workerId = "stress-worker-" + w;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    while (true) {
                        List<ClaimedJob> claimed = claimService.claimJobs(5, 30, workerId);
                        if (claimed.isEmpty()) {
                            // Check if any PENDING jobs remain
                            Integer remaining = jdbcTemplate.queryForObject(
                                    "SELECT COUNT(*) FROM qf_jobs WHERE status = 'PENDING'", Integer.class);
                            if (remaining == null || remaining == 0) {
                                break;
                            }
                            Thread.sleep(20);
                            continue;
                        }

                        for (ClaimedJob job : claimed) {
                            // Simulate small work
                            Thread.sleep(5);
                            boolean ok = claimService.completeJob(job.id(), job.claimToken(), job.retryCount(), 10, workerId);
                            if (ok) {
                                totalProcessed.incrementAndGet();
                            }
                        }
                    }
                } catch (Exception e) {
                    // test error
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        assertThat(totalProcessed.get()).isEqualTo(jobCount);

        // Verification queries on PostgreSQL
        Integer completedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_jobs WHERE status = 'COMPLETED'", Integer.class);
        Integer runningCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_jobs WHERE status = 'RUNNING'", Integer.class);
        Integer pendingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_jobs WHERE status = 'PENDING'", Integer.class);
        Integer distinctLoggedJobs = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT job_id) FROM qf_job_execution_logs WHERE status = 'COMPLETED'", Integer.class);

        assertThat(completedCount).isEqualTo(100);
        assertThat(runningCount).isEqualTo(0);
        assertThat(pendingCount).isEqualTo(0);
        assertThat(distinctLoggedJobs).isEqualTo(100);
    }
}
