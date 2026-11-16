-- ==============================================================================
-- QueueForge Flyway Migration: V4__add_attempt_and_error_classification.sql
-- Add attempt_count, failure_category, and DLQ indices
-- ==============================================================================

ALTER TABLE qf_jobs 
ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_category VARCHAR(32) NULL;

-- Backfill attempt_count for any existing rows based on retry_count & status
UPDATE qf_jobs 
SET attempt_count = CASE 
    WHEN retry_count > 0 THEN retry_count + 1 
    WHEN status IN ('RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') THEN 1 
    ELSE 0 
END
WHERE attempt_count = 0;

-- Index for filtering by status and failure category
CREATE INDEX IF NOT EXISTS idx_qf_jobs_status_failure_category 
ON qf_jobs (status, failure_category);

-- Index for Dead-Letter Queue browsing and administrative retrieval
CREATE INDEX IF NOT EXISTS idx_qf_jobs_dlq_created 
ON qf_jobs (created_at DESC) 
WHERE status = 'DEAD_LETTER';
