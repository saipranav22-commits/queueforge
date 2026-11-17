package com.queueforge.outbox.client;

import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;

public interface PaymentClient {
    PaymentChargeResponse charge(PaymentChargeRequest request);
}
