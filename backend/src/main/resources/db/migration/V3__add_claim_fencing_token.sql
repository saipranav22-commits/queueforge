-- ==============================================================================
-- QueueForge Flyway Migration: V3__add_claim_fencing_token.sql
-- Add claim fencing token and claim version for safe distributed ownership
-- ==============================================================================

ALTER TABLE qf_jobs 
ADD COLUMN IF NOT EXISTS claim_token UUID NULL,
ADD COLUMN IF NOT EXISTS claim_version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_qf_jobs_claim_token 
ON qf_jobs (claim_token) 
WHERE claim_token IS NOT NULL;
