package com.queueforge.api.dto;

import java.time.Instant;
import java.util.UUID;

public record CreateJobResponse(
        UUID jobId,
        String status,
        Instant createdAt,
        Instant scheduledAt,
        String tenantId
) {
    public CreateJobResponse(UUID jobId, String status, Instant createdAt, Instant scheduledAt) {
        this(jobId, status, createdAt, scheduledAt, "default");
    }
}
