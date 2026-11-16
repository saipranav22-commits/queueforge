package com.queueforge.api.security;

import com.queueforge.common.exception.RateLimitExceededException;
import com.queueforge.config.AdminProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages server-side admin sessions for browser clients.
 * Protects administrative credentials by issuing HttpOnly session cookies and CSRF tokens.
 */
@Service
public class AuthSessionService {

    private static final Logger log = LoggerFactory.getLogger(AuthSessionService.class);
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long RATE_LIMIT_WINDOW_MILLIS = 60_000L; // 1 minute

    private final AdminProperties adminProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    private final Map<String, SessionInfo> activeSessions = new ConcurrentHashMap<>();
    private final Map<String, LoginAttemptRecord> failedAttemptsByIp = new ConcurrentHashMap<>();

    public AuthSessionService(AdminProperties adminProperties) {
        this.adminProperties = adminProperties;
    }

    /**
     * Authenticates an admin key submission from a browser client.
     * Enforces IP-based rate limiting to prevent brute-force attacks.
     */
    public Optional<SessionInfo> login(String providedKey, String clientIp) {
        checkRateLimit(clientIp);

        if (!isValidAdminKey(providedKey)) {
            recordFailedAttempt(clientIp);
            log.warn("Failed admin login attempt from IP='{}'", clientIp);
            return Optional.empty();
        }

        // Reset rate limiting on successful login
        failedAttemptsByIp.remove(clientIp);

        // Generate cryptographically random session and CSRF tokens
        String sessionId = UUID.randomUUID().toString();
        byte[] csrfBytes = new byte[32];
        secureRandom.nextBytes(csrfBytes);
        String csrfToken = HexFormat.of().formatHex(csrfBytes);

        SessionInfo session = new SessionInfo(sessionId, csrfToken, clientIp);
        activeSessions.put(sessionId, session);

        log.info("Admin session established for IP='{}' (expires in {} hours)", clientIp, SessionInfo.SESSION_TTL.toHours());
        return Optional.of(session);
    }

    /**
     * Validates an active session ID and touches it for sliding expiration.
     */
    public Optional<SessionInfo> getSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }

        SessionInfo session = activeSessions.get(sessionId);
        if (session == null) {
            return Optional.empty();
        }

        if (session.isExpired()) {
            activeSessions.remove(sessionId);
            log.debug("Session '{}' expired and was purged", sessionId);
            return Optional.empty();
        }

        session.touch();
        return Optional.of(session);
    }

    /**
     * Explicitly invalidates and terminates a session upon logout.
     */
    public void invalidateSession(String sessionId) {
        if (sessionId != null) {
            SessionInfo removed = activeSessions.remove(sessionId);
            if (removed != null) {
                log.info("Admin session terminated for IP='{}'", removed.getClientIp());
            }
        }
    }

    public boolean isValidAdminKey(String providedKey) {
        if (providedKey == null || adminProperties.getApiKey() == null) {
            return false;
        }
        byte[] providedBytes = providedKey.getBytes(StandardCharsets.UTF_8);
        byte[] expectedBytes = adminProperties.getApiKey().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(providedBytes, expectedBytes);
    }

    private void checkRateLimit(String clientIp) {
        LoginAttemptRecord record = failedAttemptsByIp.get(clientIp);
        if (record != null) {
            long now = System.currentTimeMillis();
            if (now - record.firstAttemptTimestamp() < RATE_LIMIT_WINDOW_MILLIS) {
                if (record.attempts() >= MAX_FAILED_ATTEMPTS) {
                    long remainingSeconds = (RATE_LIMIT_WINDOW_MILLIS - (now - record.firstAttemptTimestamp())) / 1000L;
                    log.warn("Rate limit triggered for admin login from IP='{}' (attempts={})", clientIp, record.attempts());
                    throw new RateLimitExceededException(
                            "Too many failed login attempts. Please wait " + Math.max(1, remainingSeconds) + " seconds before trying again."
                    );
                }
            } else {
                // Window expired, reset counter
                failedAttemptsByIp.remove(clientIp);
            }
        }
    }

    private void recordFailedAttempt(String clientIp) {
        long now = System.currentTimeMillis();
        failedAttemptsByIp.compute(clientIp, (ip, current) -> {
            if (current == null || (now - current.firstAttemptTimestamp()) >= RATE_LIMIT_WINDOW_MILLIS) {
                return new LoginAttemptRecord(1, now);
            } else {
                return new LoginAttemptRecord(current.attempts() + 1, current.firstAttemptTimestamp());
            }
        });
    }

    private record LoginAttemptRecord(int attempts, long firstAttemptTimestamp) {}
}
