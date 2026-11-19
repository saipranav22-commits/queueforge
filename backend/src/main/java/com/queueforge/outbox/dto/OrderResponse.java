package com.queueforge.outbox.dto;

import java.time.Instant;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        String orderNumber,
        String customerId,
        long amountCents,
        String currency,
        String status,
        Instant createdAt,
        Instant updatedAt
) {
}
