package com.queueforge.api.security;

import java.time.Duration;
import java.time.Instant;

public class SessionInfo {

    public static final Duration SESSION_TTL = Duration.ofHours(2);

    private final String sessionId;
    private final String csrfToken;
    private final Instant createdAt;
    private volatile Instant lastAccessedAt;
    private final String clientIp;

    public SessionInfo(String sessionId, String csrfToken, String clientIp) {
        this.sessionId = sessionId;
        this.csrfToken = csrfToken;
        this.createdAt = Instant.now();
        this.lastAccessedAt = this.createdAt;
        this.clientIp = clientIp;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(lastAccessedAt.plus(SESSION_TTL));
    }

    public void touch() {
        this.lastAccessedAt = Instant.now();
    }

    public Instant getExpiresAt() {
        return lastAccessedAt.plus(SESSION_TTL);
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getCsrfToken() {
        return csrfToken;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastAccessedAt() {
        return lastAccessedAt;
    }

    public String getClientIp() {
        return clientIp;
    }
}
