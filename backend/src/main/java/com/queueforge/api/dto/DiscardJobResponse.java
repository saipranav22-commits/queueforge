package com.queueforge.api.dto;

import java.util.UUID;

public record DiscardJobResponse(
        UUID jobId,
        String status,
        String message
) {
}
