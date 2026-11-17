package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DlqJobSummaryResponse(
        UUID jobId,
        String jobType,
        String status,
        int attemptCount,
        int retryCount,
        int maxRetries,
        String failureCategory,
        String lastErrorMessage,
        Instant createdAt,
        Instant scheduledAt,
        Instant updatedAt,
        String tenantId
) {
    public DlqJobSummaryResponse(UUID jobId, String jobType, String status, int attemptCount,
                                 int retryCount, int maxRetries, String failureCategory,
                                 String lastErrorMessage, Instant createdAt,
                                 Instant scheduledAt, Instant updatedAt) {
        this(jobId, jobType, status, attemptCount, retryCount, maxRetries, failureCategory, lastErrorMessage, createdAt, scheduledAt, updatedAt, "default");
    }
}
