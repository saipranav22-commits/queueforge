package com.queueforge.api.dto;

public record SystemHealthResponse(
        String status,
        String dbStatus,
        String workerStatus,
        double activeWorkers,
        int workerCapacity,
        int leaseDurationSeconds,
        long pollIntervalMs,
        int databasePoolActive,
        int databasePoolIdle,
        int databasePoolTotal,
        long uptimeSeconds
) {
}
