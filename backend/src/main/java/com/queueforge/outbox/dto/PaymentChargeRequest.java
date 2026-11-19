package com.queueforge.outbox.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record PaymentChargeRequest(
        @NotNull(message = "Order ID is required")
        UUID orderId,

        @NotBlank(message = "Customer ID is required")
        String customerId,

        @NotNull(message = "Amount in cents is required")
        @Min(value = 1, message = "Amount must be at least 1 cent")
        Long amountCents,

        @NotBlank(message = "Currency code is required")
        @Size(min = 3, max = 3, message = "Currency must be 3-letter ISO code")
        String currency,

        @NotBlank(message = "Idempotency key is required")
        String idempotencyKey,

        @NotBlank(message = "Fingerprint is required")
        String fingerprint
) {
}
