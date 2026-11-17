package com.queueforge.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.config.FairShareProperties;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.service.retry.BackoffCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class JobClaimService {

    private static final Logger log = LoggerFactory.getLogger(JobClaimService.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final BackoffCalculator backoffCalculator;
    private final ClaimedJobRowMapper rowMapper;
    private final com.queueforge.metrics.QueueForgeMetrics metrics;
    private final FairShareProperties fairShareProperties;

    public JobClaimService(JdbcTemplate jdbcTemplate,
                           ObjectMapper objectMapper,
                           BackoffCalculator backoffCalculator,
                           com.queueforge.metrics.QueueForgeMetrics metrics,
                           @Autowired(required = false) FairShareProperties fairShareProperties) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.backoffCalculator = backoffCalculator;
        this.metrics = metrics;
        this.fairShareProperties = fairShareProperties != null ? fairShareProperties : new FairShareProperties();
        this.rowMapper = new ClaimedJobRowMapper(objectMapper);
    }

    /**
     * Atomically claims a batch of jobs.
     * When FairShare is enabled, uses Deficit Round Robin across eligible tenants
     * with cluster-wide max_concurrency quota enforcement.
     * When FairShare is disabled, falls back to legacy global priority/scheduled_at claim.
     */
    @Transactional
    public List<ClaimedJob> claimJobs(int batchSize, int leaseDurationSeconds, String workerId) {
        if (batchSize <= 0) {
            return Collections.emptyList();
        }

        if (fairShareProperties.isEnabled()) {
            return claimJobsFairShare(batchSize, leaseDurationSeconds, workerId);
        } else {
            return claimJobsLegacy(batchSize, leaseDurationSeconds, workerId);
        }
    }

    /**
     * Legacy global priority claim without tenant partitioning.
     */
    @Transactional
    public List<ClaimedJob> claimJobsLegacy(int batchSize, int leaseDurationSeconds, String workerId) {
        if (batchSize <= 0) {
            return Collections.emptyList();
        }

        String sql = """
            WITH candidate_jobs AS (
                SELECT id
                FROM qf_jobs
                WHERE status = 'PENDING'
                  AND scheduled_at <= CURRENT_TIMESTAMP
                ORDER BY priority DESC, scheduled_at ASC
                LIMIT ?
                FOR UPDATE SKIP LOCKED
            )
            UPDATE qf_jobs j
            SET status = 'RUNNING',
                claim_token = gen_random_uuid(),
                claim_version = claim_version + 1,
                locked_by = ?,
                lease_until = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                attempt_count = attempt_count + 1,
                retry_count = CASE WHEN attempt_count = 0 THEN 0 ELSE retry_count + 1 END,
                updated_at = CURRENT_TIMESTAMP
            FROM candidate_jobs c
            WHERE j.id = c.id
            RETURNING j.id, j.claim_token, j.claim_version, j.job_type, j.payload, j.priority,
                      j.attempt_count, j.retry_count, j.max_retries, j.scheduled_at, j.lease_until, j.locked_by, j.tenant_id
            """;

        List<ClaimedJob> claimed = jdbcTemplate.query(sql, rowMapper, batchSize, workerId, leaseDurationSeconds);

        if (!claimed.isEmpty()) {
            for (ClaimedJob job : claimed) {
                if (job.scheduledAt() != null) {
                    java.time.Duration wait = java.time.Duration.between(job.scheduledAt(), Instant.now());
                    metrics.recordQueueWaitDuration(job.jobType(), wait);
                }
            }
            log.debug("[{}] Legacy claimed {} jobs with leaseDuration={}s", workerId, claimed.size(), leaseDurationSeconds);
        }

        return claimed;
    }

    /**
     * FairShare Multi-Tenant Deficit Round Robin claim engine with cluster-wide concurrency quotas.
     */
    @Transactional
    public List<ClaimedJob> claimJobsFairShare(int batchSize, int leaseDurationSeconds, String workerId) {
        if (batchSize <= 0) {
            return Collections.emptyList();
        }

        // 1. Select candidate active tenants with pending jobs and available capacity
        // Locked with FOR UPDATE OF t SKIP LOCKED so multiple worker JVMs never conflict
        String selectTenantsSql = """
            SELECT t.id, t.weight, t.max_concurrency, t.deficit_counter
            FROM qf_tenants t
            WHERE t.status = 'ACTIVE'
              AND (
                  SELECT COUNT(*)
                  FROM qf_jobs
                  WHERE tenant_id = t.id AND status = 'RUNNING'
              ) < t.max_concurrency
              AND EXISTS (
                  SELECT 1
                  FROM qf_jobs
                  WHERE tenant_id = t.id
                    AND status = 'PENDING'
                    AND scheduled_at <= CURRENT_TIMESTAMP
              )
            ORDER BY t.last_scheduled_at ASC NULLS FIRST, t.id ASC
            LIMIT ?
            FOR UPDATE OF t
            """;

        List<TenantCandidate> candidates = jdbcTemplate.query(
                selectTenantsSql,
                (rs, rowNum) -> new TenantCandidate(
                        rs.getString("id"),
                        rs.getInt("weight"),
                        rs.getInt("max_concurrency"),
                        rs.getBigDecimal("deficit_counter")
                ),
                fairShareProperties.getMaxTenantsPerSweep()
        );

        if (candidates.isEmpty()) {
            return Collections.emptyList();
        }

        List<ClaimedJob> allClaimed = new ArrayList<>();
        int remainingBatch = batchSize;

        class TenantScheduleState {
            final String id;
            final int weight;
            final int maxConcurrency;
            BigDecimal deficit;
            int running;
            int claimedCount;
            boolean hasPending;

            TenantScheduleState(TenantCandidate c, int running) {
                this.id = c.id();
                this.weight = c.weight();
                this.maxConcurrency = c.maxConcurrency();
                this.deficit = c.deficitCounter() != null ? c.deficitCounter() : BigDecimal.ZERO;
                this.running = running;
                this.claimedCount = 0;
                this.hasPending = true;
            }
        }

        List<TenantScheduleState> states = new ArrayList<>();
        for (TenantCandidate c : candidates) {
            states.add(new TenantScheduleState(c, countRunningJobs(c.id())));
        }

        int maxRounds = batchSize;
        int round = 0;
        while (remainingBatch > 0 && round < maxRounds) {
            boolean claimedAny = false;
            for (TenantScheduleState state : states) {
                if (remainingBatch <= 0) {
                    break;
                }
                if (!state.hasPending) {
                    continue;
                }

                // 2. Count active running jobs under tenant row lock for strict cluster-wide quota enforcement
                int availableQuota = state.maxConcurrency - state.running;
                if (availableQuota <= 0) {
                    continue;
                }

                // 3. Deficit Round Robin (DRR) calculation
                BigDecimal quantum = BigDecimal.valueOf((long) state.weight * fairShareProperties.getBaseQuantum());
                state.deficit = state.deficit.add(quantum);

                int claimLimit = Math.min(state.deficit.intValue(), availableQuota);
                claimLimit = Math.min(claimLimit, remainingBatch);

                if (claimLimit <= 0) {
                    continue;
                }

                // 4. Claim pending jobs for this specific tenant ordered by priority DESC, scheduled_at ASC
                List<ClaimedJob> claimed = claimTenantJobs(state.id, claimLimit, leaseDurationSeconds, workerId);
                if (!claimed.isEmpty()) {
                    allClaimed.addAll(claimed);
                    remainingBatch -= claimed.size();
                    state.running += claimed.size();
                    state.claimedCount += claimed.size();
                    state.deficit = state.deficit.subtract(BigDecimal.valueOf(claimed.size()));
                    claimedAny = true;
                }

                // If queue is now empty for this tenant, reset deficit to 0 to prevent hoarding while idle
                state.hasPending = hasPendingJobs(state.id);
                if (!state.hasPending || state.deficit.compareTo(BigDecimal.ZERO) < 0) {
                    state.deficit = BigDecimal.ZERO;
                }
            }

            if (!claimedAny) {
                break;
            }
            round++;
        }

        for (TenantScheduleState state : states) {
            if (state.claimedCount > 0 || !state.hasPending) {
                updateTenantDeficit(state.id, state.deficit);
            }
        }

        if (!allClaimed.isEmpty()) {
            for (ClaimedJob job : allClaimed) {
                if (job.scheduledAt() != null) {
                    java.time.Duration wait = java.time.Duration.between(job.scheduledAt(), Instant.now());
                    metrics.recordQueueWaitDuration(job.jobType(), wait);
                }
            }
            log.debug("[{}] FairShare claimed {} jobs across tenants (leaseDuration={}s)",
                    workerId, allClaimed.size(), leaseDurationSeconds);
        }

        return allClaimed;
    }

    /**
     * Claims jobs for a specific tenant within quota.
     */
    @Transactional
    public List<ClaimedJob> claimTenantJobs(String tenantId, int limit, int leaseDurationSeconds, String workerId) {
        if (limit <= 0) {
            return Collections.emptyList();
        }

        String sql = """
            WITH candidate_jobs AS (
                SELECT id
                FROM qf_jobs
                WHERE tenant_id = ?
                  AND status = 'PENDING'
                  AND scheduled_at <= CURRENT_TIMESTAMP
                ORDER BY priority DESC, scheduled_at ASC
                LIMIT ?
                FOR UPDATE SKIP LOCKED
            )
            UPDATE qf_jobs j
            SET status = 'RUNNING',
                claim_token = gen_random_uuid(),
                claim_version = claim_version + 1,
                locked_by = ?,
                lease_until = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                attempt_count = attempt_count + 1,
                retry_count = CASE WHEN attempt_count = 0 THEN 0 ELSE retry_count + 1 END,
                updated_at = CURRENT_TIMESTAMP
            FROM candidate_jobs c
            WHERE j.id = c.id
            RETURNING j.id, j.claim_token, j.claim_version, j.job_type, j.payload, j.priority,
                      j.attempt_count, j.retry_count, j.max_retries, j.scheduled_at, j.lease_until, j.locked_by, j.tenant_id
            """;

        List<ClaimedJob> claimed = jdbcTemplate.query(sql, rowMapper, tenantId, limit, workerId, leaseDurationSeconds);
        if (claimed.size() > 1) {
            claimed = new ArrayList<>(claimed);
            claimed.sort(Comparator.comparingInt(ClaimedJob::priority).reversed()
                    .thenComparing(ClaimedJob::scheduledAt, Comparator.nullsLast(Comparator.naturalOrder())));
        }
        return claimed;
    }

    private int countRunningJobs(String tenantId) {
        String sql = "SELECT COUNT(*) FROM qf_jobs WHERE tenant_id = ? AND status = 'RUNNING'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, tenantId);
        return count != null ? count : 0;
    }

    private boolean hasPendingJobs(String tenantId) {
        String sql = "SELECT EXISTS (SELECT 1 FROM qf_jobs WHERE tenant_id = ? AND status = 'PENDING' AND scheduled_at <= CURRENT_TIMESTAMP)";
        Boolean exists = jdbcTemplate.queryForObject(sql, Boolean.class, tenantId);
        return Boolean.TRUE.equals(exists);
    }

    private void updateTenantDeficit(String tenantId, BigDecimal deficit) {
        String sql = "UPDATE qf_tenants SET deficit_counter = ?, last_scheduled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        jdbcTemplate.update(sql, deficit, tenantId);
    }

    /**
     * Completes a job guarded by the active claim_token and active lease.
     * Returns true if successfully completed; false if fenced out by lease expiry or token mismatch.
     */
    @Transactional
    public boolean completeJob(UUID jobId, UUID claimToken, int attempt, long executionTimeMs, String workerId) {
        return completeJob(jobId, claimToken, "GENERATE_REPORT", attempt, executionTimeMs, workerId);
    }

    /**
     * Completes a job with known jobType for precise metrics tracking.
     */
    @Transactional
    public boolean completeJob(UUID jobId, UUID claimToken, String jobType, int attempt, long executionTimeMs, String workerId) {
        String updateSql = """
            UPDATE qf_jobs
            SET status = 'COMPLETED',
                lease_until = NULL,
                locked_by = NULL,
                claim_token = NULL,
                failure_category = NULL,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'RUNNING'
              AND claim_token = ?
              AND lease_until IS NOT NULL
              AND lease_until >= CURRENT_TIMESTAMP
            """;

        int rows = jdbcTemplate.update(updateSql, jobId, claimToken);

        if (rows == 1) {
            recordExecutionLog(jobId, workerId, attempt, "COMPLETED", executionTimeMs, null);
            metrics.incrementJobsCompleted(jobType);
            metrics.recordExecutionDuration(jobType, "COMPLETED", java.time.Duration.ofMillis(executionTimeMs));
            log.info("[{}] Job {} completed successfully in {}ms (claimToken={})", workerId, jobId, executionTimeMs, claimToken);
            return true;
        } else {
            log.warn("[{}] Fenced out! Failed to complete job {}. Token mismatch or lease expired (token={})",
                    workerId, jobId, claimToken);
            return false;
        }
    }

    /**
     * Transitions a job to failure state (PENDING with backoff or DEAD_LETTER)
     * guarded by active claim_token and active lease.
     */
    @Transactional
    public boolean failJob(UUID jobId,
                           UUID claimToken,
                           int attemptCount,
                           int retryCount,
                           int maxRetries,
                           FailureCategory failureCategory,
                           String errorMessage,
                           String errorStack,
                           long executionTimeMs,
                           String workerId) {
        return failJob(jobId, claimToken, "GENERATE_REPORT", attemptCount, retryCount, maxRetries, failureCategory, errorMessage, errorStack, executionTimeMs, workerId);
    }

    /**
     * Transitions a job to failure state with known jobType for precise metrics tracking.
     */
    @Transactional
    public boolean failJob(UUID jobId,
                           UUID claimToken,
                           String jobType,
                           int attemptCount,
                           int retryCount,
                           int maxRetries,
                           FailureCategory failureCategory,
                           String errorMessage,
                           String errorStack,
                           long executionTimeMs,
                           String workerId) {

        boolean retryable = (failureCategory == FailureCategory.TRANSIENT_FAILURE) && (retryCount < maxRetries);
        String nextStatus = retryable ? JobStatus.PENDING.name() : JobStatus.DEAD_LETTER.name();

        int backoffSeconds = 0;
        if (retryable) {
            backoffSeconds = backoffCalculator.calculateBackoffSeconds(retryCount + 1);
        }

        String updateSql = """
            UPDATE qf_jobs
            SET status = ?,
                failure_category = ?,
                lease_until = NULL,
                locked_by = NULL,
                claim_token = NULL,
                last_error_message = ?,
                last_error_stack = ?,
                scheduled_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'RUNNING'
              AND claim_token = ?
              AND lease_until IS NOT NULL
              AND lease_until >= CURRENT_TIMESTAMP
            """;

        int rows = jdbcTemplate.update(
                updateSql,
                nextStatus,
                failureCategory.name(),
                errorMessage,
                errorStack,
                backoffSeconds,
                jobId,
                claimToken
        );

        if (rows == 1) {
            recordExecutionLog(jobId, workerId, attemptCount, "FAILED", executionTimeMs, errorMessage);
            if (retryable) {
                metrics.incrementJobsRetried(jobType);
            }
            metrics.incrementJobsFailed(jobType, failureCategory);
            metrics.recordExecutionDuration(jobType, failureCategory.name(), java.time.Duration.ofMillis(executionTimeMs));
            log.warn("[{}] Job {} failed (attempt {}, retry {}/{}, category={}). Transitioned to {} (backoff={}s) in {}ms: {}",
                    workerId, jobId, attemptCount, retryCount, maxRetries, failureCategory, nextStatus, backoffSeconds, executionTimeMs, errorMessage);
            return true;
        } else {
            log.warn("[{}] Fenced out! Failed to record failure for job {}. Token mismatch or lease expired (token={})",
                    workerId, jobId, claimToken);
            return false;
        }
    }

    /**
     * Heartbeat extension to renew lease for active running jobs guarded by active token and lease.
     */
    @Transactional
    public boolean extendLease(UUID jobId, UUID claimToken, int extensionSeconds, String workerId) {
        String sql = """
            UPDATE qf_jobs
            SET lease_until = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'RUNNING'
              AND claim_token = ?
              AND lease_until IS NOT NULL
              AND lease_until >= CURRENT_TIMESTAMP
            """;

        int rows = jdbcTemplate.update(sql, extensionSeconds, jobId, claimToken);
        if (rows == 1) {
            log.debug("[{}] Extended lease for job {} by {}s (claimToken={})", workerId, jobId, extensionSeconds, claimToken);
            return true;
        } else {
            log.warn("[{}] Failed to extend lease for job {}. Token mismatch or lease already expired (token={})",
                    workerId, jobId, claimToken);
            return false;
        }
    }

    /**
     * Sweeps and reclaims expired worker leases safely.
     * Jobs with retries remaining return to PENDING with a short delay.
     * Jobs with exhausted retries transition directly to DEAD_LETTER.
     */
    @Transactional
    public int recoverExpiredLeases() {
        String sql = """
            UPDATE qf_jobs
            SET status = CASE WHEN retry_count >= max_retries THEN 'DEAD_LETTER' ELSE 'PENDING' END,
                failure_category = 'LEASE_EXPIRED',
                claim_token = NULL,
                locked_by = NULL,
                lease_until = NULL,
                last_error_message = 'Worker lease expired; reclaimed by LeaseRecoverySweeper',
                scheduled_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE status = 'RUNNING'
              AND lease_until < CURRENT_TIMESTAMP
            """;

        int recovered = jdbcTemplate.update(sql);
        if (recovered > 0) {
            for (int i = 0; i < recovered; i++) {
                metrics.incrementJobsRecovered("lease_sweeper");
            }
            log.warn("LeaseRecoverySweeper reclaimed {} expired job leases back to PENDING/DEAD_LETTER", recovered);
        }
        return recovered;
    }

    private void recordExecutionLog(UUID jobId, String workerId, int attempt, String status, long durationMs, String error) {
        String logSql = """
            INSERT INTO qf_job_execution_logs (job_id, worker_id, attempt, status, execution_time_ms, error_message, tenant_id, created_at)
            SELECT ?, ?, ?, ?, ?, ?, tenant_id, CURRENT_TIMESTAMP
            FROM qf_jobs WHERE id = ?
            """;
        jdbcTemplate.update(logSql, jobId, workerId, attempt, status, durationMs, error, jobId);
    }

    private record TenantCandidate(String id, int weight, int maxConcurrency, BigDecimal deficitCounter) {}

    private static class ClaimedJobRowMapper implements RowMapper<ClaimedJob> {
        private final ObjectMapper objectMapper;

        public ClaimedJobRowMapper(ObjectMapper objectMapper) {
            this.objectMapper = objectMapper;
        }

        @Override
        public ClaimedJob mapRow(ResultSet rs, int rowNum) throws SQLException {
            UUID id = (UUID) rs.getObject("id");
            UUID claimToken = (UUID) rs.getObject("claim_token");
            long claimVersion = rs.getLong("claim_version");
            String jobType = rs.getString("job_type");
            String payloadJson = rs.getString("payload");
            int priority = rs.getInt("priority");
            int attemptCount = rs.getInt("attempt_count");
            int retryCount = rs.getInt("retry_count");
            int maxRetries = rs.getInt("max_retries");

            Timestamp scheduledTs = rs.getTimestamp("scheduled_at");
            Instant scheduledAt = scheduledTs != null ? scheduledTs.toInstant() : null;

            Timestamp leaseTs = rs.getTimestamp("lease_until");
            Instant leaseUntil = leaseTs != null ? leaseTs.toInstant() : null;

            String lockedBy = rs.getString("locked_by");

            String tenantId = "default";
            try {
                String tid = rs.getString("tenant_id");
                if (tid != null && !tid.isBlank()) {
                    tenantId = tid;
                }
            } catch (SQLException ignored) {
            }

            JsonNode payloadNode;
            try {
                payloadNode = objectMapper.readTree(payloadJson);
            } catch (JsonProcessingException e) {
                throw new SQLException("Failed to parse JSON payload for job " + id, e);
            }

            return new ClaimedJob(
                    id,
                    claimToken,
                    claimVersion,
                    jobType,
                    payloadNode,
                    priority,
                    attemptCount,
                    retryCount,
                    maxRetries,
                    scheduledAt,
                    leaseUntil,
                    lockedBy,
                    tenantId
            );
        }
    }
}
