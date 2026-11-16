package com.queueforge.api.dto;

import java.util.UUID;

public record ReplayJobResponse(
        UUID jobId,
        String status,
        String message
) {
}
