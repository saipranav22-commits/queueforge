package com.queueforge.api.dto;

import java.time.Instant;
import java.util.UUID;

public record OutboxEventSummaryResponse(
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
        String idempotencyKey
) {
}
