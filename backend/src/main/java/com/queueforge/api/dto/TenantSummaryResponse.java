package com.queueforge.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record TenantSummaryResponse(
        String id,
        String name,
        String status,
        int weight,
        int maxConcurrency,
        BigDecimal deficitCounter,
        long runningCount,
        long pendingCount,
        Instant lastScheduledAt,
        Instant createdAt
) {
}
