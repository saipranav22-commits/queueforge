package com.queueforge.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.api.dto.FairShareConfigResponse;
import com.queueforge.api.dto.OutboxEventDetailResponse;
import com.queueforge.api.dto.OutboxEventSummaryResponse;
import com.queueforge.api.dto.OutboxStatsResponse;
import com.queueforge.outbox.domain.OutboxStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class OutboxReadApiUnitTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("OutboxStatsResponse correctly aggregates status counts")
    void testOutboxStatsResponse() {
        OutboxStatsResponse stats = new OutboxStatsResponse(12, 3, 150, 2, 167);
        assertThat(stats.pendingCount()).isEqualTo(12);
        assertThat(stats.dispatchingCount()).isEqualTo(3);
        assertThat(stats.deliveredCount()).isEqualTo(150);
        assertThat(stats.deadLetterCount()).isEqualTo(2);
        assertThat(stats.totalCount()).isEqualTo(167);
    }

    @Test
    @DisplayName("OutboxEventSummaryResponse and DetailResponse record immutability")
    void testOutboxEventResponses() {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        String idempotencyKey = "outbox-test-key-123";

        OutboxEventSummaryResponse summary = new OutboxEventSummaryResponse(
                id,
                "ORDER",
                "ord-9988",
                "PAYMENT_REQUESTED",
                OutboxStatus.DELIVERED.name(),
                1,
                3,
                now,
                "disp-1",
                null,
                now,
                now.minusSeconds(60),
                idempotencyKey
        );

        assertThat(summary.id()).isEqualTo(id);
        assertThat(summary.aggregateType()).isEqualTo("ORDER");
        assertThat(summary.aggregateId()).isEqualTo("ord-9988");
        assertThat(summary.eventType()).isEqualTo("PAYMENT_REQUESTED");
        assertThat(summary.status()).isEqualTo("DELIVERED");
        assertThat(summary.attemptCount()).isEqualTo(1);
        assertThat(summary.maxRetries()).isEqualTo(3);
        assertThat(summary.idempotencyKey()).isEqualTo(idempotencyKey);

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("amount", 250.0);
        payload.put("currency", "USD");

        OutboxEventDetailResponse detail = new OutboxEventDetailResponse(
                id,
                "ORDER",
                "ord-9988",
                "PAYMENT_REQUESTED",
                OutboxStatus.DELIVERED.name(),
                1,
                3,
                now,
                "disp-1",
                null,
                now,
                now.minusSeconds(60),
                now,
                idempotencyKey,
                "fingerprint-sha256",
                payload
        );

        assertThat(detail.payload()).isNotNull();
        assertThat(detail.payload().get("amount").asDouble()).isEqualTo(250.0);
        assertThat(detail.payloadFingerprint()).isEqualTo("fingerprint-sha256");
    }

    @Test
    @DisplayName("FairShareConfigResponse metadata verification")
    void testFairShareConfigResponse() {
        FairShareConfigResponse config = new FairShareConfigResponse(
                true,
                1,
                10,
                5L,
                15,
                25
        );

        assertThat(config.enabled()).isTrue();
        assertThat(config.baseQuantum()).isEqualTo(1);
        assertThat(config.maxTenantsPerSweep()).isEqualTo(10);
        assertThat(config.activeTenantsCount()).isEqualTo(5L);
        assertThat(config.totalConfiguredWeight()).isEqualTo(15);
        assertThat(config.totalMaxConcurrency()).isEqualTo(25);
    }
}
