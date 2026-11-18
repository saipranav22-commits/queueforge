package com.queueforge.core.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

public record ClaimedJob(
        UUID id,
        UUID claimToken,
        long claimVersion,
        String jobType,
        JsonNode payload,
        int priority,
        int attemptCount,
        int retryCount,
        int maxRetries,
        Instant scheduledAt,
        Instant leaseUntil,
        String lockedBy,
        String tenantId
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public ClaimedJob(UUID id,
                      UUID claimToken,
                      long claimVersion,
                      String jobType,
                      JsonNode payload,
                      int priority,
                      int attemptCount,
                      int retryCount,
                      int maxRetries,
                      Instant scheduledAt,
                      Instant leaseUntil,
                      String lockedBy) {
        this(id, claimToken, claimVersion, jobType, payload, priority, attemptCount, retryCount, maxRetries, scheduledAt, leaseUntil, lockedBy, "default");
    }

    public ClaimedJob(UUID id,
                      UUID claimToken,
                      long claimVersion,
                      String jobType,
                      String payloadJson,
                      int priority,
                      int attemptCount,
                      int retryCount,
                      int maxRetries,
                      Instant scheduledAt,
                      Instant leaseUntil,
                      String lockedBy,
                      String tenantId) {
        this(id, claimToken, claimVersion, jobType, parseJson(payloadJson), priority, attemptCount, retryCount, maxRetries, scheduledAt, leaseUntil, lockedBy, tenantId != null ? tenantId : "default");
    }

    public ClaimedJob(UUID id,
                      UUID claimToken,
                      long claimVersion,
                      String jobType,
                      String payloadJson,
                      int priority,
                      int attemptCount,
                      int retryCount,
                      int maxRetries,
                      Instant scheduledAt,
                      Instant leaseUntil,
                      String lockedBy) {
        this(id, claimToken, claimVersion, jobType, payloadJson, priority, attemptCount, retryCount, maxRetries, scheduledAt, leaseUntil, lockedBy, "default");
    }

    private static JsonNode parseJson(String json) {
        if (json == null || json.isBlank()) {
            return MAPPER.createObjectNode();
        }
        try {
            return MAPPER.readTree(json);
        } catch (JsonProcessingException e) {
            return MAPPER.createObjectNode();
        }
    }
}
