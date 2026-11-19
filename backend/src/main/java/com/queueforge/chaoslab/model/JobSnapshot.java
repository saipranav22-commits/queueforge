package com.queueforge.chaoslab.model;

import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;

import java.time.Instant;
import java.util.UUID;

public record JobSnapshot(
        UUID id,
        String idempotencyKey,
        String jobType,
        JobStatus status,
        int attemptCount,
        int retryCount,
        int maxRetries,
        UUID claimToken,
        long claimVersion,
        String lockedBy,
        Instant leaseUntil,
        FailureCategory failureCategory,
        String lastErrorMessage,
        Instant createdAt,
        Instant updatedAt,
        Instant completedAt
) {}
