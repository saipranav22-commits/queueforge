package com.queueforge.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.queueforge.api.validation.ValidJobType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateJobRequest(
        @NotBlank(message = "jobType is required and cannot be blank")
        @ValidJobType
        String jobType,

        @NotNull(message = "payload is required and cannot be null")
        JsonNode payload,

        @Min(value = 1, message = "priority must be at least 1")
        @Max(value = 100, message = "priority cannot exceed 100")
        Integer priority,

        @Min(value = 0, message = "maxRetries cannot be negative")
        @Max(value = 10, message = "maxRetries cannot exceed 10")
        Integer maxRetries,

        @Min(value = 0, message = "delaySeconds cannot be negative")
        @Max(value = 604800, message = "delaySeconds cannot exceed 604800 (7 days)")
        Integer delaySeconds,

        String tenantId
) {
    public CreateJobRequest(String jobType, JsonNode payload, Integer priority, Integer maxRetries, Integer delaySeconds) {
        this(jobType, payload, priority, maxRetries, delaySeconds, null);
    }

    public int effectivePriority() {
        return priority != null ? priority : 50;
    }

    public int effectiveMaxRetries() {
        return maxRetries != null ? maxRetries : 3;
    }

    public int effectiveDelaySeconds() {
        return delaySeconds != null ? delaySeconds : 0;
    }
}
