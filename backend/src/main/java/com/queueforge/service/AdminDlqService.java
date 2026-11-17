package com.queueforge.service;

import com.queueforge.api.dto.*;
import com.queueforge.api.security.TenantContext;
import com.queueforge.common.exception.JobNotFoundException;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AdminDlqService {

    private static final Logger log = LoggerFactory.getLogger(AdminDlqService.class);

    private final JobRepository jobRepository;
    private final JdbcTemplate jdbcTemplate;
    private final com.queueforge.metrics.QueueForgeMetrics metrics;

    public AdminDlqService(JobRepository jobRepository,
                           JdbcTemplate jdbcTemplate,
                           com.queueforge.metrics.QueueForgeMetrics metrics) {
        this.jobRepository = jobRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.metrics = metrics;
    }

    /**
     * Lists jobs in the Dead-Letter Queue with optional filters and pagination.
     */
    @Transactional(readOnly = true)
    public PageResponse<DlqJobSummaryResponse> listDlqJobs(int page, int size, String jobType, FailureCategory failureCategory) {
        return listDlqJobs(page, size, jobType, failureCategory, null);
    }

    /**
     * Lists jobs in the Dead-Letter Queue with tenant isolation.
     */
    @Transactional(readOnly = true)
    public PageResponse<DlqJobSummaryResponse> listDlqJobs(int page, int size, String jobType, FailureCategory failureCategory, String filterTenantId) {
        int validatedPage = Math.max(0, page);
        int validatedSize = Math.min(100, Math.max(1, size));

        Specification<JobEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), JobStatus.DEAD_LETTER));

            // Enforce tenant isolation
            if (!TenantContext.isMasterAdmin()) {
                predicates.add(cb.equal(root.get("tenantId"), TenantContext.getTenantId()));
            } else if (filterTenantId != null && !filterTenantId.isBlank()) {
                predicates.add(cb.equal(root.get("tenantId"), filterTenantId.trim().toLowerCase()));
            }

            if (jobType != null && !jobType.isBlank()) {
                predicates.add(cb.equal(root.get("jobType"), jobType.trim().toUpperCase()));
            }
            if (failureCategory != null) {
                predicates.add(cb.equal(root.get("failureCategory"), failureCategory));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageRequest = PageRequest.of(validatedPage, validatedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<JobEntity> jobPage = jobRepository.findAll(spec, pageRequest);

        List<DlqJobSummaryResponse> content = jobPage.getContent().stream()
                .map(job -> new DlqJobSummaryResponse(
                        job.getId(),
                        job.getJobType(),
                        job.getStatus().name(),
                        job.getAttemptCount(),
                        job.getRetryCount(),
                        job.getMaxRetries(),
                        job.getFailureCategory() != null ? job.getFailureCategory().name() : null,
                        job.getLastErrorMessage(),
                        job.getCreatedAt(),
                        job.getScheduledAt(),
                        job.getUpdatedAt(),
                        job.getTenantId()
                ))
                .toList();

        return new PageResponse<>(
                content,
                jobPage.getNumber(),
                jobPage.getSize(),
                jobPage.getTotalElements(),
                jobPage.getTotalPages()
        );
    }

    /**
     * Retrieves full diagnostics of a specific job in the DLQ.
     */
    @Transactional(readOnly = true)
    public DlqJobDetailResponse getDlqJob(UUID jobId) {
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        if (!TenantContext.isMasterAdmin()) {
            String callerTenant = TenantContext.getTenantId();
            if (!callerTenant.equalsIgnoreCase(job.getTenantId())) {
                throw new JobNotFoundException(jobId);
            }
        }

        if (job.getStatus() != JobStatus.DEAD_LETTER) {
            throw new IllegalStateException("Job " + jobId + " is not in DEAD_LETTER status (current: " + job.getStatus() + ")");
        }

        return new DlqJobDetailResponse(
                job.getId(),
                job.getIdempotencyKey(),
                job.getJobType(),
                job.getPayload(),
                job.getPriority(),
                job.getStatus().name(),
                job.getAttemptCount(),
                job.getRetryCount(),
                job.getMaxRetries(),
                job.getFailureCategory() != null ? job.getFailureCategory().name() : null,
                job.getLastErrorMessage(),
                job.getLastErrorStack(),
                job.getCreatedAt(),
                job.getScheduledAt(),
                job.getCompletedAt(),
                job.getUpdatedAt(),
                job.getTenantId()
        );
    }

    /**
     * Atomically replays a job from DEAD_LETTER back to PENDING queue.
     * Resets attempt count and retry count, clearing past failure metadata.
     */
    @Transactional
    public ReplayJobResponse replayDlqJob(UUID jobId) {
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        if (!TenantContext.isMasterAdmin()) {
            String callerTenant = TenantContext.getTenantId();
            if (!callerTenant.equalsIgnoreCase(job.getTenantId())) {
                throw new JobNotFoundException(jobId);
            }
        }

        String sql = """
            UPDATE qf_jobs
            SET status = 'PENDING',
                scheduled_at = CURRENT_TIMESTAMP,
                lease_until = NULL,
                locked_by = NULL,
                claim_token = NULL,
                attempt_count = 0,
                retry_count = 0,
                failure_category = NULL,
                last_error_message = NULL,
                last_error_stack = NULL,
                completed_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'DEAD_LETTER'
            """;

        int rows = jdbcTemplate.update(sql, jobId);

        if (rows == 1) {
            recordAuditLog(jobId, "admin-console", 0, "REPLAYED", 0, "Manually replayed from DLQ via Admin API");
            metrics.incrementJobsRecovered("admin_replay");
            log.info("Job {} successfully replayed from DEAD_LETTER to PENDING", jobId);
            return new ReplayJobResponse(jobId, "PENDING", "Job successfully returned to PENDING queue for replay");
        }

        throw new IllegalStateException("Cannot replay job " + jobId + " because its current status is " + job.getStatus() + " (expected DEAD_LETTER)");
    }

    /**
     * Atomically discards a job from DEAD_LETTER to ARCHIVED.
     * Preserves job data for compliance and audit trail without hard deletion.
     */
    @Transactional
    public DiscardJobResponse discardDlqJob(UUID jobId) {
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        if (!TenantContext.isMasterAdmin()) {
            String callerTenant = TenantContext.getTenantId();
            if (!callerTenant.equalsIgnoreCase(job.getTenantId())) {
                throw new JobNotFoundException(jobId);
            }
        }

        String sql = """
            UPDATE qf_jobs
            SET status = 'ARCHIVED',
                lease_until = NULL,
                locked_by = NULL,
                claim_token = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'DEAD_LETTER'
            """;

        int rows = jdbcTemplate.update(sql, jobId);

        if (rows == 1) {
            recordAuditLog(jobId, "admin-console", 0, "ARCHIVED", 0, "Discarded from DLQ via Admin API");
            log.info("Job {} successfully discarded and moved to ARCHIVED", jobId);
            return new DiscardJobResponse(jobId, "ARCHIVED", "Job successfully discarded and archived");
        }

        throw new IllegalStateException("Cannot discard job " + jobId + " because its current status is " + job.getStatus() + " (expected DEAD_LETTER)");
    }

    private void recordAuditLog(UUID jobId, String workerId, int attempt, String status, long durationMs, String note) {
        String logSql = """
            INSERT INTO qf_job_execution_logs (job_id, worker_id, attempt, status, execution_time_ms, error_message, tenant_id, created_at)
            SELECT ?, ?, ?, ?, ?, ?, tenant_id, CURRENT_TIMESTAMP
            FROM qf_jobs WHERE id = ?
            """;
        jdbcTemplate.update(logSql, jobId, workerId, attempt, status, durationMs, note, jobId);
    }
}
