package com.queueforge.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthSessionResponse(
        boolean authenticated,
        String username,
        String csrfToken,
        Instant expiresAt
) {
    public static AuthSessionResponse unauthenticated() {
        return new AuthSessionResponse(false, null, null, null);
    }

    public static AuthSessionResponse authenticated(String username, String csrfToken, Instant expiresAt) {
        return new AuthSessionResponse(true, username, csrfToken, expiresAt);
    }
}
