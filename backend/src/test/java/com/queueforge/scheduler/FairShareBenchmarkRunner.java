package com.queueforge.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.TenantStatus;
import com.queueforge.persistence.entity.TenantEntity;
import com.queueforge.persistence.repository.TenantRepository;
import com.queueforge.service.JobClaimService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false"
})
public class FairShareBenchmarkRunner {

    private static final Logger log = LoggerFactory.getLogger(FairShareBenchmarkRunner.class);

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    record TenantMetrics(
            String tenantId,
            int weight,
            int jobsTotal,
            int jobsCompleted,
            long p50WaitMs,
            long p95WaitMs,
            long p99WaitMs,
            long maxWaitMs
    ) {}

    record ProfileResult(
            String profileName,
            String schedulerMode,
            int totalJobs,
            double throughputJobsPerSec,
            long durationMs,
            double jainsFairnessIndexCompletion,
            double jainsFairnessIndexContention,
            long maxTailStarvationMs,
            List<TenantMetrics> tenantMetrics
    ) {}

    private void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
        jdbcTemplate.execute("DELETE FROM qf_tenants WHERE id NOT IN ('default')");
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

    private void insertJobBatch(String tenantId, int count, int priority, Instant baseScheduledTime) {
        List<Object[]> batch = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            batch.add(new Object[]{
                    tenantId,
                    "key-" + tenantId + "-" + UUID.randomUUID(),
                    "fp-" + tenantId + "-" + UUID.randomUUID(),
                    "GENERATE_REPORT",
                    "{\"data\":\"benchmark\"}",
                    priority,
                    3,
                    TimestampUtil.toTimestamp(baseScheduledTime.minusMillis(i * 10L))
            });
        }
        jdbcTemplate.batchUpdate("""
            INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, batch);
    }

    private double calculateJainsFairness(List<TenantMetrics> metrics) {
        if (metrics.isEmpty()) return 1.0;
        double sumX = 0.0;
        double sumXSquared = 0.0;
        int n = metrics.size();

        for (TenantMetrics tm : metrics) {
            double normalizedShare = (double) tm.jobsCompleted() / Math.max(1, tm.weight());
            sumX += normalizedShare;
            sumXSquared += (normalizedShare * normalizedShare);
        }

        if (sumXSquared == 0.0) return 1.0;
        return (sumX * sumX) / (n * sumXSquared);
    }

    private double calculateContentionJainsFairness(Map<String, Integer> claimsByTenant, Map<String, Integer> weights) {
        if (claimsByTenant.isEmpty()) return 1.0;
        double sumX = 0.0;
        double sumXSquared = 0.0;
        int n = claimsByTenant.size();

        for (Map.Entry<String, Integer> e : claimsByTenant.entrySet()) {
            int weight = weights.getOrDefault(e.getKey(), 1);
            double normalizedShare = (double) e.getValue() / Math.max(1, weight);
            sumX += normalizedShare;
            sumXSquared += (normalizedShare * normalizedShare);
        }

        if (sumXSquared == 0.0) return 1.0;
        return (sumX * sumX) / (n * sumXSquared);
    }

    private static class TimestampUtil {
        static java.sql.Timestamp toTimestamp(Instant instant) {
            return java.sql.Timestamp.from(instant);
        }
    }

    private ProfileResult runProfile(String profileName, boolean fairShareEnabled, int batchSize,
                                     Map<String, Integer> tenantWeights,
                                     Map<String, Integer> tenantJobCounts,
                                     Map<String, Integer> tenantSimulatedDelaysMs) {
        cleanDatabase();

        // Register tenants
        for (Map.Entry<String, Integer> entry : tenantWeights.entrySet()) {
            String tid = entry.getKey();
            int weight = entry.getValue();
            if (!"default".equals(tid)) {
                TenantEntity entity = new TenantEntity(tid, "Tenant " + tid, weight, 50, "key_" + tid);
                entity.setStatus(TenantStatus.ACTIVE);
                tenantRepository.save(entity);
            }
        }

        // Seed jobs
        Instant now = Instant.now();
        int totalExpectedJobs = 0;
        for (Map.Entry<String, Integer> entry : tenantJobCounts.entrySet()) {
            String tid = entry.getKey();
            int count = entry.getValue();
            totalExpectedJobs += count;
            insertJobBatch(tid, count, 50, now);
        }

        // Run simulation
        Map<String, List<Long>> waitTimesByTenant = new HashMap<>();
        Map<String, Integer> remainingJobs = new HashMap<>(tenantJobCounts);
        Map<String, Integer> contentionClaimsByTenant = new HashMap<>();
        for (String tid : tenantWeights.keySet()) {
            waitTimesByTenant.put(tid, new ArrayList<>());
            contentionClaimsByTenant.put(tid, 0);
        }

        long startTime = System.currentTimeMillis();
        int totalProcessed = 0;
        int emptySweeps = 0;

        while (totalProcessed < totalExpectedJobs && emptySweeps < 5) {
            long activeTenants = remainingJobs.values().stream().filter(c -> c > 0).count();
            boolean underContention = activeTenants > 1;

            List<ClaimedJob> claimed = fairShareEnabled
                    ? claimService.claimJobsFairShare(batchSize, 30, "bench-worker")
                    : claimService.claimJobsLegacy(batchSize, 30, "bench-worker");

            if (claimed.isEmpty()) {
                emptySweeps++;
                continue;
            }
            emptySweeps = 0;

            Instant sweepNow = Instant.now();
            for (ClaimedJob job : claimed) {
                totalProcessed++;
                long waitMs = job.scheduledAt() != null ? Math.max(0, Duration.between(job.scheduledAt(), sweepNow).toMillis()) : 0;
                waitTimesByTenant.computeIfAbsent(job.tenantId(), k -> new ArrayList<>()).add(waitMs);

                if (underContention) {
                    contentionClaimsByTenant.put(job.tenantId(), contentionClaimsByTenant.getOrDefault(job.tenantId(), 0) + 1);
                }
                remainingJobs.computeIfPresent(job.tenantId(), (k, v) -> Math.max(0, v - 1));

                // Simulated worker processing delay if any
                int simDelay = tenantSimulatedDelaysMs.getOrDefault(job.tenantId(), 0);
                if (simDelay > 0) {
                    try {
                        Thread.sleep(Math.min(simDelay, 10)); // Bounded for fast benchmark
                    } catch (InterruptedException ignored) {}
                }

                claimService.completeJob(job.id(), job.claimToken(), 1, simDelay, "bench-worker");
            }
        }

        long elapsedMs = Math.max(1, System.currentTimeMillis() - startTime);
        double throughput = (totalProcessed * 1000.0) / elapsedMs;

        List<TenantMetrics> tenantMetricsList = new ArrayList<>();
        for (String tid : tenantWeights.keySet()) {
            List<Long> waits = waitTimesByTenant.getOrDefault(tid, Collections.emptyList());
            Collections.sort(waits);
            int count = waits.size();
            long p50 = count > 0 ? waits.get((int) (count * 0.50)) : 0;
            long p95 = count > 0 ? waits.get(Math.min(count - 1, (int) (count * 0.95))) : 0;
            long p99 = count > 0 ? waits.get(Math.min(count - 1, (int) (count * 0.99))) : 0;
            long max = count > 0 ? waits.get(count - 1) : 0;

            tenantMetricsList.add(new TenantMetrics(
                    tid,
                    tenantWeights.get(tid),
                    tenantJobCounts.getOrDefault(tid, 0),
                    count,
                    p50,
                    p95,
                    p99,
                    max
            ));
        }

        double jainCompletion = calculateJainsFairness(tenantMetricsList);
        double jainContention = calculateContentionJainsFairness(contentionClaimsByTenant, tenantWeights);
        long maxTailStarvationMs = tenantMetricsList.stream()
                .filter(tm -> tm.tenantId().contains("quiet") || tm.tenantId().contains("light") || tm.tenantId().contains("short"))
                .mapToLong(TenantMetrics::maxWaitMs)
                .max()
                .orElse(tenantMetricsList.stream().mapToLong(TenantMetrics::maxWaitMs).max().orElse(0L));

        return new ProfileResult(
                profileName,
                fairShareEnabled ? "FairShare (DRR)" : "Baseline (FIFO/Priority)",
                totalProcessed,
                throughput,
                elapsedMs,
                jainCompletion,
                jainContention,
                maxTailStarvationMs,
                tenantMetricsList
        );
    }

    @Test
    @DisplayName("Execute Full FairShare vs Baseline Controlled Benchmark Across 4 Workload Profiles")
    void executeControlledBenchmarks() throws IOException {
        List<ProfileResult> results = new ArrayList<>();

        // Profile 1: Balanced (10 tenants, equal weight=1, 100 jobs each = 1,000 jobs)
        log.info("Running Profile 1: Balanced Workload...");
        Map<String, Integer> p1Weights = new LinkedHashMap<>();
        Map<String, Integer> p1Counts = new LinkedHashMap<>();
        Map<String, Integer> p1Delays = new HashMap<>();
        for (int i = 1; i <= 10; i++) {
            String tid = "tenant-" + i;
            p1Weights.put(tid, 1);
            p1Counts.put(tid, 100);
            p1Delays.put(tid, 0);
        }
        results.add(runProfile("Profile 1: Balanced", false, 10, p1Weights, p1Counts, p1Delays));
        results.add(runProfile("Profile 1: Balanced", true, 10, p1Weights, p1Counts, p1Delays));

        // Profile 2: Skewed Weights (1 heavy tenant weight 10 with 500 jobs, 9 light tenants weight 1 with 50 jobs each)
        log.info("Running Profile 2: Skewed Tenant Weights...");
        Map<String, Integer> p2Weights = new LinkedHashMap<>();
        Map<String, Integer> p2Counts = new LinkedHashMap<>();
        Map<String, Integer> p2Delays = new HashMap<>();
        p2Weights.put("tenant-heavy", 10);
        p2Counts.put("tenant-heavy", 500);
        p2Delays.put("tenant-heavy", 0);
        for (int i = 1; i <= 9; i++) {
            String tid = "tenant-light-" + i;
            p2Weights.put(tid, 1);
            p2Counts.put(tid, 50);
            p2Delays.put(tid, 0);
        }
        results.add(runProfile("Profile 2: Skewed Weights", false, 10, p2Weights, p2Counts, p2Delays));
        results.add(runProfile("Profile 2: Skewed Weights", true, 10, p2Weights, p2Counts, p2Delays));

        // Profile 3: Noisy Neighbor (Tenant A floods 1000 jobs, Tenants B-E submit 20 jobs each)
        log.info("Running Profile 3: Noisy Neighbor Burst...");
        Map<String, Integer> p3Weights = new LinkedHashMap<>();
        Map<String, Integer> p3Counts = new LinkedHashMap<>();
        Map<String, Integer> p3Delays = new HashMap<>();
        p3Weights.put("tenant-noisy-a", 1);
        p3Counts.put("tenant-noisy-a", 1000);
        p3Delays.put("tenant-noisy-a", 0);
        for (char c = 'b'; c <= 'e'; c++) {
            String tid = "tenant-quiet-" + c;
            p3Weights.put(tid, 1);
            p3Counts.put(tid, 20);
            p3Delays.put(tid, 0);
        }
        results.add(runProfile("Profile 3: Noisy Neighbor", false, 10, p3Weights, p3Counts, p3Delays));
        results.add(runProfile("Profile 3: Noisy Neighbor", true, 10, p3Weights, p3Counts, p3Delays));

        // Profile 4: Variable Execution Time (Tenant A long jobs 5ms simulated, Tenants B-E short jobs 0ms)
        log.info("Running Profile 4: Variable Execution Times...");
        Map<String, Integer> p4Weights = new LinkedHashMap<>();
        Map<String, Integer> p4Counts = new LinkedHashMap<>();
        Map<String, Integer> p4Delays = new HashMap<>();
        p4Weights.put("tenant-long-job", 1);
        p4Counts.put("tenant-long-job", 50);
        p4Delays.put("tenant-long-job", 5);
        for (char c = 'b'; c <= 'e'; c++) {
            String tid = "tenant-short-" + c;
            p4Weights.put(tid, 1);
            p4Counts.put(tid, 50);
            p4Delays.put(tid, 0);
        }
        results.add(runProfile("Profile 4: Variable Durations", false, 10, p4Weights, p4Counts, p4Delays));
        results.add(runProfile("Profile 4: Variable Durations", true, 10, p4Weights, p4Counts, p4Delays));

        // Save Results to JSON file
        File reportsDir = new File("D:\\Projects\\QueueForge\\docs\\benchmark");
        reportsDir.mkdirs();
        File jsonFile = new File(reportsDir, "benchmark-results-fairshare.json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(jsonFile, results);

        log.info("Benchmark complete! Results written to: {}", jsonFile.getAbsolutePath());
    }
}
