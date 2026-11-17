package com.queueforge.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.common.exception.JobNotFoundException;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.core.domain.TenantStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.entity.TenantEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.persistence.repository.TenantRepository;
import com.queueforge.service.AdminDlqService;
import com.queueforge.service.JobClaimService;
import com.queueforge.service.JobService;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false",
        "queueforge.scheduler.fairshare.enabled=true",
        "queueforge.scheduler.fairshare.base-quantum=1",
        "queueforge.scheduler.fairshare.max-tenants-per-sweep=10"
})
@org.springframework.test.annotation.DirtiesContext
public class FairShareSchedulerIntegrationTest {

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private AdminDlqService adminDlqService;

    @Autowired
    private JobService jobService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
        jdbcTemplate.execute("DELETE FROM qf_tenants WHERE id NOT IN ('default')");

        // Reset default tenant state
        jdbcTemplate.update("""
            UPDATE qf_tenants
            SET weight = 1,
                max_concurrency = 100,
                deficit_counter = 0,
                status = 'ACTIVE',
                last_scheduled_at = CURRENT_TIMESTAMP
            WHERE id = 'default'
            """);
    }

    private TenantEntity createTenant(String id, String name, int weight, int maxConcurrency) {
        TenantEntity tenant = new TenantEntity(id, name, weight, maxConcurrency, "key_" + id);
        tenant.setStatus(TenantStatus.ACTIVE);
        return tenantRepository.save(tenant);
    }

    private JobEntity createJob(String tenantId, String jobType, int priority, Instant scheduledAt) {
        ObjectNode payload = objectMapper.createObjectNode().put("test", "data-" + UUID.randomUUID());
        JobEntity job = new JobEntity(
                tenantId,
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                jobType,
                payload,
                priority,
                3,
                scheduledAt
        );
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("Scenario 1: Single-tenant backward compatibility ('default' tenant claims as expected)")
    void testSingleTenantBackwardCompatibility() {
        for (int i = 0; i < 5; i++) {
            createJob("default", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        }

        List<ClaimedJob> claimed = claimService.claimJobs(5, 30, "worker-1");
        assertThat(claimed).hasSize(5);
        for (ClaimedJob job : claimed) {
            assertThat(job.tenantId()).isEqualTo("default");
            assertThat(job.claimToken()).isNotNull();
        }
    }

    @Test
    @DisplayName("Scenario 2: Two equally weighted tenants interleave round-robin")
    void testTwoEquallyWeightedTenantsInterleave() {
        TenantEntity tA = createTenant("tenant-a", "Tenant Alpha", 1, 10);
        TenantEntity tB = createTenant("tenant-b", "Tenant Beta", 1, 10);

        // Ensure distinct scheduled timestamps for deterministic initial sweep ordering
        jdbcTemplate.update("UPDATE qf_tenants SET last_scheduled_at = CURRENT_TIMESTAMP - INTERVAL '10 seconds' WHERE id = 'tenant-a'");
        jdbcTemplate.update("UPDATE qf_tenants SET last_scheduled_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds' WHERE id = 'tenant-b'");

        for (int i = 0; i < 4; i++) {
            createJob("tenant-a", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
            createJob("tenant-b", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        }

        // Each single-job claim will alternate between tenants as last_scheduled_at updates
        List<ClaimedJob> claim1 = claimService.claimJobs(1, 30, "worker-1");
        List<ClaimedJob> claim2 = claimService.claimJobs(1, 30, "worker-1");

        assertThat(claim1).hasSize(1);
        assertThat(claim2).hasSize(1);
        assertThat(claim1.getFirst().tenantId()).isNotEqualTo(claim2.getFirst().tenantId());
    }

    @Test
    @DisplayName("Scenario 3: Unequal tenant weights (Tenant A weight 3 vs Tenant B weight 1 dispatches proportionally)")
    void testUnequalTenantWeightsDispatchRatio() {
        createTenant("tenant-heavy", "Heavy Tenant", 3, 10);
        createTenant("tenant-light", "Light Tenant", 1, 10);

        // Seed 10 jobs for each
        for (int i = 0; i < 10; i++) {
            createJob("tenant-heavy", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
            createJob("tenant-light", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        }

        // In a claim sweep with batchSize=4, heavy tenant gets quantum 3 and light gets quantum 1
        List<ClaimedJob> claimed = claimService.claimJobs(4, 30, "worker-1");
        assertThat(claimed).hasSize(4);

        long heavyCount = claimed.stream().filter(j -> "tenant-heavy".equals(j.tenantId())).count();
        long lightCount = claimed.stream().filter(j -> "tenant-light".equals(j.tenantId())).count();

        assertThat(heavyCount).isEqualTo(3);
        assertThat(lightCount).isEqualTo(1);
    }

    @Test
    @DisplayName("Scenario 4: Empty tenant queue is skipped cleanly with zero overhead")
    void testEmptyTenantQueueSkippedCleanly() {
        createTenant("tenant-empty", "Empty Tenant", 10, 10);
        createTenant("tenant-active", "Active Tenant", 1, 10);

        createJob("tenant-active", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        List<ClaimedJob> claimed = claimService.claimJobs(5, 30, "worker-1");
        assertThat(claimed).hasSize(1);
        assertThat(claimed.getFirst().tenantId()).isEqualTo("tenant-active");
    }

    @Test
    @DisplayName("Scenario 5: Newly activated tenant joins scheduling round immediately")
    void testNewlyActivatedTenantJoinsImmediately() {
        createTenant("tenant-existing", "Existing Tenant", 1, 10);
        for (int i = 0; i < 5; i++) {
            createJob("tenant-existing", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        }

        // Claim one batch
        claimService.claimJobs(2, 30, "worker-1");

        // Now activate a new tenant
        createTenant("tenant-new", "New Tenant", 1, 10);
        createJob("tenant-new", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        // Give new tenant older scheduled timestamp so it's prioritized in round
        jdbcTemplate.update("UPDATE qf_tenants SET last_scheduled_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = 'tenant-new'");

        List<ClaimedJob> claimed = claimService.claimJobs(1, 30, "worker-1");
        assertThat(claimed).hasSize(1);
        assertThat(claimed.getFirst().tenantId()).isEqualTo("tenant-new");
    }

    @Test
    @DisplayName("Scenario 6: Tenant concurrency quota is strictly enforced cluster-wide")
    void testTenantConcurrencyQuotaEnforced() {
        // Tenant with max concurrency = 2
        createTenant("tenant-limited", "Limited Tenant", 5, 2);

        for (int i = 0; i < 10; i++) {
            createJob("tenant-limited", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        }

        // Request batch of 10, but max_concurrency is 2
        List<ClaimedJob> claimedRound1 = claimService.claimJobs(10, 30, "worker-1");
        assertThat(claimedRound1).hasSize(2);

        // Immediate subsequent claim should return 0 since 2 are currently RUNNING
        List<ClaimedJob> claimedRound2 = claimService.claimJobs(10, 30, "worker-2");
        assertThat(claimedRound2).isEmpty();
    }

    @Test
    @DisplayName("Scenario 7: Simultaneous claims from concurrent workers enforce quota without oversubscription")
    void testSimultaneousClaimsDoNotOversubscribe() throws Exception {
        createTenant("tenant-concurrent", "Concurrent Tenant", 10, 3);

        for (int i = 0; i < 20; i++) {
            createJob("tenant-concurrent", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        }

        int threads = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        List<Future<List<ClaimedJob>>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            final String worker = "concurrent-worker-" + i;
            futures.add(executor.submit(() -> {
                startLatch.await();
                return claimService.claimJobs(5, 30, worker);
            }));
        }

        startLatch.countDown();
        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);

        int totalClaimed = 0;
        for (Future<List<ClaimedJob>> future : futures) {
            totalClaimed += future.get().size();
        }

        // Combined running claims must not exceed tenant max concurrency of 3
        assertThat(totalClaimed).isLessThanOrEqualTo(3);

        Integer activeInDb = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_jobs WHERE tenant_id = 'tenant-concurrent' AND status = 'RUNNING'",
                Integer.class
        );
        assertThat(activeInDb).isEqualTo(totalClaimed);
    }

    @Test
    @DisplayName("Scenario 8: Worker crash while occupying tenant quota leaves quota blocked until lease expiry")
    void testWorkerCrashWhileOccupyingQuota() {
        createTenant("tenant-crash-block", "Crash Block Tenant", 1, 2);

        createJob("tenant-crash-block", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        createJob("tenant-crash-block", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        createJob("tenant-crash-block", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        // Claim 2 jobs with active lease
        List<ClaimedJob> claimed = claimService.claimJobs(2, 60, "worker-crashed");
        assertThat(claimed).hasSize(2);

        // While lease is active, quota is full -> no additional claims allowed
        assertThat(claimService.claimJobs(2, 60, "worker-other")).isEmpty();
    }

    @Test
    @DisplayName("Scenario 9: Lease expiry and sweeper recovery restores tenant quota capacity")
    void testLeaseExpiryAndQuotaRecovery() {
        createTenant("tenant-crashed", "Crashed Tenant", 5, 2);

        createJob("tenant-crashed", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        createJob("tenant-crashed", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        createJob("tenant-crashed", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        // Claim 2 jobs with short lease of 1 second
        List<ClaimedJob> claimed = claimService.claimJobs(2, 1, "worker-doomed");
        assertThat(claimed).hasSize(2);

        // Capacity is full
        assertThat(claimService.claimJobs(2, 30, "worker-alive")).isEmpty();

        // Simulate lease expiration by updating lease_until in the past
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '5 seconds' WHERE status = 'RUNNING'");

        // Sweep expired leases back to PENDING
        int recovered = claimService.recoverExpiredLeases();
        assertThat(recovered).isEqualTo(2);

        // Quota is restored: new worker can claim again
        List<ClaimedJob> reclaimed = claimService.claimJobs(2, 30, "worker-alive");
        assertThat(reclaimed).hasSize(2);
    }

    @Test
    @DisplayName("Scenario 10: Stale worker completion rejection with fencing token protects quota integrity")
    void testStaleWorkerFencingRejection() {
        createTenant("tenant-fenced", "Fenced Tenant", 1, 2);
        createJob("tenant-fenced", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        List<ClaimedJob> claimed = claimService.claimJobs(1, 1, "worker-slow");
        ClaimedJob slowJob = claimed.getFirst();

        // Expire lease and recover
        jdbcTemplate.update("UPDATE qf_jobs SET lease_until = CURRENT_TIMESTAMP - INTERVAL '5 seconds' WHERE id = ?", slowJob.id());
        claimService.recoverExpiredLeases();

        // Another worker claims the recovered job with a new token
        List<ClaimedJob> reclaimed = claimService.claimJobs(1, 30, "worker-fast");
        ClaimedJob fastJob = reclaimed.getFirst();

        assertThat(fastJob.id()).isEqualTo(slowJob.id());
        assertThat(fastJob.claimToken()).isNotEqualTo(slowJob.claimToken());

        // Stale worker tries to complete with old token -> must be rejected
        boolean slowCompleted = claimService.completeJob(slowJob.id(), slowJob.claimToken(), 1, 100, "worker-slow");
        assertThat(slowCompleted).isFalse();

        // Fast worker completes with active token -> must succeed
        boolean fastCompleted = claimService.completeJob(fastJob.id(), fastJob.claimToken(), 1, 100, "worker-fast");
        assertThat(fastCompleted).isTrue();

        // Tenant quota is freed
        JobEntity finished = jobRepository.findById(fastJob.id()).orElseThrow();
        assertThat(finished.getStatus()).isEqualTo(JobStatus.COMPLETED);
    }

    @Test
    @DisplayName("Scenario 11: Priority ordering preserved within each tenant queue")
    void testPriorityOrderingWithinTenant() {
        createTenant("tenant-priority", "Priority Tenant", 5, 5);

        createJob("tenant-priority", "GENERATE_REPORT", 10, Instant.now().minusSeconds(10));
        createJob("tenant-priority", "GENERATE_REPORT", 100, Instant.now().minusSeconds(10));
        createJob("tenant-priority", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        List<ClaimedJob> claimed = claimService.claimJobs(3, 30, "worker-1");
        assertThat(claimed).hasSize(3);
        assertThat(claimed.get(0).priority()).isEqualTo(100);
        assertThat(claimed.get(1).priority()).isEqualTo(50);
        assertThat(claimed.get(2).priority()).isEqualTo(10);
    }

    @Test
    @DisplayName("Scenario 12: Tenant authorization boundaries at service level")
    void testTenantAuthorizationBoundaries() {
        createTenant("tenant-x", "Tenant X", 1, 5);
        createTenant("tenant-y", "Tenant Y", 1, 5);

        JobEntity jobX = createJob("tenant-x", "GENERATE_REPORT", 50, Instant.now());

        // Authenticate context as tenant-y
        com.queueforge.api.security.TenantContext.set(com.queueforge.api.security.TenantAuthentication.tenant("tenant-y"));
        try {
            // Attempt to retrieve Tenant X's job as Tenant Y -> should throw JobNotFoundException (404 isolation)
            assertThatThrownBy(() -> jobService.getJobDetail(jobX.getId()))
                    .isInstanceOf(JobNotFoundException.class);
        } finally {
            com.queueforge.api.security.TenantContext.clear();
        }
    }

    @Test
    @DisplayName("Scenario 13: DLQ tenant isolation prevents cross-tenant access")
    void testDlqTenantIsolation() {
        createTenant("tenant-dlq-a", "DLQ Tenant A", 1, 5);
        createTenant("tenant-dlq-b", "DLQ Tenant B", 1, 5);

        JobEntity dlqB = createJob("tenant-dlq-b", "GENERATE_REPORT", 50, Instant.now());
        dlqB.setStatus(JobStatus.DEAD_LETTER);
        dlqB.setFailureCategory(FailureCategory.PERMANENT_FAILURE);
        dlqB.setLastErrorMessage("Permanent failure in B");
        jobRepository.save(dlqB);

        // Caller authenticated as tenant-dlq-a
        com.queueforge.api.security.TenantContext.set(com.queueforge.api.security.TenantAuthentication.tenant("tenant-dlq-a"));
        try {
            assertThatThrownBy(() -> adminDlqService.getDlqJob(dlqB.getId()))
                    .isInstanceOf(JobNotFoundException.class);

            assertThatThrownBy(() -> adminDlqService.replayDlqJob(dlqB.getId()))
                    .isInstanceOf(JobNotFoundException.class);

            assertThatThrownBy(() -> adminDlqService.discardDlqJob(dlqB.getId()))
                    .isInstanceOf(JobNotFoundException.class);
        } finally {
            com.queueforge.api.security.TenantContext.clear();
        }
    }

    @Test
    @DisplayName("Scenario 14: Retry backoff frees tenant quota; scheduled retry reclaims within quota")
    void testRetryBackoffFreesQuota() {
        createTenant("tenant-retry", "Retry Tenant", 1, 1);
        JobEntity job = createJob("tenant-retry", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        // Claim only job (fills max_concurrency of 1)
        List<ClaimedJob> claimed = claimService.claimJobs(1, 30, "worker-1");
        assertThat(claimed).hasSize(1);

        // Fail job with transient error -> triggers backoff (scheduled in future, status PENDING)
        claimService.failJob(
                job.getId(),
                claimed.getFirst().claimToken(),
                1,
                0,
                3,
                FailureCategory.TRANSIENT_FAILURE,
                "Network glitch",
                "Stack trace...",
                50,
                "worker-1"
        );

        // Capacity is restored because status is no longer RUNNING
        Integer runningCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_jobs WHERE tenant_id = 'tenant-retry' AND status = 'RUNNING'",
                Integer.class
        );
        assertThat(runningCount).isEqualTo(0);

        // Submitting another job can be claimed immediately within quota
        createJob("tenant-retry", "GENERATE_REPORT", 50, Instant.now().minusSeconds(5));
        List<ClaimedJob> claimedNew = claimService.claimJobs(1, 30, "worker-1");
        assertThat(claimedNew).hasSize(1);
    }

    @Test
    @DisplayName("Scenario 15: Long-running jobs in Tenant A do not block Tenant B's short jobs")
    void testLongRunningJobsDoNotStarveOtherTenants() {
        createTenant("tenant-long", "Long Jobs Tenant", 1, 2);
        createTenant("tenant-short", "Short Jobs Tenant", 1, 2);

        // Tenant A occupies its max concurrency (2 jobs)
        createJob("tenant-long", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        createJob("tenant-long", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));
        createJob("tenant-long", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10)); // 3rd pending

        List<ClaimedJob> longClaimed = claimService.claimJobs(2, 300, "worker-long");
        assertThat(longClaimed).hasSize(2);

        // Tenant B has pending short jobs
        createJob("tenant-short", "GENERATE_REPORT", 50, Instant.now().minusSeconds(10));

        // Claiming next batch must claim Tenant B's job even though Tenant A has a pending 3rd job
        List<ClaimedJob> shortClaimed = claimService.claimJobs(2, 30, "worker-short");
        assertThat(shortClaimed).hasSize(1);
        assertThat(shortClaimed.getFirst().tenantId()).isEqualTo("tenant-short");
    }

    @Test
    @DisplayName("Scenario 16: Sustained noisy-neighbor workload - Tenant B completes without waiting for Tenant A's 500 jobs")
    void testSustainedNoisyNeighborFairness() {
        createTenant("tenant-noisy", "Noisy Tenant", 1, 5);
        createTenant("tenant-quiet", "Quiet Tenant", 1, 5);

        // Noisy tenant submits 500 jobs
        List<Object[]> noisyArgs = new ArrayList<>();
        for (int i = 0; i < 500; i++) {
            noisyArgs.add(new Object[]{
                    "tenant-noisy",
                    "key-noisy-" + i,
                    "fp-noisy-" + i,
                    "GENERATE_REPORT",
                    "{\"index\":" + i + "}",
                    50,
                    3
            });
        }
        jdbcTemplate.batchUpdate("""
            INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, CURRENT_TIMESTAMP - INTERVAL '10 seconds', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, noisyArgs);

        // Quiet tenant submits 5 jobs
        for (int i = 0; i < 5; i++) {
            createJob("tenant-quiet", "GENERATE_REPORT", 50, Instant.now().minusSeconds(5));
        }

        // Run 5 sweeps of batchSize=4
        int quietClaimedTotal = 0;
        for (int sweep = 0; sweep < 5; sweep++) {
            List<ClaimedJob> claimed = claimService.claimJobs(4, 30, "worker-sim");
            for (ClaimedJob job : claimed) {
                if ("tenant-quiet".equals(job.tenantId())) {
                    quietClaimedTotal++;
                }
                // Simulate quick completion
                claimService.completeJob(job.id(), job.claimToken(), 1, 10, "worker-sim");
            }
        }

        // All 5 jobs of the quiet tenant must be completed in the first 5 sweeps despite the 500-job backlog
        assertThat(quietClaimedTotal).isEqualTo(5);
    }
}
