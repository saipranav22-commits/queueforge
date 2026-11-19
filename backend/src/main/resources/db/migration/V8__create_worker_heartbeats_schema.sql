-- ==============================================================================
-- QueueForge Flyway Migration: V8__create_worker_heartbeats_schema.sql
-- Real Distributed Worker Registration & Heartbeat Discovery
-- ==============================================================================

CREATE TABLE IF NOT EXISTS qf_worker_heartbeats (
    instance_id VARCHAR(64) PRIMARY KEY,
    mode VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    concurrency INT NOT NULL,
    active_jobs INT NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qf_worker_heartbeats_status
ON qf_worker_heartbeats (status, last_heartbeat);
