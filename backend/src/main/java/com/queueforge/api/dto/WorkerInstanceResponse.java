package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WorkerInstanceResponse(
        String instanceId,
        String mode,
        String status,
        int concurrency,
        int activeJobs,
        int heldLeasesCount,
        long completedJobsCount,
        long failedJobsCount,
        Instant lastHeartbeat,
        Instant startedAt,
        long heartbeatAgeSeconds
) {
}
