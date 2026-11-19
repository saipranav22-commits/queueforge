package com.queueforge.api.dto;

public record OutboxStatsResponse(
        long pendingCount,
        long dispatchingCount,
        long deliveredCount,
        long deadLetterCount,
        long totalCount
) {
}
