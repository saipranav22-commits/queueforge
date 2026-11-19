package com.queueforge.outbox.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.common.exception.IdempotencyConflictException;
import com.queueforge.outbox.dto.PaymentChargeRequest;
import com.queueforge.outbox.dto.PaymentChargeResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Production HTTP client for outbox event delivery to external Payment Receiver service.
 * Connects over real HTTP with bounded connection/read timeouts, classified errors,
 * and zero fallback to in-process memory.
 */
@Component
@Primary
@ConditionalOnProperty(name = "queueforge.outbox.payment.client-type", havingValue = "HTTP", matchIfMissing = true)
public class HttpPaymentClient implements PaymentClient {

    private static final Logger log = LoggerFactory.getLogger(HttpPaymentClient.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String paymentReceiverUrl;
    private final Duration requestTimeout;
    private final String serviceKey;

    public HttpPaymentClient(ObjectMapper objectMapper,
                            @Value("${queueforge.outbox.payment.url:http://127.0.0.1:8098/api/v1/payments/charges}") String paymentReceiverUrl,
                            @Value("${queueforge.outbox.payment.connect-timeout-ms:2000}") long connectTimeoutMs,
                            @Value("${queueforge.outbox.payment.read-timeout-ms:3000}") long readTimeoutMs,
                            @Value("${queueforge.outbox.payment.service-key:qf_internal_receiver_key_2026}") String serviceKey) {
        this.objectMapper = objectMapper;
        this.paymentReceiverUrl = paymentReceiverUrl;
        this.requestTimeout = Duration.ofMillis(readTimeoutMs);
        this.serviceKey = serviceKey;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @Override
    public PaymentChargeResponse charge(PaymentChargeRequest request) {
        String idempotencyKey = request.idempotencyKey();
        log.info("[HttpPaymentClient] Sending POST to {} for orderId={} key='{}'",
                paymentReceiverUrl, request.orderId(), idempotencyKey);

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            throw new PaymentReceiverPermanentException("Failed to serialize payment request: " + e.getMessage(), e);
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(paymentReceiverUrl))
                .timeout(requestTimeout)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Idempotency-Key", idempotencyKey)
                .header("X-Service-Key", serviceKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            log.warn("[HttpPaymentClient] Read timeout ({}ms) awaiting response for key '{}'", requestTimeout.toMillis(), idempotencyKey);
            throw new PaymentReceiverTransientException("HTTP read timeout after " + requestTimeout.toMillis() + "ms: " + e.getMessage(), e);
        } catch (ConnectException e) {
            log.warn("[HttpPaymentClient] Connection refused to {} for key '{}'", paymentReceiverUrl, idempotencyKey);
            throw new PaymentReceiverTransientException("Connection refused to payment receiver: " + e.getMessage(), e);
        } catch (IOException e) {
            log.warn("[HttpPaymentClient] IO exception delivering request for key '{}': {}", idempotencyKey, e.getMessage());
            throw new PaymentReceiverTransientException("HTTP transport error: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new PaymentReceiverTransientException("HTTP dispatch thread interrupted", e);
        }

        int statusCode = response.statusCode();
        String responseBody = response.body();

        // 1. Success (200 OK / 201 Created)
        if (statusCode == 200 || statusCode == 201) {
            try {
                JsonNode root = objectMapper.readTree(responseBody);
                UUID chargeId = UUID.fromString(root.path("chargeId").asText());
                String chargeReference = root.path("chargeReference").asText();
                UUID orderId = UUID.fromString(root.path("orderId").asText());
                String status = root.path("status").asText();
                String failureReason = root.path("failureReason").isNull() ? null : root.path("failureReason").asText();
                boolean idempotentReplay = root.path("idempotentReplay").asBoolean(false);
                Instant createdAt = Instant.parse(root.path("createdAt").asText());

                return new PaymentChargeResponse(chargeId, chargeReference, orderId, status, failureReason, idempotentReplay, createdAt);
            } catch (Exception e) {
                log.error("[HttpPaymentClient] Failed to deserialize 2xx response from receiver: {}", responseBody, e);
                throw new PaymentReceiverTransientException("Malformed JSON received from payment gateway: " + e.getMessage(), e);
            }
        }

        // 2. Conflict (409) - Idempotency conflict
        if (statusCode == 409) {
            log.warn("[HttpPaymentClient] Receiver rejected key '{}' with HTTP 409 Conflict: {}", idempotencyKey, responseBody);
            throw new IdempotencyConflictException(idempotencyKey);
        }

        // 3. Transient Server Errors (429, 500, 502, 503, 504)
        if (statusCode == 429 || statusCode >= 500) {
            log.warn("[HttpPaymentClient] Receiver responded with transient status {} for key '{}': {}",
                    statusCode, idempotencyKey, responseBody);
            throw new PaymentReceiverTransientException("Payment receiver returned HTTP " + statusCode + ": " + responseBody);
        }

        // 4. Permanent Client Errors (400, 422, etc.)
        log.error("[HttpPaymentClient] Receiver returned permanent status {} for key '{}': {}",
                statusCode, idempotencyKey, responseBody);
        throw new PaymentReceiverPermanentException("Payment receiver returned unrecoverable HTTP " + statusCode + ": " + responseBody);
    }

    public static class PaymentReceiverTransientException extends RuntimeException {
        public PaymentReceiverTransientException(String message) {
            super(message);
        }

        public PaymentReceiverTransientException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static class PaymentReceiverPermanentException extends RuntimeException {
        public PaymentReceiverPermanentException(String message) {
            super(message);
        }

        public PaymentReceiverPermanentException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
