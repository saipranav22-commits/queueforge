-- ==============================================================================
-- QueueForge Flyway Migration: V2__add_idempotency_fingerprint.sql
-- Add request SHA-256 fingerprint for idempotency conflict detection
-- ==============================================================================

ALTER TABLE qf_jobs 
ADD COLUMN IF NOT EXISTS idempotency_fingerprint VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS idx_qf_jobs_idempotency 
ON qf_jobs (idempotency_key) 
WHERE idempotency_key IS NOT NULL;
