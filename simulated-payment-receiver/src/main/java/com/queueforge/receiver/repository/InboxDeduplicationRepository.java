package com.queueforge.receiver.repository;

import com.queueforge.receiver.domain.InboxDeduplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InboxDeduplicationRepository extends JpaRepository<InboxDeduplication, String> {
    Optional<InboxDeduplication> findByIdempotencyKey(String idempotencyKey);
}
