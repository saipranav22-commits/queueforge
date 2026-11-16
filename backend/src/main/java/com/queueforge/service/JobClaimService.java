package com.queueforge.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.service.retry.BackoffCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collections;
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

    public JobClaimService(JdbcTemplate jdbcTemplate,
                           ObjectMapper objectMapper,
                           BackoffCalculator backoffCalculator,
                           com.queueforge.metrics.QueueForgeMetrics metrics) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.backoffCalculator = backoffCalculator;
        this.metrics = metrics;
        this.rowMapper = new ClaimedJobRowMapper(objectMapper);
    }

    /**
     * Atomically claims a batch of jobs using PostgreSQL SELECT FOR UPDATE SKIP LOCKED.
     * The database transaction is committed immediately upon return, releasing row locks.
     * Semantics:
     * - attempt_count is incremented on every claim (1 for initial, 2 for first retry, etc.)
     * - retry_count is 0 on initial claim, incremented on subsequent retries
     */
    @Transactional
    public List<ClaimedJob> claimJobs(int batchSize, int leaseDurationSeconds, String workerId) {
        if (batchSize <= 0) {
            return Collections.emptyList();
        }

        String sql = """
            UPDATE qf_jobs
            SET status = 'RUNNING',
                claim_token = gen_random_uuid(),
                claim_version = claim_version + 1,
                locked_by = ?,
                lease_until = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'),
                attempt_count = attempt_count + 1,
                retry_count = CASE WHEN attempt_count = 0 THEN 0 ELSE retry_count + 1 END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (
                SELECT id
                FROM qf_jobs
                WHERE status = 'PENDING'
                  AND scheduled_at <= CURRENT_TIMESTAMP
                ORDER BY priority DESC, scheduled_at ASC
                LIMIT ?
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, claim_token, claim_version, job_type, payload, priority,
                      attempt_count, retry_count, max_retries, scheduled_at, lease_until, locked_by
            """;

        List<ClaimedJob> claimed = jdbcTemplate.query(sql, rowMapper, workerId, leaseDurationSeconds, batchSize);

        if (!claimed.isEmpty()) {
            for (ClaimedJob job : claimed) {
                if (job.scheduledAt() != null) {
                    java.time.Duration wait = java.time.Duration.between(job.scheduledAt(), Instant.now());
                    metrics.recordQueueWaitDuration(job.jobType(), wait);
                }
            }
            log.debug("[{}] Successfully claimed {} jobs with leaseDuration={}s", workerId, claimed.size(), leaseDurationSeconds);
        }

        return claimed;
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
            // Next retry attempt will be retryCount + 1
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
            INSERT INTO qf_job_execution_logs (job_id, worker_id, attempt, status, execution_time_ms, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """;
        jdbcTemplate.update(logSql, jobId, workerId, attempt, status, durationMs, error);
    }

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
                    lockedBy
            );
        }
    }
}
