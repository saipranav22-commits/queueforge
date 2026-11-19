package com.queueforge.api.dto;

public record FairShareConfigResponse(
        boolean enabled,
        int baseQuantum,
        int maxTenantsPerSweep,
        long activeTenantsCount,
        int totalConfiguredWeight,
        int totalMaxConcurrency
) {
}
