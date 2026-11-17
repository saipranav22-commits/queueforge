package com.queueforge.outbox.client;

import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import com.queueforge.outbox.service.PaymentReceiverService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Direct client invoking the in-process payment receiver.
 * Kept strictly as a test fixture for in-process integration tests.
 * Enabled ONLY when queueforge.outbox.payment.client-type=DIRECT.
 */
@Component
@ConditionalOnProperty(name = "queueforge.outbox.payment.client-type", havingValue = "DIRECT")
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
