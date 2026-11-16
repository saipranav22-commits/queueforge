package com.queueforge.api.controller;

import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.api.dto.CreateJobResponse;
import com.queueforge.api.dto.JobStatusResponse;
import com.queueforge.service.JobService;
import jakarta.validation.Valid;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
