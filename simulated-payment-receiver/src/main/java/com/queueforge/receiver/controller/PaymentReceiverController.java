package com.queueforge.receiver.controller;

import com.queueforge.receiver.dto.PaymentChargeRequest;
import com.queueforge.receiver.dto.PaymentChargeResponse;
import com.queueforge.receiver.service.PaymentReceiverService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

/**
 * Production Payment Receiver Controller.
 * Exposes exclusively the public payment charge ingestion endpoint.
 * Contains no destructive reset endpoints or test toggles.
 */
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentReceiverController {

    private final PaymentReceiverService receiverService;

    public PaymentReceiverController(PaymentReceiverService receiverService) {
        this.receiverService = receiverService;
    }

    @PostMapping("/charges")
    public ResponseEntity<PaymentChargeResponse> processCharge(
            @Valid @RequestBody PaymentChargeRequest request,
            HttpServletResponse httpServletResponse) throws IOException {
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
