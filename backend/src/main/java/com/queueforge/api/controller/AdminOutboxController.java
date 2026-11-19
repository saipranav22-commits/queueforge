package com.queueforge.api.controller;

import com.queueforge.api.dto.OutboxEventDetailResponse;
import com.queueforge.api.dto.OutboxEventSummaryResponse;
import com.queueforge.api.dto.OutboxStatsResponse;
import com.queueforge.api.dto.PageResponse;
import com.queueforge.outbox.domain.OutboxStatus;
import com.queueforge.outbox.service.OutboxDispatcherService;
import com.queueforge.outbox.service.OutboxQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Administrative controller for outbox observability and manual event dispatch.
 * Guarded by AdminAuthInterceptor (requires X-Admin-Key header or authenticated session)
 * and AppModeGuardInterceptor (rejects mutating requests with 503 on WORKER_ONLY nodes).
 */
@RestController
@RequestMapping("/api/v1/admin/outbox")
public class AdminOutboxController {

    private static final Logger log = LoggerFactory.getLogger(AdminOutboxController.class);

    private static final int MIN_BATCH_SIZE = 1;
    private static final int MAX_BATCH_SIZE = 50;
    private static final int MIN_LEASE_SECONDS = 1;
    private static final int MAX_LEASE_SECONDS = 60;

    private final OutboxDispatcherService dispatcherService;
    private final OutboxQueryService queryService;

    public AdminOutboxController(OutboxDispatcherService dispatcherService,
                                 OutboxQueryService queryService) {
        this.dispatcherService = dispatcherService;
        this.queryService = queryService;
    }

    /**
     * Retrieve aggregated counts across all outbox event delivery statuses.
     */
    @GetMapping("/stats")
    public ResponseEntity<OutboxStatsResponse> getStats() {
        return ResponseEntity.ok(queryService.getStats());
    }

    /**
     * List outbox events with bounded pagination, status filters, search, and sorting.
     */
    @GetMapping("/events")
    public ResponseEntity<PageResponse<OutboxEventSummaryResponse>> listEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) OutboxStatus status,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {

        PageResponse<OutboxEventSummaryResponse> response = queryService.listEvents(
                page, size, status, eventType, search, sortBy, sortDirection);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve full details and payload for a specific outbox event.
     */
    @GetMapping("/events/{id}")
    public ResponseEntity<OutboxEventDetailResponse> getEventDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(queryService.getEventDetail(id));
    }

    /**
     * Manually trigger immediate outbox event dispatch.
     */
    @PostMapping("/dispatch")
    public ResponseEntity<Map<String, Object>> dispatchNow(
            @RequestParam(defaultValue = "10") int batchSize,
            @RequestParam(defaultValue = "10") int leaseDurationSeconds) {

        int boundedBatch = Math.min(Math.max(batchSize, MIN_BATCH_SIZE), MAX_BATCH_SIZE);
        int boundedLease = Math.min(Math.max(leaseDurationSeconds, MIN_LEASE_SECONDS), MAX_LEASE_SECONDS);

        log.info("[AdminOutbox] Manual outbox dispatch requested (requestedBatch={}, boundedBatch={}, requestedLease={}s, boundedLease={}s)",
                batchSize, boundedBatch, leaseDurationSeconds, boundedLease);

        int delivered = dispatcherService.dispatchPendingEvents(boundedBatch, boundedLease);

        return ResponseEntity.ok(Map.of(
                "dispatchedCount", delivered,
                "batchSize", boundedBatch,
                "leaseDurationSeconds", boundedLease
        ));
    }
}
