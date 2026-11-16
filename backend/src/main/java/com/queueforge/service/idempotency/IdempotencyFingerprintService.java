package com.queueforge.service.idempotency;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.common.exception.InvalidPayloadException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class IdempotencyFingerprintService {

    private static final int MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB limit
    private final ObjectMapper objectMapper;

    public IdempotencyFingerprintService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Computes a deterministic SHA-256 fingerprint for a job submission request.
     */
    public String computeFingerprint(CreateJobRequest request) {
        validatePayload(request.payload());

        try {
            // Canonical representation: sorted keys, compact representation
            String canonicalPayload = objectMapper.writeValueAsString(request.payload());
            String canonicalString = String.format("TYPE:%s|PRIORITY:%d|RETRIES:%d|DELAY:%d|PAYLOAD:%s",
                    request.jobType().trim().toUpperCase(),
                    request.effectivePriority(),
                    request.effectiveMaxRetries(),
                    request.effectiveDelaySeconds(),
                    canonicalPayload);

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonicalString.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to compute idempotency fingerprint", e);
        }
    }

    public void validatePayload(JsonNode payload) {
        if (payload == null || payload.isNull()) {
            throw new InvalidPayloadException("Payload cannot be null");
        }
        if (!payload.isObject() && !payload.isArray()) {
            throw new InvalidPayloadException("Payload must be a valid JSON object or array");
        }
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(payload);
            if (bytes.length > MAX_PAYLOAD_BYTES) {
                throw new InvalidPayloadException(String.format(
                        "Payload size (%d bytes) exceeds the maximum allowed limit of %d bytes (64 KB)",
                        bytes.length, MAX_PAYLOAD_BYTES));
            }
        } catch (JsonProcessingException e) {
            throw new InvalidPayloadException("Malformed JSON payload: " + e.getMessage());
        }
    }
}
