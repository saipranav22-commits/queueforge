package com.queueforge.chaoslab.model;

import java.time.Instant;
import java.util.UUID;

public record ChaosEvent(
        String eventId,
        String scenarioId,
        UUID jobId,
        ChaosEventType type,
        String workerId,
        UUID claimToken,
        long claimVersion,
        int attempt,
        Instant timestamp,
        String details
) {
    public static ChaosEvent of(String scenarioId, UUID jobId, ChaosEventType type, String workerId,
                                UUID claimToken, long claimVersion, int attempt, String details) {
        return new ChaosEvent(
                UUID.randomUUID().toString(),
                scenarioId,
                jobId,
                type,
                workerId,
                claimToken,
                claimVersion,
                attempt,
                Instant.now(),
                details
        );
    }
}
