package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record JobSummaryResponse(
        UUID jobId,
        String jobType,
        String status,
        int priority,
        int attemptCount,
        int retryCount,
        int maxRetries,
        String failureCategory,
        String lastErrorMessage,
        Instant scheduledAt,
        Instant createdAt,
        Instant completedAt,
        String idempotencyKey,
        String tenantId,
        String lockedBy
) {
    public JobSummaryResponse(UUID jobId, String jobType, String status, int priority,
                              int attemptCount, int retryCount, int maxRetries,
                              String failureCategory, String lastErrorMessage,
                              Instant scheduledAt, Instant createdAt, Instant completedAt,
                              String idempotencyKey) {
        this(jobId, jobType, status, priority, attemptCount, retryCount, maxRetries, failureCategory, lastErrorMessage, scheduledAt, createdAt, completedAt, idempotencyKey, "default", null);
    }

    public JobSummaryResponse(UUID jobId, String jobType, String status, int priority,
                              int attemptCount, int retryCount, int maxRetries,
                              String failureCategory, String lastErrorMessage,
                              Instant scheduledAt, Instant createdAt, Instant completedAt,
                              String idempotencyKey, String tenantId) {
        this(jobId, jobType, status, priority, attemptCount, retryCount, maxRetries, failureCategory, lastErrorMessage, scheduledAt, createdAt, completedAt, idempotencyKey, tenantId, null);
    }
}
