package com.queueforge.outbox.controller;

import com.queueforge.outbox.service.OutboxDispatcherService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/outbox")
public class OutboxController {

    private final OutboxDispatcherService dispatcherService;

    public OutboxController(OutboxDispatcherService dispatcherService) {
        this.dispatcherService = dispatcherService;
    }

    @PostMapping("/dispatch")
    public ResponseEntity<Map<String, Object>> dispatchNow(
            @RequestParam(defaultValue = "10") int batchSize,
            @RequestParam(defaultValue = "10") int leaseDurationSeconds) {
        int delivered = dispatcherService.dispatchPendingEvents(batchSize, leaseDurationSeconds);
        return ResponseEntity.ok(Map.of(
                "dispatchedCount", delivered,
                "batchSize", batchSize,
                "leaseDurationSeconds", leaseDurationSeconds
        ));
    }
}
