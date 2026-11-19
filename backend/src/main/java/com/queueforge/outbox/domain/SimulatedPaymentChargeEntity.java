package com.queueforge.outbox.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "simulated_payment_charges")
public class SimulatedPaymentChargeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "charge_reference", nullable = false, unique = true, length = 64)
    private String chargeReference;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "customer_id", nullable = false, length = 64)
    private String customerId;

    @Column(name = "amount_cents", nullable = false)
    private long amountCents;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ChargeStatus status;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public SimulatedPaymentChargeEntity() {
    }

    public SimulatedPaymentChargeEntity(String chargeReference,
                                        UUID orderId,
                                        String customerId,
                                        long amountCents,
                                        String currency,
                                        ChargeStatus status,
                                        String failureReason) {
        this.chargeReference = chargeReference;
        this.orderId = orderId;
        this.customerId = customerId;
        this.amountCents = amountCents;
        this.currency = currency;
        this.status = status;
        this.failureReason = failureReason;
        this.createdAt = Instant.now();
    }

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getChargeReference() {
        return chargeReference;
    }

    public void setChargeReference(String chargeReference) {
        this.chargeReference = chargeReference;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public void setOrderId(UUID orderId) {
        this.orderId = orderId;
    }

    public String getCustomerId() {
        return customerId;
    }

    public void setCustomerId(String customerId) {
        this.customerId = customerId;
    }

    public long getAmountCents() {
        return amountCents;
    }

    public void setAmountCents(long amountCents) {
        this.amountCents = amountCents;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public ChargeStatus getStatus() {
        return status;
    }

    public void setStatus(ChargeStatus status) {
        this.status = status;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SimulatedPaymentChargeEntity that = (SimulatedPaymentChargeEntity) o;
        return Objects.equals(id, that.id) || Objects.equals(chargeReference, that.chargeReference);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, chargeReference);
    }
}
