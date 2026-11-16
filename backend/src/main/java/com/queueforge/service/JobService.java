package com.queueforge.service;

import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.api.dto.CreateJobResponse;
import com.queueforge.api.dto.JobStatusResponse;
import com.queueforge.common.exception.IdempotencyConflictException;
import com.queueforge.common.exception.JobNotFoundException;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.service.idempotency.IdempotencyFingerprintService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final JobRepository jobRepository;
    private final IdempotencyFingerprintService fingerprintService;

    public JobService(JobRepository jobRepository, IdempotencyFingerprintService fingerprintService) {
        this.jobRepository = jobRepository;
        this.fingerprintService = fingerprintService;
    }

    /**
     * Submits and persists a job with at-least-once persistence and idempotency protection.
     */
    @Transactional
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
                job.getRetryCount(),
                job.getMaxRetries(),
                job.getScheduledAt(),
                job.getCreatedAt(),
                job.getCompletedAt()
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
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > 128) {
            throw new IllegalArgumentException("Idempotency-Key length cannot exceed 128 characters");
        }
        return trimmed;
    }
}
