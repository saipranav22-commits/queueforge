package com.queueforge.outbox.dto;

import java.time.Instant;
import java.util.UUID;

public record PaymentChargeResponse(
        UUID chargeId,
        String chargeReference,
        UUID orderId,
        String status,
        String failureReason,
        boolean idempotentReplay,
        Instant createdAt
) {
}
