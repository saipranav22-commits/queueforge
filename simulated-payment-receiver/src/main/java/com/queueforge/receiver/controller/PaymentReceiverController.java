package com.queueforge.receiver.controller;

import com.queueforge.receiver.dto.PaymentChargeRequest;
import com.queueforge.receiver.dto.PaymentChargeResponse;
import com.queueforge.receiver.service.PaymentReceiverService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Production Payment Receiver Controller.
 * Exposes exclusively the payment charge ingestion endpoint with service-to-service controls.
 * Contains no destructive reset endpoints or test toggles.
 */
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentReceiverController {

    public static final String SERVICE_KEY_HEADER = "X-Service-Key";

    private final PaymentReceiverService receiverService;
    private final boolean serviceAuthEnabled;
    private final String serviceKey;

    public PaymentReceiverController(PaymentReceiverService receiverService,
                                     @Value("${queueforge.receiver.service-auth-enabled:false}") boolean serviceAuthEnabled,
                                     @Value("${queueforge.receiver.service-key:qf_internal_receiver_key_2026}") String serviceKey) {
        this.receiverService = receiverService;
        this.serviceAuthEnabled = serviceAuthEnabled;
        this.serviceKey = serviceKey;
    }

    private boolean isAuthorized(String providedHeader) {
        if (!serviceAuthEnabled) {
            return true;
        }
        if (providedHeader == null || serviceKey == null) {
            return false;
        }
        return MessageDigest.isEqual(
                providedHeader.trim().getBytes(StandardCharsets.UTF_8),
                serviceKey.trim().getBytes(StandardCharsets.UTF_8)
        );
    }

    @PostMapping("/charges")
    public ResponseEntity<?> processCharge(
            @RequestHeader(value = SERVICE_KEY_HEADER, required = false) String serviceKeyHeader,
            @Valid @RequestBody PaymentChargeRequest request,
            HttpServletResponse httpServletResponse) throws IOException {
        if (!isAuthorized(serviceKeyHeader)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "UNAUTHORIZED",
                    "message", "Missing or invalid service-to-service authorization key"
            ));
        }

        try {
            PaymentChargeResponse response = receiverService.processCharge(request);
            HttpStatus status = response.idempotentReplay() ? HttpStatus.OK : HttpStatus.CREATED;
            return ResponseEntity.status(status).body(response);
        } catch (PaymentReceiverService.SimulatedLostAckException ex) {
            // Abruptly sever the connection to simulate network drop after DB commit!
            httpServletResponse.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Simulated network failure: connection severed after commit");
            return null;
        }
    }

    @ExceptionHandler(PaymentReceiverService.IdempotencyConflictException.class)
    public ResponseEntity<Map<String, String>> handleConflict(PaymentReceiverService.IdempotencyConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "IDEMPOTENCY_CONFLICT",
                "message", ex.getMessage()
        ));
    }

    @ExceptionHandler(PaymentReceiverService.PaymentGatewayUnavailableException.class)
    public ResponseEntity<Map<String, String>> handleUnavailable(PaymentReceiverService.PaymentGatewayUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "SERVICE_UNAVAILABLE",
                "message", ex.getMessage()
        ));
    }
}
