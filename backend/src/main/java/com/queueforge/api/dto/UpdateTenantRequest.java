package com.queueforge.api.dto;

import com.queueforge.core.domain.TenantStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdateTenantRequest(
        String name,
        @Min(value = 1, message = "weight must be at least 1")
        @Max(value = 100, message = "weight cannot exceed 100")
        Integer weight,

        @Min(value = 1, message = "maxConcurrency must be at least 1")
        @Max(value = 1000, message = "maxConcurrency cannot exceed 1000")
        Integer maxConcurrency,

        TenantStatus status
) {
}
