package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record JobDetailResponse(
        UUID jobId,
        String jobType,
        String status,
        JsonNode payload,
        int priority,
        int attemptCount,
        int retryCount,
        int maxRetries,
        String failureCategory,
        String lastErrorMessage,
        Instant scheduledAt,
        Instant createdAt,
        Instant updatedAt,
        Instant completedAt,
        String idempotencyKey,
        String lockedBy,
        List<JobExecutionLogResponse> executionLogs
) {
}
