package com.queueforge.outbox.repository;

import com.queueforge.outbox.domain.OutboxEventEntity;
import com.queueforge.outbox.domain.OutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, UUID> {
    Optional<OutboxEventEntity> findByIdempotencyKey(String idempotencyKey);
    Optional<OutboxEventEntity> findByAggregateTypeAndAggregateId(String aggregateType, String aggregateId);
    List<OutboxEventEntity> findByStatus(OutboxStatus status);
}
