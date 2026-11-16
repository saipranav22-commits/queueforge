package com.queueforge.service;

import com.queueforge.api.dto.*;
import com.queueforge.common.exception.IdempotencyConflictException;
import com.queueforge.common.exception.JobNotFoundException;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.metrics.QueueForgeMetrics;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.service.idempotency.IdempotencyFingerprintService;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final JobRepository jobRepository;
    private final IdempotencyFingerprintService fingerprintService;
    private final QueueForgeMetrics metrics;
    private final JdbcTemplate jdbcTemplate;

    public JobService(JobRepository jobRepository,
                      IdempotencyFingerprintService fingerprintService,
                      QueueForgeMetrics metrics,
                      JdbcTemplate jdbcTemplate) {
        this.jobRepository = jobRepository;
        this.fingerprintService = fingerprintService;
        this.metrics = metrics;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Submits a job with durable PostgreSQL persistence and idempotency protection.
     */
    public CreateJobResponse submitJob(CreateJobRequest request, String rawIdempotencyKey) {
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        String fingerprint = null;

        if (idempotencyKey != null) {
            fingerprint = fingerprintService.computeFingerprint(request);

            // 1. Check for existing submission with same key
            Optional<JobEntity> existingOpt = jobRepository.findByIdempotencyKey(idempotencyKey);
            if (existingOpt.isPresent()) {
                JobEntity existing = existingOpt.get();
                return handleExistingIdempotentJob(existing, fingerprint, idempotencyKey);
            }
        } else {
            // Validate payload size and structure even when idempotency key is absent
            fingerprintService.validatePayload(request.payload());
        }

        // 2. Schedule and persist new job
        Instant now = Instant.now();
        Instant scheduledAt = now.plusSeconds(request.effectiveDelaySeconds());

        JobEntity jobEntity = new JobEntity(
                idempotencyKey,
                fingerprint,
                request.jobType().trim().toUpperCase(),
                request.payload(),
                request.effectivePriority(),
                request.effectiveMaxRetries(),
                scheduledAt
        );

        try {
            JobEntity saved = jobRepository.save(jobEntity);
            log.info("Persisted job id={} type={} priority={} status={} scheduledAt={}",
                    saved.getId(), saved.getJobType(), saved.getPriority(), saved.getStatus(), saved.getScheduledAt());

            metrics.incrementJobsSubmitted(saved.getJobType());

            return new CreateJobResponse(
                    saved.getId(),
                    saved.getStatus().name(),
                    saved.getCreatedAt(),
                    saved.getScheduledAt()
            );
        } catch (DataIntegrityViolationException e) {
            // 3. Handle concurrent submission race conditions safely via DB unique constraint
            if (idempotencyKey != null) {
                log.warn("Concurrent insert race detected for idempotencyKey='{}'. Re-querying to resolve.", idempotencyKey);
                Optional<JobEntity> existingAfterRace = jobRepository.findByIdempotencyKey(idempotencyKey);
                if (existingAfterRace.isPresent()) {
                    return handleExistingIdempotentJob(existingAfterRace.get(), fingerprint, idempotencyKey);
                }
            }
            throw e;
        }
    }

    /**
     * Retrieves the status of a persisted job by its UUID.
     */
    @Transactional(readOnly = true)
    public JobStatusResponse getJobStatus(UUID jobId) {
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        return new JobStatusResponse(
                job.getId(),
                job.getJobType(),
                job.getStatus().name(),
                job.getPriority(),
                job.getAttemptCount(),
                job.getRetryCount(),
                job.getMaxRetries(),
                job.getFailureCategory() != null ? job.getFailureCategory().name() : null,
                job.getScheduledAt(),
                job.getCreatedAt(),
                job.getCompletedAt()
        );
    }

    /**
     * Lists jobs with bounded pagination, filtering, searching and sorting.
     */
    @Transactional(readOnly = true)
    public PageResponse<JobSummaryResponse> listJobs(
            int page,
            int size,
            JobStatus status,
            String jobType,
            String search,
            String sortBy,
            String sortDirection) {

        int boundedPage = Math.max(0, page);
        int boundedSize = Math.min(100, Math.max(1, size));

        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortProperty = switch (sortBy != null ? sortBy.toLowerCase() : "") {
            case "priority" -> "priority";
            case "scheduledat" -> "scheduledAt";
            case "completedat" -> "completedAt";
            case "status" -> "status";
            case "jobtype" -> "jobType";
            default -> "createdAt";
        };

        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(direction, sortProperty));

        Specification<JobEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (jobType != null && !jobType.isBlank()) {
                predicates.add(cb.equal(root.get("jobType"), jobType.trim().toUpperCase()));
            }
            if (search != null && !search.isBlank()) {
                String searchTrimmed = search.trim();
                Predicate idMatch = null;
                try {
                    UUID searchUuid = UUID.fromString(searchTrimmed);
                    idMatch = cb.equal(root.get("id"), searchUuid);
                } catch (IllegalArgumentException ignored) {
                }

                Predicate keyMatch = cb.like(cb.lower(root.get("idempotencyKey")), "%" + searchTrimmed.toLowerCase() + "%");
                if (idMatch != null) {
                    predicates.add(cb.or(idMatch, keyMatch));
                } else {
                    predicates.add(keyMatch);
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<JobEntity> resultPage = jobRepository.findAll(spec, pageable);

        List<JobSummaryResponse> content = resultPage.getContent().stream()
                .map(this::toSummaryResponse)
                .toList();

        return new PageResponse<>(
                content,
                resultPage.getNumber(),
                resultPage.getSize(),
                resultPage.getTotalElements(),
                resultPage.getTotalPages()
        );
    }

    /**
     * Retrieves full job details including payload, error info, and execution history.
     */
    @Transactional(readOnly = true)
    public JobDetailResponse getJobDetail(UUID jobId) {
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        List<JobExecutionLogResponse> logs = getJobHistory(jobId);

        return new JobDetailResponse(
                job.getId(),
                job.getJobType(),
                job.getStatus().name(),
                job.getPayload(),
                job.getPriority(),
                job.getAttemptCount(),
                job.getRetryCount(),
                job.getMaxRetries(),
                job.getFailureCategory() != null ? job.getFailureCategory().name() : null,
                job.getLastErrorMessage(),
                job.getScheduledAt(),
                job.getCreatedAt(),
                job.getUpdatedAt(),
                job.getCompletedAt(),
                job.getIdempotencyKey(),
                job.getLockedBy(),
                logs
        );
    }

    /**
     * Retrieves persisted execution logs for a job from qf_job_execution_logs.
     */
    @Transactional(readOnly = true)
    public List<JobExecutionLogResponse> getJobHistory(UUID jobId) {
        if (!jobRepository.existsById(jobId)) {
            throw new JobNotFoundException(jobId);
        }

        String sql = """
            SELECT id, job_id, worker_id, attempt, status, execution_time_ms, error_message, created_at
            FROM qf_job_execution_logs
            WHERE job_id = ?
            ORDER BY attempt ASC, created_at ASC
            """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new JobExecutionLogResponse(
                rs.getLong("id"),
                (UUID) rs.getObject("job_id"),
                rs.getString("worker_id"),
                rs.getInt("attempt"),
                rs.getString("status"),
                rs.getLong("execution_time_ms"),
                rs.getString("error_message"),
                rs.getTimestamp("created_at").toInstant()
        ), jobId);
    }

    private JobSummaryResponse toSummaryResponse(JobEntity job) {
        return new JobSummaryResponse(
                job.getId(),
                job.getJobType(),
                job.getStatus().name(),
                job.getPriority(),
                job.getAttemptCount(),
                job.getRetryCount(),
                job.getMaxRetries(),
                job.getFailureCategory() != null ? job.getFailureCategory().name() : null,
                job.getLastErrorMessage(),
                job.getScheduledAt(),
                job.getCreatedAt(),
                job.getCompletedAt(),
                job.getIdempotencyKey()
        );
    }

    private CreateJobResponse handleExistingIdempotentJob(JobEntity existing, String fingerprint, String idempotencyKey) {
        if (fingerprint != null && !fingerprint.equals(existing.getIdempotencyFingerprint())) {
            log.warn("Idempotency conflict detected for key='{}'. Existing job id={} fingerprint mismatch.",
                    idempotencyKey, existing.getId());
            throw new IdempotencyConflictException(idempotencyKey);
        }

        log.info("Idempotent repeat submission detected for key='{}'. Returning existing job id={}",
                idempotencyKey, existing.getId());

        return new CreateJobResponse(
                existing.getId(),
                existing.getStatus().name(),
                existing.getCreatedAt(),
                existing.getScheduledAt()
        );
    }

    private String normalizeIdempotencyKey(String rawKey) {
        if (rawKey == null) {
            return null;
        }
        String trimmed = rawKey.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
