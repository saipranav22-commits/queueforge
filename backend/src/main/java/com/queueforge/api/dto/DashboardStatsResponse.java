package com.queueforge.api.dto;

public record DashboardStatsResponse(
        long pendingJobs,
        long runningJobs,
        long completedJobs,
        long deadLetterJobs,
        long archivedJobs,
        long totalJobs,
        double activeWorkers,
        int workerCapacity,
        String workerStatus,
        double submittedTotal,
        double completedTotal,
        double failedTotal,
        double retriedTotal,
        double recoveredTotal
) {
}
