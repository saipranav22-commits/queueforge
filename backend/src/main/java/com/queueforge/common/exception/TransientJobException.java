package com.queueforge.common.exception;

/**
 * Thrown by job handlers when a job encounters a recoverable, temporary error
 * (e.g. downstream network timeout, rate limit, temporary database deadlock).
 * QueueForge will apply exponential backoff and reschedule the job until retry budget is exhausted.
 */
public class TransientJobException extends RuntimeException {

    public TransientJobException(String message) {
        super(message);
    }

    public TransientJobException(String message, Throwable cause) {
        super(message, cause);
    }
}
