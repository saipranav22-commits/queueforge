package com.queueforge.outbox.client;

import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import com.queueforge.outbox.service.PaymentReceiverService;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Direct client invoking the simulated external payment receiver.
 * The receiver runs in an isolated REQUIRES_NEW transaction boundary, ensuring
 * that no database transaction is shared across sender and receiver boundaries.
 */
@Component
@Primary
public class DirectPaymentClient implements PaymentClient {

    private final PaymentReceiverService paymentReceiverService;

    public DirectPaymentClient(PaymentReceiverService paymentReceiverService) {
        this.paymentReceiverService = paymentReceiverService;
    }

    @Override
    public PaymentChargeResponse charge(PaymentChargeRequest request) {
        return paymentReceiverService.processCharge(request);
    }
}
