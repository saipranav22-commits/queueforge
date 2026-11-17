package com.queueforge.outbox.repository;

import com.queueforge.outbox.domain.SimulatedPaymentChargeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SimulatedPaymentChargeRepository extends JpaRepository<SimulatedPaymentChargeEntity, UUID> {
    Optional<SimulatedPaymentChargeEntity> findByChargeReference(String chargeReference);
    List<SimulatedPaymentChargeEntity> findByOrderId(UUID orderId);
    long countByOrderId(UUID orderId);
}
