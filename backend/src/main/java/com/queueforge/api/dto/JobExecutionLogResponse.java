package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record JobExecutionLogResponse(
        long id,
        UUID jobId,
        String workerId,
        int attempt,
        String status,
        long executionTimeMs,
        String errorMessage,
        Instant createdAt
) {
}
