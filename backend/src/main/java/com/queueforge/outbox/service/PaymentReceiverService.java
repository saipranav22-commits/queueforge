package com.queueforge.outbox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.common.exception.IdempotencyConflictException;
import com.queueforge.outbox.domain.ChargeStatus;
import com.queueforge.outbox.domain.InboxDeduplicationEntity;
import com.queueforge.outbox.domain.InboxStatus;
import com.queueforge.outbox.domain.SimulatedPaymentChargeEntity;
import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import com.queueforge.outbox.repository.InboxDeduplicationRepository;
import com.queueforge.outbox.repository.SimulatedPaymentChargeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Simulated external payment gateway / consumer consistency boundary.
 * Executes in its own isolated transaction boundary independent of the sender's transaction.
 * Guarantees durable deduplication: exactly one simulated charge per unique business operation.
 */
@Service
public class PaymentReceiverService {

    private static final Logger log = LoggerFactory.getLogger(PaymentReceiverService.class);

    private final SimulatedPaymentChargeRepository chargeRepository;
    private final InboxDeduplicationRepository inboxRepository;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    // Test fault-injection controls (thread-safe, disabled by default)
    private final AtomicBoolean simulateLostAck = new AtomicBoolean(false);
    private final AtomicBoolean simulateUnavailable = new AtomicBoolean(false);

    public PaymentReceiverService(SimulatedPaymentChargeRepository chargeRepository,
                                  InboxDeduplicationRepository inboxRepository,
                                  ObjectMapper objectMapper,
                                  JdbcTemplate jdbcTemplate,
                                  PlatformTransactionManager transactionManager) {
        this.chargeRepository = chargeRepository;
        this.inboxRepository = inboxRepository;
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Atomically processes a payment charge request within an independent transaction boundary.
     * Deduplicates incoming requests using the inbox_deduplication table.
     */
    public PaymentChargeResponse processCharge(PaymentChargeRequest request) {
        if (simulateUnavailable.get()) {
            throw new PaymentGatewayUnavailableException("Simulated payment gateway 503: Service temporarily unavailable");
        }

        String idempotencyKey = request.idempotencyKey();
        String expectedFingerprint = request.fingerprint();

        PaymentChargeResponse response;
        try {
            // Execute receiver transaction in an isolated boundary (REQUIRES_NEW)
            response = transactionTemplate.execute(status -> {
                // 1. Check for existing inbox deduplication record
                Optional<InboxDeduplicationEntity> existingOpt = inboxRepository.findByIdempotencyKey(idempotencyKey);
                if (existingOpt.isPresent()) {
                    return resolveExisting(existingOpt.get(), expectedFingerprint, idempotencyKey, request.orderId());
                }

                // 2. Fresh operation: create new simulated charge
                String chargeRef = "ch_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                SimulatedPaymentChargeEntity charge = new SimulatedPaymentChargeEntity(
                        chargeRef,
                        request.orderId(),
                        request.customerId(),
                        request.amountCents(),
                        request.currency(),
                        ChargeStatus.SUCCEEDED,
                        null
                );
                SimulatedPaymentChargeEntity savedCharge = chargeRepository.saveAndFlush(charge);

                PaymentChargeResponse freshResponse = new PaymentChargeResponse(
                        savedCharge.getId(),
                        savedCharge.getChargeReference(),
                        savedCharge.getOrderId(),
                        savedCharge.getStatus().name(),
                        savedCharge.getFailureReason(),
                        false, // fresh charge
                        savedCharge.getCreatedAt()
                );

                // 3. Persist inbox deduplication record atomically with the charge using direct INSERT
                // Direct INSERT guarantees strict primary key uniqueness enforcement (unlike merge which converts to UPDATE)
                try {
                    String insertSql = """
                        INSERT INTO inbox_deduplication (idempotency_key, request_fingerprint, charge_id, response_payload, status, created_at, updated_at)
                        VALUES (?, ?, ?, ?::jsonb, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """;
                    String jsonStr = objectMapper.writeValueAsString(freshResponse);
                    jdbcTemplate.update(insertSql, idempotencyKey, expectedFingerprint, savedCharge.getId(), jsonStr, InboxStatus.PROCESSED.name());
                } catch (Exception e) {
                    if (e instanceof RuntimeException re) {
                        throw re;
                    }
                    throw new RuntimeException("Failed to serialize or insert inbox deduplication record", e);
                }

                log.info("Committed fresh charge id={} ref={} for orderId={} key='{}'",
                        savedCharge.getId(), savedCharge.getChargeReference(), request.orderId(), idempotencyKey);

                return freshResponse;
            });
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            log.warn("Concurrent duplicate insert race detected for idempotencyKey='{}'. Re-querying to resolve.", idempotencyKey);
            Optional<InboxDeduplicationEntity> existingAfterRace = inboxRepository.findByIdempotencyKey(idempotencyKey);
            if (existingAfterRace.isPresent()) {
                response = resolveExisting(existingAfterRace.get(), expectedFingerprint, idempotencyKey, request.orderId());
            } else {
                throw e;
            }
        }

        // 4. Fault Injection Hook: Simulate network failure/lost acknowledgement AFTER durable database commit
        if (simulateLostAck.get()) {
            log.warn("FAULT INJECTED: Receiver committed charge, but simulated network connection failed before acknowledgement could reach sender!");
            throw new SimulatedLostAckException("Simulated network timeout / connection drop after receiver committed");
        }

        return response;
    }

    private PaymentChargeResponse resolveExisting(InboxDeduplicationEntity existing,
                                                 String expectedFingerprint,
                                                 String idempotencyKey,
                                                 UUID orderId) {
        // Check for payload conflict
        if (!existing.getRequestFingerprint().equals(expectedFingerprint)) {
            log.warn("Idempotency conflict detected for key '{}'. Fingerprint mismatch: expected '{}', existing '{}'",
                    idempotencyKey, expectedFingerprint, existing.getRequestFingerprint());
            throw new IdempotencyConflictException(idempotencyKey);
        }

        // Return previously committed result (idempotent replay)
        log.info("Duplicate payment request detected for key '{}'. Returning cached charge outcome.", idempotencyKey);
        try {
            JsonNode cached = existing.getResponsePayload();
            return new PaymentChargeResponse(
                    UUID.fromString(cached.path("chargeId").asText()),
                    cached.path("chargeReference").asText(),
                    orderId,
                    cached.path("status").asText(),
                    cached.path("failureReason").isNull() ? null : cached.path("failureReason").asText(),
                    true, // idempotentReplay = true
                    Instant.parse(cached.path("createdAt").asText())
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize cached payment response for key " + idempotencyKey, e);
        }
    }

    public static String computeFingerprint(UUID orderId, String customerId, long amountCents, String currency) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String raw = String.format("order:%s|customer:%s|amount:%d|currency:%s",
                    orderId, customerId, amountCents, currency.trim().toUpperCase());
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 digest unavailable", e);
        }
    }

    // Fault injection controls
    public void setSimulateLostAck(boolean simulate) {
        this.simulateLostAck.set(simulate);
    }

    public void setSimulateUnavailable(boolean simulate) {
        this.simulateUnavailable.set(simulate);
    }

    public boolean isSimulateLostAck() {
        return simulateLostAck.get();
    }

    public boolean isSimulateUnavailable() {
        return simulateUnavailable.get();
    }

    public static class PaymentGatewayUnavailableException extends RuntimeException {
        public PaymentGatewayUnavailableException(String message) {
            super(message);
        }
    }

    public static class SimulatedLostAckException extends RuntimeException {
        public SimulatedLostAckException(String message) {
            super(message);
        }
    }
}
