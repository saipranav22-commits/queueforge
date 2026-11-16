package com.queueforge.common.exception;

import java.util.UUID;

public class JobNotFoundException extends RuntimeException {

    private final UUID jobId;

    public JobNotFoundException(UUID jobId) {
        super(String.format("Job with ID '%s' was not found", jobId));
        this.jobId = jobId;
    }

    public UUID getJobId() {
        return jobId;
    }
}
