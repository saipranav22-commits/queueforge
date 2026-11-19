package com.queueforge.receiver.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.receiver.domain.ChargeStatus;
import com.queueforge.receiver.domain.InboxDeduplication;
import com.queueforge.receiver.domain.InboxStatus;
import com.queueforge.receiver.domain.SimulatedPaymentCharge;
import com.queueforge.receiver.dto.PaymentChargeRequest;
import com.queueforge.receiver.dto.PaymentChargeResponse;
import com.queueforge.receiver.repository.ChargeRepository;
import com.queueforge.receiver.repository.InboxDeduplicationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class PaymentReceiverService {

    private static final Logger log = LoggerFactory.getLogger(PaymentReceiverService.class);

    private final ChargeRepository chargeRepository;
    private final InboxDeduplicationRepository inboxRepository;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    private final AtomicBoolean simulateLostAck = new AtomicBoolean(false);
    private final AtomicBoolean simulateUnavailable = new AtomicBoolean(false);

    public PaymentReceiverService(ChargeRepository chargeRepository,
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

    public PaymentChargeResponse processCharge(PaymentChargeRequest request) {
        if (simulateUnavailable.get()) {
            throw new PaymentGatewayUnavailableException("Simulated payment gateway 503: Service temporarily unavailable");
        }

        String idempotencyKey = request.idempotencyKey();
        String expectedFingerprint = request.fingerprint();

        PaymentChargeResponse response;
        try {
            response = transactionTemplate.execute(status -> {
                // 1. Check existing inbox record
                Optional<InboxDeduplication> existingOpt = inboxRepository.findByIdempotencyKey(idempotencyKey);
                if (existingOpt.isPresent()) {
                    return resolveExisting(existingOpt.get(), expectedFingerprint, idempotencyKey, request.orderId());
                }

                // 2. Insert fresh charge into simulated_payment_charges
                String chargeRef = "ch_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                SimulatedPaymentCharge charge = new SimulatedPaymentCharge(
                        chargeRef,
                        request.orderId(),
                        request.customerId(),
                        request.amountCents(),
                        request.currency(),
                        ChargeStatus.SUCCEEDED,
                        null
                );
                SimulatedPaymentCharge savedCharge = chargeRepository.saveAndFlush(charge);

                PaymentChargeResponse freshResponse = new PaymentChargeResponse(
                        savedCharge.getId(),
                        savedCharge.getChargeReference(),
                        savedCharge.getOrderId(),
                        savedCharge.getStatus().name(),
                        savedCharge.getFailureReason(),
                        false,
                        savedCharge.getCreatedAt()
                );

                // 3. Insert into inbox_deduplication using raw SQL to enforce strict primary key uniqueness
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
                    throw new RuntimeException("Failed to insert inbox deduplication record", e);
                }

                log.info("[Receiver] Committed fresh charge id={} ref={} for orderId={} key='{}'",
                        savedCharge.getId(), savedCharge.getChargeReference(), request.orderId(), idempotencyKey);

                return freshResponse;
            });
        } catch (DataIntegrityViolationException e) {
            log.warn("[Receiver] Concurrent duplicate insert race detected for idempotencyKey='{}'. Re-querying winner record.", idempotencyKey);
            Optional<InboxDeduplication> existingAfterRace = Optional.empty();
            for (int attempt = 0; attempt < 5; attempt++) {
                existingAfterRace = inboxRepository.findByIdempotencyKey(idempotencyKey);
                if (existingAfterRace.isPresent()) {
                    break;
                }
                try {
                    Thread.sleep(30);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            if (existingAfterRace.isPresent()) {
                response = resolveExisting(existingAfterRace.get(), expectedFingerprint, idempotencyKey, request.orderId());
            } else {
                throw e;
            }
        }

        // Fault injection hook: simulated lost acknowledgement
        if (simulateLostAck.get()) {
            log.warn("[Receiver] FAULT INJECTED: Charge committed to DB, but HTTP acknowledgement dropped before reaching sender!");
            throw new SimulatedLostAckException("Simulated network drop / connection severed after commit");
        }

        return response;
    }

    private PaymentChargeResponse resolveExisting(InboxDeduplication existing,
                                                 String expectedFingerprint,
                                                 String idempotencyKey,
                                                 UUID orderId) {
        if (!existing.getRequestFingerprint().equals(expectedFingerprint)) {
            log.warn("[Receiver] Idempotency conflict for key '{}'. Fingerprint mismatch: expected '{}', existing '{}'",
                    idempotencyKey, expectedFingerprint, existing.getRequestFingerprint());
            throw new IdempotencyConflictException(idempotencyKey);
        }

        log.info("[Receiver] Duplicate request detected for key '{}'. Returning cached outcome (replay).", idempotencyKey);
        try {
            JsonNode cached = existing.getResponsePayload();
            return new PaymentChargeResponse(
                    UUID.fromString(cached.path("chargeId").asText()),
                    cached.path("chargeReference").asText(),
                    orderId,
                    cached.path("status").asText(),
                    cached.path("failureReason").isNull() ? null : cached.path("failureReason").asText(),
                    true,
                    Instant.parse(cached.path("createdAt").asText())
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize cached payment response for key " + idempotencyKey, e);
        }
    }

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

    public void resetAll() {
        jdbcTemplate.execute("DELETE FROM inbox_deduplication");
        jdbcTemplate.execute("DELETE FROM simulated_payment_charges");
        simulateLostAck.set(false);
        simulateUnavailable.set(false);
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

    public static class IdempotencyConflictException extends RuntimeException {
        public IdempotencyConflictException(String key) {
            super("Idempotency key '" + key + "' was previously used with a different request payload");
        }
    }
}
