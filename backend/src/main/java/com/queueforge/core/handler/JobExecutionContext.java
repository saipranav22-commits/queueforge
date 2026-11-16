package com.queueforge.core.handler;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

public record JobExecutionContext(
        UUID jobId,
        String jobType,
        JsonNode payload,
        UUID claimToken,
        int attempt,
        String workerId
) {
}
