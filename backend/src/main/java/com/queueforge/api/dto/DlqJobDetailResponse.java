package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DlqJobDetailResponse(
        UUID jobId,
        String idempotencyKey,
        String jobType,
        JsonNode payload,
        int priority,
        String status,
        int attemptCount,
        int retryCount,
        int maxRetries,
        String failureCategory,
        String lastErrorMessage,
        String lastErrorStack,
        Instant createdAt,
        Instant scheduledAt,
        Instant completedAt,
        Instant updatedAt
) {
}
