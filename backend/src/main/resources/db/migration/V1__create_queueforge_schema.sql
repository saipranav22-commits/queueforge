-- ==============================================================================
-- QueueForge Flyway Migration: V1__create_queueforge_schema.sql
-- Initial Schema: Persistent Jobs & Execution Audit Logs
-- ==============================================================================

-- Enable pgcrypto for UUID generation if needed (gen_random_uuid is native in PG 13+)
CREATE TABLE IF NOT EXISTS qf_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(128) UNIQUE,
    job_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    priority INT NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until TIMESTAMPTZ NULL,
    locked_by VARCHAR(64) NULL,
    
    last_error_message TEXT NULL,
    last_error_stack TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NULL
);

-- Index 1: Critical for contention-free polling with SELECT FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_qf_jobs_claimable 
ON qf_jobs (priority DESC, scheduled_at ASC) 
WHERE status = 'PENDING';

-- Index 2: Efficient scanning for orphaned/crashed worker leases
CREATE INDEX IF NOT EXISTS idx_qf_jobs_lease_recovery 
ON qf_jobs (lease_until ASC) 
WHERE status = 'RUNNING';

-- Index 3: Filter by status and type for management queries & DLQ inspection
CREATE INDEX IF NOT EXISTS idx_qf_jobs_status_type 
ON qf_jobs (status, job_type);

-- Audit table: Tracks every execution attempt and timing
CREATE TABLE IF NOT EXISTS qf_job_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES qf_jobs(id) ON DELETE CASCADE,
    worker_id VARCHAR(64) NOT NULL,
    attempt INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    execution_time_ms BIGINT NOT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qf_logs_job_id 
ON qf_job_execution_logs (job_id);
