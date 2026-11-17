package com.queueforge.outbox.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateOrderRequest(
        @NotBlank(message = "Order number is required")
        @Size(max = 64, message = "Order number must be at most 64 characters")
        String orderNumber,

        @NotBlank(message = "Customer ID is required")
        @Size(max = 64, message = "Customer ID must be at most 64 characters")
        String customerId,

        @NotNull(message = "Amount in cents is required")
        @Min(value = 1, message = "Amount must be at least 1 cent")
        Long amountCents,

        @NotBlank(message = "Currency code is required")
        @Size(min = 3, max = 3, message = "Currency must be 3-letter ISO code")
        String currency
) {
}
