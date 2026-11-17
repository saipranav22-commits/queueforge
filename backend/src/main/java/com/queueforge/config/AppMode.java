package com.queueforge.config;

/**
 * Architectural deployment mode for QueueForge instances in a distributed cluster.
 */
public enum AppMode {
    /**
     * Runs both API endpoints and the local background worker execution pool (single-node default).
     */
    COMBINED,

    /**
     * Ingress-only node serving REST endpoints, Swagger, and Admin DLQ APIs.
     * Background worker coordinator is disabled.
     */
    API_ONLY,

    /**
     * Dedicated execution node claiming jobs via PostgreSQL row locking.
     * Ingress business APIs reject write requests; Actuator metrics and health endpoints remain active.
     */
    WORKER_ONLY
}
