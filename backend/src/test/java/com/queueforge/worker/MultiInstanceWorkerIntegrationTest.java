package com.queueforge.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.config.AppMode;
import com.queueforge.config.QueueForgeProperties;
import com.queueforge.config.WorkerProperties;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.core.handler.JobHandlerRegistry;
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

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false" // Manual lifecycle control for multi-instance tests
})
class MultiInstanceWorkerIntegrationTest {

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JobHandlerRegistry handlerRegistry;

    @Autowired
    private WorkerProperties workerProperties;

    @Autowired
    private QueueForgeProperties queueForgeProperties;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
    }

    private JobEntity insertPendingJob(String type, int priority) {
        ObjectNode payload = objectMapper.createObjectNode().put("test", "data");
        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                type,
                payload,
                priority,
                3,
                Instant.now()
        );
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("Scenario 1: Two separate worker instances claim disjoint sets of pending jobs")
    void twoInstances_claimDifferentJobs_noOverlap() {
        // Enqueue 10 pending jobs
        for (int i = 0; i < 10; i++) {
            insertPendingJob("GENERATE_REPORT", 50);
        }

        String instanceA = "worker-instance-alpha";
        String instanceB = "worker-instance-beta";

        // Instance A claims batch of 5
        List<ClaimedJob> batchA = claimService.claimJobs(5, 30, instanceA);
        // Instance B claims batch of 5
        List<ClaimedJob> batchB = claimService.claimJobs(5, 30, instanceB);

        assertThat(batchA).hasSize(5);
        assertThat(batchB).hasSize(5);

        Set<UUID> idsA = new HashSet<>();
        batchA.forEach(j -> {
            idsA.add(j.id());
            assertThat(j.lockedBy()).isEqualTo(instanceA);
            assertThat(j.claimToken()).isNotNull();
        });

        Set<UUID> idsB = new HashSet<>();
        batchB.forEach(j -> {
            idsB.add(j.id());
            assertThat(j.lockedBy()).isEqualTo(instanceB);
            assertThat(j.claimToken()).isNotNull();
        });

        // Mutual exclusion verification (Invariant A & F)
        Set<UUID> intersection = new HashSet<>(idsA);
        intersection.retainAll(idsB);
        assertThat(intersection).as("Worker instances must never claim overlapping jobs").isEmpty();
    }

    @Test
    @DisplayName("Scenario 2: Invariant A - At most one active claim owner exists for a single job")
    void singleJob_cannotBeConcurrentlyClaimedByMultipleInstances() throws Exception {
        JobEntity job = insertPendingJob("GENERATE_REPORT", 100);

        int instances = 4;
        ExecutorService executor = Executors.newFixedThreadPool(instances);
        CountDownLatch startLatch = new CountDownLatch(1);
        List<Future<List<ClaimedJob>>> futures = new ArrayList<>();

        for (int i = 1; i <= instances; i++) {
            String instanceId = "worker-node-" + i;
            futures.add(executor.submit(() -> {
                startLatch.await();
                return claimService.claimJobs(1, 30, instanceId);
            }));
        }

        startLatch.countDown();
        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);

        int totalClaims = 0;
        String winningInstance = null;
        UUID winningToken = null;

        for (Future<List<ClaimedJob>> f : futures) {
            List<ClaimedJob> claimed = f.get();
            if (!claimed.isEmpty()) {
                totalClaims += claimed.size();
                winningInstance = claimed.get(0).lockedBy();
                winningToken = claimed.get(0).claimToken();
            }
        }

        assertThat(totalClaims).as("Exactly one worker instance should win the claim").isEqualTo(1);
        assertThat(winningInstance).isNotNull();
        assertThat(winningToken).isNotNull();

        // Verify database state matches the winning claim
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT locked_by, claim_token, claim_version, status FROM qf_jobs WHERE id = ?", job.getId());
        assertThat(row.get("locked_by")).isEqualTo(winningInstance);
        assertThat(row.get("claim_token")).isEqualTo(winningToken);
        assertThat(row.get("status")).isEqualTo("RUNNING");
        assertThat(((Number) row.get("claim_version")).longValue()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Scenario 3: One worker instance shuts down while another continues processing")
    void workerShutdown_doesNotAffectOtherWorkerInstance() {
        JobEntity jobA = insertPendingJob("GENERATE_REPORT", 50);
        JobEntity jobB = insertPendingJob("GENERATE_REPORT", 50);

        String worker1 = "worker-instance-1";
        String worker2 = "worker-instance-2";

        List<ClaimedJob> claimed1 = claimService.claimJobs(1, 30, worker1);
        List<ClaimedJob> claimed2 = claimService.claimJobs(1, 30, worker2);

        assertThat(claimed1).hasSize(1);
        assertThat(claimed2).hasSize(1);

        // Simulate worker 1 crashing/shutting down without completing its job
        // Worker 2 completes its job normally
        ClaimedJob jobForWorker2 = claimed2.get(0);
        boolean completed2 = claimService.completeJob(
                jobForWorker2.id(),
                jobForWorker2.claimToken(),
                jobForWorker2.jobType(),
                jobForWorker2.attemptCount(),
                150L,
                worker2 + ":thread-1"
        );

        assertThat(completed2).isTrue();

        // Verify Worker 2's job is COMPLETED, Worker 1's job is still RUNNING
        JobEntity dbJob2 = jobRepository.findById(jobForWorker2.id()).orElseThrow();
        assertThat(dbJob2.getStatus()).isEqualTo(JobStatus.COMPLETED);

        ClaimedJob jobForWorker1 = claimed1.get(0);
        JobEntity dbJob1 = jobRepository.findById(jobForWorker1.id()).orElseThrow();
        assertThat(dbJob1.getStatus()).isEqualTo(JobStatus.RUNNING);
        assertThat(dbJob1.getLockedBy()).isEqualTo(worker1);
    }

    @Test
    @DisplayName("Scenario 4 & 5: Lease expiration, recovery across instances, and stale token rejection")
    void leaseExpiration_recoveredByAnotherInstance_staleTokenFencedOut() {
        JobEntity job = insertPendingJob("GENERATE_REPORT", 50);
        String worker1 = "worker-instance-crashed";
        String worker2 = "worker-instance-recovery";

        // 1. Worker 1 claims job with 1-second lease
        List<ClaimedJob> claimed1 = claimService.claimJobs(1, 1, worker1);
        assertThat(claimed1).hasSize(1);
        ClaimedJob originalClaim = claimed1.get(0);
        UUID staleToken = originalClaim.claimToken();

        // 2. Force lease to expire in database
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '5 seconds' WHERE id = ?", job.getId());

        // 3. Worker 2 (or sweeper) runs recovery
        int recovered = claimService.recoverExpiredLeases();
        assertThat(recovered).isEqualTo(1);

        JobEntity recoveredJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(recoveredJob.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(recoveredJob.getClaimToken()).isNull();
        assertThat(recoveredJob.getLockedBy()).isNull();

        // 4. Invariant B: Crashed Worker 1 wakes up and attempts to complete with stale token -> FENCED OUT!
        boolean lateCompletion = claimService.completeJob(
                job.getId(),
                staleToken,
                "GENERATE_REPORT",
                originalClaim.attemptCount(),
                5000L,
                worker1
        );
        assertThat(lateCompletion).as("Stale token must be rejected").isFalse();

        // 5. Worker 2 claims the newly pending job and completes it successfully
        List<ClaimedJob> claimed2 = claimService.claimJobs(1, 30, worker2);
        assertThat(claimed2).hasSize(1);
        ClaimedJob secondClaim = claimed2.get(0);
        assertThat(secondClaim.claimToken()).isNotEqualTo(staleToken);
        assertThat(secondClaim.claimVersion()).isEqualTo(2L);

        boolean secondCompletion = claimService.completeJob(
                secondClaim.id(),
                secondClaim.claimToken(),
                secondClaim.jobType(),
                secondClaim.attemptCount(),
                120L,
                worker2
        );
        assertThat(secondCompletion).isTrue();

        JobEntity finalJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(finalJob.getStatus()).isEqualTo(JobStatus.COMPLETED);
    }

    @Test
    @DisplayName("Scenario 6: Concurrent claim behavior under heavy load across 8 simulated worker threads")
    void heavyConcurrentLoad_allJobsClaimedWithoutContention() throws Exception {
        int jobCount = 40;
        for (int i = 0; i < jobCount; i++) {
            insertPendingJob("GENERATE_REPORT", 50);
        }

        int workerCount = 8;
        ExecutorService executor = Executors.newFixedThreadPool(workerCount);
        CountDownLatch latch = new CountDownLatch(1);
        ConcurrentLinkedQueue<ClaimedJob> allClaimed = new ConcurrentLinkedQueue<>();

        for (int w = 1; w <= workerCount; w++) {
            final String workerId = "worker-cluster-node-" + w;
            executor.submit(() -> {
                try {
                    latch.await();
                    // Each worker attempts to claim jobs until queue empty
                    while (true) {
                        List<ClaimedJob> batch = claimService.claimJobs(5, 30, workerId);
                        if (batch.isEmpty()) {
                            break;
                        }
                        allClaimed.addAll(batch);
                    }
                } catch (Exception ignored) {
                }
            });
        }

        latch.countDown();
        executor.shutdown();
        executor.awaitTermination(10, TimeUnit.SECONDS);

        assertThat(allClaimed).hasSize(jobCount);

        // Verify zero duplicates
        Set<UUID> uniqueIds = new HashSet<>();
        for (ClaimedJob cj : allClaimed) {
            assertThat(uniqueIds.add(cj.id()))
                    .as("Job %s was claimed more than once", cj.id())
                    .isTrue();
        }

        // Verify database state: all 40 are RUNNING
        Integer runningCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_jobs WHERE status = 'RUNNING'", Integer.class);
        assertThat(runningCount).isEqualTo(jobCount);
    }

    @Test
    @DisplayName("Scenario 7: Priority behavior across worker instances")
    void priorityOrdering_respectedAcrossInstances() {
        JobEntity low = insertPendingJob("GENERATE_REPORT", 10);
        JobEntity med = insertPendingJob("GENERATE_REPORT", 50);
        JobEntity high = insertPendingJob("GENERATE_REPORT", 90);

        String workerA = "worker-instance-prio-A";
        String workerB = "worker-instance-prio-B";

        // Instance A claims 1 job -> should get priority 90
        List<ClaimedJob> claimA = claimService.claimJobs(1, 30, workerA);
        assertThat(claimA).hasSize(1);
        assertThat(claimA.get(0).id()).isEqualTo(high.getId());

        // Instance B claims 1 job -> should get priority 50
        List<ClaimedJob> claimB = claimService.claimJobs(1, 30, workerB);
        assertThat(claimB).hasSize(1);
        assertThat(claimB.get(0).id()).isEqualTo(med.getId());

        // Next claim gets priority 10
        List<ClaimedJob> claimRemaining = claimService.claimJobs(1, 30, workerA);
        assertThat(claimRemaining).hasSize(1);
        assertThat(claimRemaining.get(0).id()).isEqualTo(low.getId());
    }

    @Test
    @DisplayName("Scenario 8: Independent worker heartbeat extension")
    void heartbeatExtension_extendsLeaseSafely() {
        JobEntity job = insertPendingJob("GENERATE_REPORT", 50);
        String workerId = "worker-node-heartbeat";

        List<ClaimedJob> claimed = claimService.claimJobs(1, 10, workerId);
        assertThat(claimed).hasSize(1);
        ClaimedJob cj = claimed.get(0);

        Instant initialLease = cj.leaseUntil();

        // Extend lease by 60 seconds
        boolean extended = claimService.extendLease(cj.id(), cj.claimToken(), 60, workerId);
        assertThat(extended).isTrue();

        Instant updatedLease = jdbcTemplate.queryForObject(
                "SELECT lease_until FROM qf_jobs WHERE id = ?",
                (rs, rowNum) -> rs.getTimestamp("lease_until").toInstant(),
                cj.id()
        );

        assertThat(updatedLease).isAfter(initialLease);
    }

    @Test
    @DisplayName("Scenario 9: Application Mode enforcement and identity properties")
    void appModeProperties_correctlyReflectRoles() {
        QueueForgeProperties props = new QueueForgeProperties();

        props.setMode(AppMode.COMBINED);
        assertThat(props.isApiActive()).isTrue();
        assertThat(props.isWorkerActive()).isTrue();

        props.setMode(AppMode.API_ONLY);
        assertThat(props.isApiActive()).isTrue();
        assertThat(props.isWorkerActive()).isFalse();

        props.setMode(AppMode.WORKER_ONLY);
        assertThat(props.isApiActive()).isFalse();
        assertThat(props.isWorkerActive()).isTrue();

        props.setInstanceId("custom-worker-node-42");
        assertThat(props.getInstanceId()).isEqualTo("custom-worker-node-42");
    }

    @Test
    @DisplayName("Scenario 10: Invariant D - Bounded retry budget transitions directly to DEAD_LETTER on lease recovery")
    void leaseRecovery_withExhaustedRetries_transitionsDirectlyToDeadLetter() {
        // Create a job with attempt=3, retry=3, maxRetries=3
        JobEntity job = insertPendingJob("GENERATE_REPORT", 50);
        String workerId = "worker-node-exhausted";

        // Claim and simulate 3 retries
        List<ClaimedJob> claimed = claimService.claimJobs(1, 1, workerId);
        assertThat(claimed).hasSize(1);

        // Manually exhaust retry count to maxRetries (3) and set lease_until in past
        jdbcTemplate.update("""
            UPDATE qf_jobs
            SET retry_count = 3,
                max_retries = 3,
                lease_until = CURRENT_TIMESTAMP - INTERVAL '10 seconds'
            WHERE id = ?
            """, job.getId());

        // Run recovery sweeper
        int recovered = claimService.recoverExpiredLeases();
        assertThat(recovered).isEqualTo(1);

        // Verify transitioned directly to DEAD_LETTER (Invariant D)
        JobEntity recoveredJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(recoveredJob.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(recoveredJob.getFailureCategory()).isEqualTo(FailureCategory.LEASE_EXPIRED);
        assertThat(recoveredJob.getClaimToken()).isNull();
    }
}
