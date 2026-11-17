package com.queueforge.outbox.controller;

import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import com.queueforge.outbox.service.PaymentReceiverService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/simulated-payments")
public class SimulatedPaymentController {

    private final PaymentReceiverService paymentReceiverService;

    public SimulatedPaymentController(PaymentReceiverService paymentReceiverService) {
        this.paymentReceiverService = paymentReceiverService;
    }

    @PostMapping("/charge")
    public ResponseEntity<PaymentChargeResponse> processCharge(@Valid @RequestBody PaymentChargeRequest request) {
        PaymentChargeResponse response = paymentReceiverService.processCharge(request);
        HttpStatus status = response.idempotentReplay() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(response);
    }
}
