package com.queueforge.api.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "adminKey is required and cannot be blank")
        String adminKey
) {
}
