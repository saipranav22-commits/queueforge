package com.queueforge.receiver.controller;

import com.queueforge.receiver.domain.InboxDeduplication;
import com.queueforge.receiver.repository.ChargeRepository;
import com.queueforge.receiver.repository.InboxDeduplicationRepository;
import com.queueforge.receiver.service.PaymentReceiverService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Dedicated test-only and fault-injection controller for simulated payment receiver.
 * Conditionally registered ONLY when queueforge.receiver.test-endpoints-enabled=true.
 * When disabled (the default for production), Spring does not register this controller,
 * causing all test and fault endpoints to return 404 Not Found.
 * Even when enabled, requires valid X-Test-Secret header to reject unauthorized access.
 */
@RestController
@RequestMapping("/api/v1/payments")
@ConditionalOnProperty(name = "queueforge.receiver.test-endpoints-enabled", havingValue = "true", matchIfMissing = false)
public class PaymentReceiverTestController {

    public static final String TEST_SECRET_HEADER = "X-Test-Secret";

    private final PaymentReceiverService receiverService;
    private final ChargeRepository chargeRepository;
    private final InboxDeduplicationRepository inboxRepository;
    private final String testSecret;

    public PaymentReceiverTestController(PaymentReceiverService receiverService,
                                        ChargeRepository chargeRepository,
                                        InboxDeduplicationRepository inboxRepository,
                                        @Value("${queueforge.receiver.test-secret:qf_test_secret_internal_2026}") String testSecret) {
        this.receiverService = receiverService;
        this.chargeRepository = chargeRepository;
        this.inboxRepository = inboxRepository;
        this.testSecret = testSecret;
    }

    private boolean isAuthorized(String headerSecret) {
        return headerSecret != null && headerSecret.equals(testSecret);
    }

    @PostMapping("/simulate/lost-ack")
    public ResponseEntity<?> setSimulateLostAck(
            @RequestHeader(value = TEST_SECRET_HEADER, required = false) String secret,
            @RequestParam boolean enabled) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "Missing or invalid X-Test-Secret header"));
        }
        receiverService.setSimulateLostAck(enabled);
        return ResponseEntity.ok(Map.of("simulateLostAck", enabled));
    }

    @PostMapping("/simulate/unavailable")
    public ResponseEntity<?> setSimulateUnavailable(
            @RequestHeader(value = TEST_SECRET_HEADER, required = false) String secret,
            @RequestParam boolean enabled) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "Missing or invalid X-Test-Secret header"));
        }
        receiverService.setSimulateUnavailable(enabled);
        return ResponseEntity.ok(Map.of("simulateUnavailable", enabled));
    }

    @GetMapping("/charges/count")
    public ResponseEntity<?> getChargeCount(
            @RequestHeader(value = TEST_SECRET_HEADER, required = false) String secret,
            @RequestParam UUID orderId) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "Missing or invalid X-Test-Secret header"));
        }
        long count = chargeRepository.countByOrderId(orderId);
        return ResponseEntity.ok(Map.of("orderId", orderId, "chargeCount", count));
    }

    @GetMapping("/inbox/{idempotencyKey}")
    public ResponseEntity<?> getInboxRecord(
            @RequestHeader(value = TEST_SECRET_HEADER, required = false) String secret,
            @PathVariable String idempotencyKey) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "Missing or invalid X-Test-Secret header"));
        }
        return inboxRepository.findByIdempotencyKey(idempotencyKey)
                .map(record -> ResponseEntity.ok((Object) record))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/reset")
    public ResponseEntity<?> resetData(@RequestHeader(value = TEST_SECRET_HEADER, required = false) String secret) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "UNAUTHORIZED", "message", "Missing or invalid X-Test-Secret header"));
        }
        receiverService.resetAll();
        return ResponseEntity.ok(Map.of("status", "CLEANED"));
    }
}
