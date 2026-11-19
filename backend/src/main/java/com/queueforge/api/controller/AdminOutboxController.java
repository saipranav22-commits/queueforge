package com.queueforge.api.controller;

import com.queueforge.outbox.service.OutboxDispatcherService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Administrative controller for triggering manual outbox event dispatch.
 * Guarded by AdminAuthInterceptor (requires X-Admin-Key header or authenticated session)
 * and AppModeGuardInterceptor (rejects with 503 on WORKER_ONLY nodes).
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

    public AdminOutboxController(OutboxDispatcherService dispatcherService) {
        this.dispatcherService = dispatcherService;
    }

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
