package com.queueforge.receiver.repository;

import com.queueforge.receiver.domain.SimulatedPaymentCharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChargeRepository extends JpaRepository<SimulatedPaymentCharge, UUID> {
    Optional<SimulatedPaymentCharge> findByChargeReference(String chargeReference);
    List<SimulatedPaymentCharge> findByOrderId(UUID orderId);
    long countByOrderId(UUID orderId);
}
