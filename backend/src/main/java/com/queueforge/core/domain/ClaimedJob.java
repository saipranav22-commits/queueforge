package com.queueforge.core.domain;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record ClaimedJob(
        UUID id,
        UUID claimToken,
        long claimVersion,
        String jobType,
        JsonNode payload,
        int priority,
        int retryCount,
        int maxRetries,
        Instant scheduledAt,
        Instant leaseUntil,
        String lockedBy
) {
}
