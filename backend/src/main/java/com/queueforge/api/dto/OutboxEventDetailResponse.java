package com.queueforge.api.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record OutboxEventDetailResponse(
        UUID id,
        String aggregateType,
        String aggregateId,
        String eventType,
        String status,
        int attemptCount,
        int maxRetries,
        Instant nextRetryAt,
        String claimedBy,
        String lastError,
        Instant deliveredAt,
        Instant createdAt,
        Instant updatedAt,
        String idempotencyKey,
        String payloadFingerprint,
        JsonNode payload
) {
}
