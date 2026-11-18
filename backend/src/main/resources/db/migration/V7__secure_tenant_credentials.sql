-- ==============================================================================
-- QueueForge Flyway Migration: V7__secure_tenant_credentials.sql
-- Hardens tenant credentials with SHA-256 verifiers, eliminates plaintext secrets,
-- invalidates hardcoded default keys, and optimizes tenant claim indexes.
-- ==============================================================================

-- 1. Add credential hash and safe prefix columns
ALTER TABLE qf_tenants 
ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64) NULL;

ALTER TABLE qf_tenants 
ADD COLUMN IF NOT EXISTS api_key_prefix VARCHAR(16) NULL;

-- 2. Migrate existing non-default tenant API keys to SHA-256 hash verifiers
UPDATE qf_tenants 
SET api_key_hash = encode(sha256(api_key::bytea), 'hex'),
    api_key_prefix = LEFT(api_key, 8)
WHERE id != 'default' 
  AND api_key IS NOT NULL 
  AND api_key_hash IS NULL;

-- 3. Invalidate insecure hardcoded default tenant key ('qf_tenant_default_key')
-- Prevents any external client from authenticating via the hardcoded secret
UPDATE qf_tenants 
SET api_key_hash = encode(sha256(('disabled_default_key_' || gen_random_uuid())::bytea), 'hex'),
    api_key_prefix = 'qf_disabled'
WHERE id = 'default';

-- 4. Guard against any leftover null hashes
UPDATE qf_tenants 
SET api_key_hash = encode(sha256(('migrated_' || id || '_' || gen_random_uuid())::bytea), 'hex'),
    api_key_prefix = 'qf_migrated'
WHERE api_key_hash IS NULL;

-- 5. Nullify all plaintext API keys so no cleartext secrets persist in the database
UPDATE qf_tenants 
SET api_key = NULL;

ALTER TABLE qf_tenants 
ALTER COLUMN api_key DROP NOT NULL;

ALTER TABLE qf_tenants 
ALTER COLUMN api_key_hash SET NOT NULL;

-- 6. Indexes for secure hash verification and prefix lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_qf_tenants_api_key_hash 
ON qf_tenants (api_key_hash);

CREATE INDEX IF NOT EXISTS idx_qf_tenants_api_key_prefix 
ON qf_tenants (api_key_prefix);

-- 7. High-performance composite index matching exact claim ORDER BY (priority DESC, scheduled_at ASC, id ASC)
-- Eliminates in-memory quicksort during PostgreSQL batch claims
CREATE INDEX IF NOT EXISTS idx_qf_jobs_tenant_claim_v2 
ON qf_jobs (tenant_id, priority DESC, scheduled_at ASC, id ASC) 
WHERE status = 'PENDING';
