package com.queueforge.api.controller;

import com.queueforge.api.dto.*;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.service.AdminDlqService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/dlq")
public class AdminDlqController {

    private final AdminDlqService dlqService;

    public AdminDlqController(AdminDlqService dlqService) {
        this.dlqService = dlqService;
    }

    /**
     * Lists dead-letter queue jobs with pagination and optional filters.
     */
    @GetMapping
    public ResponseEntity<PageResponse<DlqJobSummaryResponse>> listDlqJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String jobType,
            @RequestParam(required = false) FailureCategory failureCategory) {

        PageResponse<DlqJobSummaryResponse> response = dlqService.listDlqJobs(page, size, jobType, failureCategory);
        return ResponseEntity.ok(response);
    }

    /**
     * Inspects a single job in the dead-letter queue including full payload and error stack.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<DlqJobDetailResponse> getDlqJob(@PathVariable UUID jobId) {
        DlqJobDetailResponse response = dlqService.getDlqJob(jobId);
        return ResponseEntity.ok(response);
    }

    /**
     * Replays a dead-letter job by safely resetting it back to PENDING.
     */
    @PostMapping("/{jobId}/replay")
    public ResponseEntity<ReplayJobResponse> replayJob(@PathVariable UUID jobId) {
        ReplayJobResponse response = dlqService.replayDlqJob(jobId);
        return ResponseEntity.ok(response);
    }

    /**
     * Discards a dead-letter job by archiving it without hard deleting the database row.
     */
    @PostMapping("/{jobId}/discard")
    public ResponseEntity<DiscardJobResponse> discardJob(@PathVariable UUID jobId) {
        DiscardJobResponse response = dlqService.discardDlqJob(jobId);
        return ResponseEntity.ok(response);
    }
}
