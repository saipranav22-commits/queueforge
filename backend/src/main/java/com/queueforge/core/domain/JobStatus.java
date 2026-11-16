package com.queueforge.core.domain;

public enum JobStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    RETRY_SCHEDULED,
    DEAD_LETTER,
    ARCHIVED
}
