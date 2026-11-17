package com.queueforge.chaoslab.model;

import java.time.Instant;
import java.util.UUID;

public record AuditSnapshot(
        long id,
        UUID jobId,
        String workerId,
        int attempt,
        String status,
        long executionTimeMs,
        String errorMessage,
        Instant createdAt
) {}
