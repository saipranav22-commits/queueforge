package com.queueforge.receiver.controller;

import com.queueforge.receiver.domain.InboxDeduplication;
import com.queueforge.receiver.dto.PaymentChargeRequest;
import com.queueforge.receiver.dto.PaymentChargeResponse;
import com.queueforge.receiver.repository.ChargeRepository;
import com.queueforge.receiver.repository.InboxDeduplicationRepository;
import com.queueforge.receiver.service.PaymentReceiverService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentReceiverController {

    private final PaymentReceiverService receiverService;
    private final ChargeRepository chargeRepository;
    private final InboxDeduplicationRepository inboxRepository;

    public PaymentReceiverController(PaymentReceiverService receiverService,
                                     ChargeRepository chargeRepository,
                                     InboxDeduplicationRepository inboxRepository) {
        this.receiverService = receiverService;
        this.chargeRepository = chargeRepository;
        this.inboxRepository = inboxRepository;
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

    @PostMapping("/simulate/lost-ack")
    public ResponseEntity<Map<String, Object>> setSimulateLostAck(@RequestParam boolean enabled) {
        receiverService.setSimulateLostAck(enabled);
        return ResponseEntity.ok(Map.of("simulateLostAck", enabled));
    }

    @PostMapping("/simulate/unavailable")
    public ResponseEntity<Map<String, Object>> setSimulateUnavailable(@RequestParam boolean enabled) {
        receiverService.setSimulateUnavailable(enabled);
        return ResponseEntity.ok(Map.of("simulateUnavailable", enabled));
    }

    @GetMapping("/charges/count")
    public ResponseEntity<Map<String, Object>> getChargeCount(@RequestParam UUID orderId) {
        long count = chargeRepository.countByOrderId(orderId);
        return ResponseEntity.ok(Map.of("orderId", orderId, "chargeCount", count));
    }

    @GetMapping("/inbox/{idempotencyKey}")
    public ResponseEntity<InboxDeduplication> getInboxRecord(@PathVariable String idempotencyKey) {
        return inboxRepository.findByIdempotencyKey(idempotencyKey)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> resetData() {
        receiverService.resetAll();
        return ResponseEntity.ok(Map.of("status", "CLEANED"));
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
