package com.queueforge.outbox.service;

import com.queueforge.api.dto.OutboxEventDetailResponse;
import com.queueforge.api.dto.OutboxEventSummaryResponse;
import com.queueforge.api.dto.OutboxStatsResponse;
import com.queueforge.api.dto.PageResponse;
import com.queueforge.common.exception.ResourceNotFoundException;
import com.queueforge.outbox.domain.OutboxEventEntity;
import com.queueforge.outbox.domain.OutboxStatus;
import com.queueforge.outbox.repository.OutboxEventRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class OutboxQueryService {

    private final OutboxEventRepository outboxEventRepository;

    public OutboxQueryService(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Transactional(readOnly = true)
    public OutboxStatsResponse getStats() {
        long pending = outboxEventRepository.countByStatus(OutboxStatus.PENDING);
        long dispatching = outboxEventRepository.countByStatus(OutboxStatus.DISPATCHING);
        long delivered = outboxEventRepository.countByStatus(OutboxStatus.DELIVERED);
        long deadLetter = outboxEventRepository.countByStatus(OutboxStatus.DEAD_LETTER);
        long total = pending + dispatching + delivered + deadLetter;

        return new OutboxStatsResponse(pending, dispatching, delivered, deadLetter, total);
    }

    @Transactional(readOnly = true)
    public PageResponse<OutboxEventSummaryResponse> listEvents(
            int page,
            int size,
            OutboxStatus status,
            String eventType,
            String search,
            String sortBy,
            String sortDirection) {

        int boundedPage = Math.max(0, page);
        int boundedSize = Math.min(100, Math.max(1, size));

        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortProperty = switch (sortBy != null ? sortBy.toLowerCase() : "") {
            case "updatedat" -> "updatedAt";
            case "attemptcount" -> "attemptCount";
            case "status" -> "status";
            case "eventtype" -> "eventType";
            default -> "createdAt";
        };

        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(direction, sortProperty));

        Specification<OutboxEventEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (eventType != null && !eventType.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("eventType")), eventType.trim().toUpperCase()));
            }
            if (search != null && !search.isBlank()) {
                String searchTrimmed = search.trim();
                Predicate idMatch = null;
                try {
                    UUID searchUuid = UUID.fromString(searchTrimmed);
                    idMatch = cb.equal(root.get("id"), searchUuid);
                } catch (IllegalArgumentException ignored) {
                }

                Predicate keyMatch = cb.like(cb.lower(root.get("idempotencyKey")), "%" + searchTrimmed.toLowerCase() + "%");
                Predicate aggMatch = cb.like(cb.lower(root.get("aggregateId")), "%" + searchTrimmed.toLowerCase() + "%");

                List<Predicate> searchOr = new ArrayList<>();
                if (idMatch != null) {
                    searchOr.add(idMatch);
                }
                searchOr.add(keyMatch);
                searchOr.add(aggMatch);
                predicates.add(cb.or(searchOr.toArray(new Predicate[0])));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<OutboxEventEntity> resultPage = outboxEventRepository.findAll(spec, pageable);

        List<OutboxEventSummaryResponse> content = resultPage.getContent().stream()
                .map(this::toSummaryResponse)
                .toList();

        return new PageResponse<>(
                content,
                resultPage.getNumber(),
                resultPage.getSize(),
                resultPage.getTotalElements(),
                resultPage.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public OutboxEventDetailResponse getEventDetail(UUID id) {
        OutboxEventEntity entity = outboxEventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Outbox event not found: " + id));

        return new OutboxEventDetailResponse(
                entity.getId(),
                entity.getAggregateType(),
                entity.getAggregateId(),
                entity.getEventType(),
                entity.getStatus().name(),
                entity.getAttemptCount(),
                entity.getMaxRetries(),
                entity.getNextRetryAt(),
                entity.getClaimedBy(),
                entity.getLastError(),
                entity.getDeliveredAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getIdempotencyKey(),
                entity.getPayloadFingerprint(),
                entity.getPayload()
        );
    }

    private OutboxEventSummaryResponse toSummaryResponse(OutboxEventEntity entity) {
        return new OutboxEventSummaryResponse(
                entity.getId(),
                entity.getAggregateType(),
                entity.getAggregateId(),
                entity.getEventType(),
                entity.getStatus().name(),
                entity.getAttemptCount(),
                entity.getMaxRetries(),
                entity.getNextRetryAt(),
                entity.getClaimedBy(),
                entity.getLastError(),
                entity.getDeliveredAt(),
                entity.getCreatedAt(),
                entity.getIdempotencyKey()
        );
    }
}
