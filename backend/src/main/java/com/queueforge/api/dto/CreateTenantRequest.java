package com.queueforge.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateTenantRequest(
        @NotBlank(message = "id is required and cannot be blank")
        @Pattern(regexp = "^[a-zA-Z0-9_-]{1,64}$", message = "id must be alphanumeric with dashes or underscores (1-64 chars)")
        String id,

        @NotBlank(message = "name is required and cannot be blank")
        String name,

        @Min(value = 1, message = "weight must be at least 1")
        @Max(value = 100, message = "weight cannot exceed 100")
        Integer weight,

        @Min(value = 1, message = "maxConcurrency must be at least 1")
        @Max(value = 1000, message = "maxConcurrency cannot exceed 1000")
        Integer maxConcurrency,

        String apiKey
) {
    public int effectiveWeight() {
        return weight != null ? weight : 1;
    }

    public int effectiveMaxConcurrency() {
        return maxConcurrency != null ? maxConcurrency : 4;
    }
}
