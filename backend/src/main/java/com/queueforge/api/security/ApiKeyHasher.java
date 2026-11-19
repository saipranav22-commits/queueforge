package com.queueforge.api.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Cryptographic utility for secure tenant API key generation, prefixing,
 * and SHA-256 verifier computation.
 * Ensures plaintext API keys are never stored in the database or logged.
 */
public final class ApiKeyHasher {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private ApiKeyHasher() {}

    /**
     * Computes the SHA-256 cryptographic hash of the provided raw key, returning a 64-char hex string.
     */
    public static String hash(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            throw new IllegalArgumentException("API key cannot be null or blank");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawKey.trim().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Extracts a safe prefix (first 8 characters) for display, logging, and audit trails without leaking the secret.
     */
    public static String extractPrefix(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            return "unknown";
        }
        String trimmed = rawKey.trim();
        return trimmed.length() <= 8 ? trimmed : trimmed.substring(0, 8);
    }

    /**
     * Generates a cryptographically strong random API key prefixed with "qf_live_".
     */
    public static String generateSecureKey(String tenantId) {
        byte[] randomBytes = new byte[24];
        SECURE_RANDOM.nextBytes(randomBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        return "qf_" + tenantId + "_" + token;
    }

    /**
     * Constant-time comparison to prevent side-channel timing attacks.
     */
    public static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8)
        );
    }
}
