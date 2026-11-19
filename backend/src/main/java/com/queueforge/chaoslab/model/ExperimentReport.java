package com.queueforge.chaoslab.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ExperimentReport(
        String scenarioId,
        String scenarioName,
        Instant startTime,
        Instant endTime,
        long durationMs,
        String failureInjected,
        String targetWorker,
        Map<String, Object> environment,
        List<UUID> jobIds,
        List<ChaosEvent> events,
        List<InvariantResult> invariants,
        boolean allInvariantsPassed,
        String summary
) {}
