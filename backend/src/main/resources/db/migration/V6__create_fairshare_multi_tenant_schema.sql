-- ==============================================================================
-- QueueForge Flyway Migration: V6__create_fairshare_multi_tenant_schema.sql
-- FairShare Multi-Tenant Scheduling Schema & Quota Enforcement
-- ==============================================================================

-- 1. Tenants table: stores identity, scheduling weights, concurrency limits, and DRR state
CREATE TABLE IF NOT EXISTS qf_tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    weight INT NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 100),
    max_concurrency INT NOT NULL DEFAULT 4 CHECK (max_concurrency >= 1),
    deficit_counter NUMERIC(12, 2) NOT NULL DEFAULT 0.0 CHECK (deficit_counter >= 0.0),
    api_key VARCHAR(128) NULL UNIQUE,
    last_scheduled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for tenant authentication by API key
CREATE INDEX IF NOT EXISTS idx_qf_tenants_api_key 
ON qf_tenants (api_key) 
WHERE api_key IS NOT NULL;

-- Index for tenant status lookup
CREATE INDEX IF NOT EXISTS idx_qf_tenants_status 
ON qf_tenants (status);

-- 2. Seed Default System Tenant for backward compatibility
INSERT INTO qf_tenants (id, name, status, weight, max_concurrency, deficit_counter, api_key)
VALUES ('default', 'Default System Tenant', 'ACTIVE', 1, 10, 0.0, 'qf_tenant_default_key')
ON CONFLICT (id) DO NOTHING;

-- 3. Add tenant_id to persistent jobs table with explicit foreign key and default value
ALTER TABLE qf_jobs 
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES qf_tenants(id) ON DELETE RESTRICT;

-- 4. Add tenant_id to job execution audit logs table
ALTER TABLE qf_job_execution_logs 
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NULL REFERENCES qf_tenants(id) ON DELETE SET NULL;

-- Backfill audit logs to default tenant where null
UPDATE qf_job_execution_logs
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

-- 5. High-performance tenant-aware indexes
-- Index for tenant-partitioned contention-free claiming with SELECT FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_qf_jobs_tenant_claimable 
ON qf_jobs (tenant_id, priority DESC, scheduled_at ASC) 
WHERE status = 'PENDING';

-- Index for microsecond tenant concurrency checks
CREATE INDEX IF NOT EXISTS idx_qf_jobs_tenant_running 
ON qf_jobs (tenant_id, status) 
WHERE status = 'RUNNING';

-- Index for tenant-isolated Dead-Letter Queue retrieval
CREATE INDEX IF NOT EXISTS idx_qf_jobs_tenant_dlq 
ON qf_jobs (tenant_id, created_at DESC) 
WHERE status = 'DEAD_LETTER';

-- Index for tenant status queries and pagination
CREATE INDEX IF NOT EXISTS idx_qf_jobs_tenant_status 
ON qf_jobs (tenant_id, status);

-- Index for tenant execution log queries
CREATE INDEX IF NOT EXISTS idx_qf_logs_tenant_id 
ON qf_job_execution_logs (tenant_id);
