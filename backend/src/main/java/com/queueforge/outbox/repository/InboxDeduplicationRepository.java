package com.queueforge.outbox.repository;

import com.queueforge.outbox.domain.InboxDeduplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InboxDeduplicationRepository extends JpaRepository<InboxDeduplicationEntity, String> {
    Optional<InboxDeduplicationEntity> findByIdempotencyKey(String idempotencyKey);
}
