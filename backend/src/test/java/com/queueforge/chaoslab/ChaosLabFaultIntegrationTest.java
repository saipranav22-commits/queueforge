package com.queueforge.chaoslab;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
        "queueforge.worker.enabled=false"
})
class ChaosLabFaultIntegrationTest {

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs WHERE worker_id LIKE 'chaos-%'");
        jdbcTemplate.execute("DELETE FROM qf_jobs WHERE job_type = 'CHAOS_TEST'");
    }

    private JobEntity insertTestJob(String idempotencyKey, int priority, int maxRetries) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("test", "chaos-fault");

        JobEntity job = new JobEntity(
                idempotencyKey,
                "test-fingerprint",
                "CHAOS_TEST",
                payload,
                priority,
                maxRetries,
                Instant.now()
        );
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("Chaos Scenario 1: Worker crash mid-execution, lease expiration and cross-worker recovery")
    void testWorkerCrash_LeaseExpiry_AndRecovery() throws InterruptedException {
        JobEntity job = insertTestJob("chaos-crash-" + UUID.randomUUID(), 70, 3);
        UUID jobId = job.getId();

        // Worker 1 claims job with short lease of 1 second
        List<ClaimedJob> claimed = claimService.claimJobs(1, 1, "chaos-worker-1");
        assertThat(claimed).hasSize(1);
        ClaimedJob w1Claim = claimed.get(0);
        assertThat(w1Claim.id()).isEqualTo(jobId);
        assertThat(w1Claim.attemptCount()).isEqualTo(1);
        assertThat(w1Claim.retryCount()).isEqualTo(0);

        // Simulate crash: Worker 1 dies immediately; no heartbeat or complete is called.
        // Wait 1.2s for the lease to expire
        Thread.sleep(1200);

        // Sweeper runs: recovers the expired lease
        int recovered = claimService.recoverExpiredLeases();
        assertThat(recovered).isGreaterThanOrEqualTo(1);

        // Verify DB state: job is back to PENDING, lease cleared
        JobEntity sweptJob = jobRepository.findById(jobId).orElseThrow();
        assertThat(sweptJob.getStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(sweptJob.getClaimToken()).isNull();
        assertThat(sweptJob.getLockedBy()).isNull();
        assertThat(sweptJob.getLeaseUntil()).isNull();
        assertThat(sweptJob.getFailureCategory()).isEqualTo(FailureCategory.LEASE_EXPIRED);

        // Worker 2 claims the recovered job
        List<ClaimedJob> w2Claimed = claimService.claimJobs(1, 10, "chaos-worker-2");
        assertThat(w2Claimed).hasSize(1);
        ClaimedJob w2Claim = w2Claimed.get(0);
        assertThat(w2Claim.id()).isEqualTo(jobId);
        assertThat(w2Claim.attemptCount()).isEqualTo(2); // Attempt incremented
        assertThat(w2Claim.retryCount()).isEqualTo(1);   // Retry count incremented
        assertThat(w2Claim.claimToken()).isNotEqualTo(w1Claim.claimToken()); // New token assigned

        // Worker 2 successfully completes
        boolean completed = claimService.completeJob(jobId, w2Claim.claimToken(), "CHAOS_TEST", 2, 85, "chaos-worker-2:thread-1");
        assertThat(completed).isTrue();

        JobEntity finalJob = jobRepository.findById(jobId).orElseThrow();
        assertThat(finalJob.getStatus()).isEqualTo(JobStatus.COMPLETED);
    }

    @Test
    @DisplayName("Chaos Scenario 2: Zombie worker fencing prevents stale completion write")
    void testZombieWorker_FencingRejectsStaleCommit() throws InterruptedException {
        JobEntity job = insertTestJob("chaos-zombie-" + UUID.randomUUID(), 80, 3);
        UUID jobId = job.getId();

        // Zombie Worker 1 claims job with 1 second lease
        List<ClaimedJob> claimed = claimService.claimJobs(1, 1, "chaos-worker-zombie");
        ClaimedJob zombieClaim = claimed.get(0);

        // Zombie pauses: lease expires
        Thread.sleep(1200);

        // Sweeper recovers job
        claimService.recoverExpiredLeases();

        // Worker 2 claims and finishes job
        List<ClaimedJob> w2Claimed = claimService.claimJobs(1, 10, "chaos-worker-active");
        ClaimedJob activeClaim = w2Claimed.get(0);
        boolean w2Completed = claimService.completeJob(jobId, activeClaim.claimToken(), "CHAOS_TEST", 2, 90, "chaos-worker-active");
        assertThat(w2Completed).isTrue();

        // Zombie Worker 1 wakes up and attempts to commit completion with stale token
        boolean zombieCompleted = claimService.completeJob(jobId, zombieClaim.claimToken(), "CHAOS_TEST", 1, 1500, "chaos-worker-zombie");

        // CRITICAL INVARIANT: Zombie write is fenced out!
        assertThat(zombieCompleted).as("Stale worker commit MUST be rejected").isFalse();

        // Verify DB was NOT corrupted by zombie
        JobEntity finalJob = jobRepository.findById(jobId).orElseThrow();
        assertThat(finalJob.getStatus()).isEqualTo(JobStatus.COMPLETED);
    }

    @Test
    @DisplayName("Chaos Scenario 3: Retry budget exhaustion transitions expired lease to DEAD_LETTER")
    void testRetryExhaustion_TransitionsToDeadLetter() throws InterruptedException {
        // maxRetries = 1
        JobEntity job = insertTestJob("chaos-dlq-" + UUID.randomUUID(), 50, 1);
        UUID jobId = job.getId();

        // Attempt 1: Claim and let lease expire
        List<ClaimedJob> c1 = claimService.claimJobs(1, 1, "chaos-worker-1");
        Thread.sleep(1200);
        claimService.recoverExpiredLeases();

        // Attempt 2: Claim (retry_count becomes 1 == maxRetries)
        List<ClaimedJob> c2 = claimService.claimJobs(1, 1, "chaos-worker-2");
        assertThat(c2.get(0).retryCount()).isEqualTo(1);

        // Let lease expire again
        Thread.sleep(1200);

        // Sweeper runs: since retry_count >= maxRetries, must route directly to DEAD_LETTER
        claimService.recoverExpiredLeases();

        JobEntity dlqJob = jobRepository.findById(jobId).orElseThrow();
        assertThat(dlqJob.getStatus()).isEqualTo(JobStatus.DEAD_LETTER);
        assertThat(dlqJob.getFailureCategory()).isEqualTo(FailureCategory.LEASE_EXPIRED);
        assertThat(dlqJob.getAttemptCount()).isEqualTo(2);
        assertThat(dlqJob.getRetryCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Chaos Scenario 4: Audit logs record accurate attempt history without tampering")
    void testAuditLogConsistency() {
        JobEntity job = insertTestJob("chaos-audit-" + UUID.randomUUID(), 60, 3);
        UUID jobId = job.getId();

        List<ClaimedJob> claimed = claimService.claimJobs(1, 10, "chaos-worker-audit");
        ClaimedJob c = claimed.get(0);

        claimService.completeJob(jobId, c.claimToken(), "CHAOS_TEST", 1, 120, "chaos-worker-audit:thread-1");

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_job_execution_logs WHERE job_id = ? AND status = 'COMPLETED'",
                Integer.class,
                jobId
        );
        assertThat(count).isEqualTo(1);
    }
}
