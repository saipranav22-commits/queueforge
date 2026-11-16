package com.queueforge.api.controller;

import com.queueforge.api.dto.*;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.service.JobService;
import jakarta.validation.Valid;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    /**
     * Submit an asynchronous job for durable processing.
     * HTTP 202 Accepted.
     */
    @PostMapping
    public ResponseEntity<CreateJobResponse> submitJob(
            @Valid @RequestBody CreateJobRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {

        try {
            if (request.jobType() != null) {
                MDC.put("jobType", request.jobType().trim().toUpperCase());
            }
            CreateJobResponse response = jobService.submitJob(request, idempotencyKey);
            MDC.put("jobId", response.jobId().toString());
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Lists jobs with bounded pagination, optional filters, search, and sorting.
     */
    @GetMapping
    public ResponseEntity<PageResponse<JobSummaryResponse>> listJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(required = false) String jobType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {

        PageResponse<JobSummaryResponse> response = jobService.listJobs(
                page, size, status, jobType, search, sortBy, sortDirection);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve current status and execution metadata of a job.
     * HTTP 200 OK or 404 Not Found.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<JobStatusResponse> getJobStatus(@PathVariable UUID jobId) {
        try {
            MDC.put("jobId", jobId.toString());
            JobStatusResponse response = jobService.getJobStatus(jobId);
            return ResponseEntity.ok(response);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Retrieve full job details including sanitized payload and execution history.
     */
    @GetMapping("/{jobId}/detail")
    public ResponseEntity<JobDetailResponse> getJobDetail(@PathVariable UUID jobId) {
        try {
            MDC.put("jobId", jobId.toString());
            JobDetailResponse response = jobService.getJobDetail(jobId);
            return ResponseEntity.ok(response);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Retrieve persisted execution attempt history for a job.
     */
    @GetMapping("/{jobId}/history")
    public ResponseEntity<List<JobExecutionLogResponse>> getJobHistory(@PathVariable UUID jobId) {
        try {
            MDC.put("jobId", jobId.toString());
            List<JobExecutionLogResponse> history = jobService.getJobHistory(jobId);
            return ResponseEntity.ok(history);
        } finally {
            MDC.clear();
        }
    }
}
