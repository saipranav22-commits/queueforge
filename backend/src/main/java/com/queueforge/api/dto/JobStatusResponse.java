package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record JobStatusResponse(
        UUID jobId,
        String jobType,
        String status,
        int priority,
        int attemptCount,
        int retryCount,
        int maxRetries,
        String failureCategory,
        Instant scheduledAt,
        Instant createdAt,
        Instant completedAt
) {
}
