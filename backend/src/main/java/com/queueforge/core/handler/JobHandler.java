package com.queueforge.core.handler;

/**
 * Interface implemented by all executable job handlers in QueueForge.
 * Handlers must be idempotent to support at-least-once delivery guarantees.
 */
public interface JobHandler {

    /**
     * The unique job type identifier this handler processes (e.g., "GENERATE_REPORT").
     */
    String getJobType();

    /**
     * Executes the background job logic.
     * Throws Exception on failure to trigger guarded failure reporting and retry evaluation.
     */
    void handle(JobExecutionContext context) throws Exception;
}
