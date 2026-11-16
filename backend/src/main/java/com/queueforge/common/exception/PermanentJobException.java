package com.queueforge.common.exception;

/**
 * Thrown by job handlers when a job encounters a non-recoverable error that
 * will never succeed on retry (e.g. invalid payload format, unknown target, fatal domain rejection).
 * QueueForge will immediately route the job to DEAD_LETTER without consuming further retries.
 */
public class PermanentJobException extends RuntimeException {

    public PermanentJobException(String message) {
        super(message);
    }

    public PermanentJobException(String message, Throwable cause) {
        super(message, cause);
    }
}
