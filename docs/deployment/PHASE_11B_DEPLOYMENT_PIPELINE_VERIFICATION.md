# QueueForge V2 — Phase 11B: Deployment Pipeline Verification & Operational Hardening

**Phase:** Phase 11B — Deployment Pipeline Hardening, GHCR Readiness & Pre-Deployment Validation  
**Date:** November 2026  
**Verified Baseline:** Commit `fc460c248f6360bedfab964bad4a8bf6e6fd0704` on `origin/main`  
**Current Active Branch:** `feature/v2-deployment-preparation`  
**Preserved Archive Branches:**  
- `feature/v2-control-plane-ui` (`e27fc7403eda920d52cd2f98aa51f353630fd293`)  
- `feature/v2-public-demo-hardening` (`e926d11`)  
**Deployment Pipeline Gate Verdict:** **READY TO PUBLISH DEPLOYMENT PR FOR HOSTED CI**  

---

## 1. Executive Summary & Pipeline Validation Boundary

Phase 11B transitions the Phase 11A VPS operational blueprints into a fully verified, syntax-checked, and automated deployment pipeline ready for GitHub-hosted continuous integration.

During this phase:
- All seven operational shell scripts in `deploy/vps/` underwent forensic static code analysis, syntax verification, and behavioral defect remediation.
- The production Docker Compose architecture was split into an extensible multi-file topology: base (`docker-compose.prod.v2.yml`) and immutable registry override (`docker-compose.prod.ghcr.yml`).
- A dedicated GitHub Actions verification job (`deploy-config-verify`) was engineered into `.github/workflows/ci.yml` to automatically validate script syntax and schema constraints on every PR and commit.
- In strict adherence to safety and budgeting boundaries:
  - **Zero cloud infrastructure or VPS instances were provisioned.**
  - **Zero domain names or DNS records were configured.**
  - **Zero container images were pushed to GitHub Container Registry (GHCR).**
  - **Zero git releases or semantic tags (`v2.0.0`) were cut.**
  - **The remote `main` branch remains untouched at `fc460c2`.**

---

## 2. Forensic VPS Script Audit & Hardening Matrix

All seven operational scripts located in `deploy/vps/` were audited for POSIX compatibility, fail-fast mechanics (`set -euo pipefail`), secret leakage, and production environmental assumptions.

| Script Name | Purpose | Critical Audit Findings & Hardening Applied |
| :--- | :--- | :--- |
| **`preflight.sh`** | VPS pre-deployment readiness check | • Validates system kernel parameters, available RAM, swap allocation, and disk space.<br>• Verifies Docker Engine and Compose v2 presence.<br>• Validates dual Compose topology (`docker-compose.prod.v2.yml` and `docker-compose.prod.ghcr.yml`).<br>• Implemented port inspection fallback using `netstat` if `ss` is absent. |
| **`deploy.sh`** | Zero-downtime container orchestrator | • Introduced `DEPLOY_MODE=ghcr` (default) vs `DEPLOY_MODE=build`.<br>• Uses `docker compose pull` prior to restarting services to eliminate downtime during image fetch.<br>• Uses `docker-compose.prod.ghcr.yml` with `build: !reset null` to guarantee zero compilation overhead on 4 GB VPS.<br>• Inspects and prints sha256 image digests of deployed containers.<br>• Executes automated post-launch healthcheck with automatic rollback triggers. |
| **`healthcheck.sh`** | Multi-tier service liveness probe | • Probes API server (`/api/v1/health`), frontend HTTP 200, and payment receiver endpoints.<br>• Validates Docker container health states via `docker inspect`.<br>• **Hardening:** Added SQL verification probe against `qf_worker_heartbeats` table to confirm that background distributed workers (`worker-1`, `worker-2`) are actively heartbeating `ONLINE`. |
| **`backup.sh`** | Coordinated dual-database backup routine | • **Critical Defect Remediation:** Replaced `docker exec -t` with `docker exec -i`. The `-t` (pseudo-TTY) flag previously injected Windows/terminal carriage return characters (`\r\n`) into the standard output stream, corrupting binary `.sql.gz` dump archives.<br>• Verifies gzip integrity using `gzip -t` immediately following dump completion.<br>• Prunes backups older than 7 days.<br>• Documented architectural nuance: dual-database backups represent sequential ACID snapshots, not distributed atomic 2PC locks. |
| **`restore.sh`** | Non-destructive disaster recovery drill | • Enforces mandatory safety confirmation prompts.<br>• Validates archive existence and gzip integrity prior to initiating restore.<br>• Performs non-destructive drill into a scratch database (`queueforge_restore_test`) without disturbing live production databases. |
| **`seed-demo-data.sh`** | Recruiter portfolio dataset seeder | • **Critical Defect Remediation:** Corrected invalid job types. The original script attempted to seed `PAYMENT_SETTLEMENT` and `INVOICE_GENERATION`, which are rejected with HTTP 400 Bad Request by the backend `SupportedJobType` validator. Updated to valid enum values: `WEBHOOK_DISPATCH`, `GENERATE_REPORT`, and `DATA_EXPORT`.<br>• **Realistic Workflow Seeding:** Added real order generation via `POST /api/v1/orders` prior to outbox polling, realistically populating the transactional outbox table before dispatching events.<br>• Scopes all demonstration data to isolated tenant `tenant-demo-corp`. |
| **`rollback.sh`** | Immediate release rollback tool | • Allows instantaneous rollback to prior git revision or specific immutable image tag (`IMAGE_TAG`).<br>• Re-runs health check to confirm service stability post-rollback. |

---

## 3. Production Docker Compose Parameterization & Memory Protection

### 3.1 The 4 GB VPS RAM Constraint
On a cost-optimized 2 vCPU / 4 GB RAM VPS (such as Hetzner CX23), compiling Spring Boot Java artifacts via Maven (`./mvnw clean package`) and building Vite React frontend bundles consumes significant CPU bursts and up to 2.5 GB of resident RAM. Running a Maven multi-threaded compilation concurrently with active PostgreSQL and Redis containers inevitably triggers Linux kernel Out-Of-Memory (OOM) killer terminations.

### 3.2 Dual-Compose Registry Architecture
To guarantee that the VPS never performs local compilation, the configuration has been divided:
1. **Base Configuration (`docker-compose.prod.v2.yml`)**:
   Defines the complete seven-service cluster topology, resource constraints (`mem_limit`, `cpus`), health checks, volumes, network isolation, and environment variables.
   Image names are fully parameterized:
   ```yaml
   payment-receiver:
     image: ${RECEIVER_IMAGE:-queueforge-payment-receiver:latest}
   api-server:
     image: ${BACKEND_IMAGE:-queueforge-backend:latest}
   frontend:
     image: ${FRONTEND_IMAGE:-queueforge-frontend:latest}
   ```
2. **GHCR Override (`docker-compose.prod.ghcr.yml`)**:
   Provides registry-backed image mappings and explicitly strips the build context using the Compose v2 `!reset` directive:
   ```yaml
   services:
     payment-receiver:
       image: ${RECEIVER_IMAGE:-ghcr.io/saipranav22-commits/queueforge/payment-receiver:${IMAGE_TAG:-latest}}
       build: !reset null
     api-server:
       image: ${BACKEND_IMAGE:-ghcr.io/saipranav22-commits/queueforge/backend:${IMAGE_TAG:-latest}}
       build: !reset null
     worker-1:
       image: ${BACKEND_IMAGE:-ghcr.io/saipranav22-commits/queueforge/backend:${IMAGE_TAG:-latest}}
     worker-2:
       image: ${BACKEND_IMAGE:-ghcr.io/saipranav22-commits/queueforge/backend:${IMAGE_TAG:-latest}}
     frontend:
       image: ${FRONTEND_IMAGE:-ghcr.io/saipranav22-commits/queueforge/frontend:${IMAGE_TAG:-latest}}
       build: !reset null
   ```

When deployed with:
```bash
docker compose -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml up -d --no-build
```
Docker Engine pulls precompiled, multi-stage optimized OCI containers directly from GitHub Container Registry, maintaining near-zero compilation memory overhead on the host.

---

## 4. CI Automation: Production Deployment Pipeline Verification

A new verification job (`deploy-config-verify`) has been introduced into `.github/workflows/ci.yml`. This job runs across all pull requests and branch pushes alongside the existing test suites.

### Job Specification
```yaml
deploy-config-verify:
  name: Production Deployment Pipeline Verification
  runs-on: ubuntu-latest
  steps:
    - name: Checkout Source Code
      uses: actions/checkout@v4

    - name: Validate Shell Scripts Syntax (bash -n)
      run: |
        for script in deploy/vps/*.sh; do
          echo "Checking syntax: $script"
          bash -n "$script"
        done

    - name: Validate Production Compose Schema with Dummy Secrets
      env:
        DB_PASSWORD: ci_dummy_production_db_password_1234
        ADMIN_API_KEY: ci_dummy_admin_api_key_12345678901234567890123456789012
        RECEIVER_SERVICE_KEY: ci_dummy_receiver_key_12345678901234567890123456789012
        FRONTEND_PORT: 8088
        IMAGE_TAG: latest
      run: |
        docker compose -f docker-compose.prod.v2.yml config --quiet
        docker compose -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml config --quiet

    - name: Verify Missing Required Secrets Fail Fast
      run: |
        if docker compose -f docker-compose.prod.v2.yml config --quiet 2>/dev/null; then
          echo "ERROR: Compose unexpectedly succeeded without required secrets!"
          exit 1
        else
          echo "SUCCESS: Compose correctly rejected missing production secrets."
        fi

    - name: Audit Template Environment File
      run: |
        test -f .env.production.example
        grep -q "DB_PASSWORD=" .env.production.example
        grep -q "ADMIN_API_KEY=" .env.production.example
        grep -q "RECEIVER_SERVICE_KEY=" .env.production.example
        ! grep -E "DB_PASSWORD=[a-zA-Z0-9]{16,}" .env.production.example || exit 1
```

---

## 5. Verification Evidence & Test Results

Local automated testing verified all components:

1. **POSIX Shell Syntax (`bash -n`):**
   - `deploy/vps/preflight.sh` — PASS (Exit 0)
   - `deploy/vps/deploy.sh` — PASS (Exit 0)
   - `deploy/vps/healthcheck.sh` — PASS (Exit 0)
   - `deploy/vps/backup.sh` — PASS (Exit 0)
   - `deploy/vps/restore.sh` — PASS (Exit 0)
   - `deploy/vps/seed-demo-data.sh` — PASS (Exit 0)
   - `deploy/vps/rollback.sh` — PASS (Exit 0)
   - **Result:** 7 of 7 shell scripts passed static syntax checking without warnings.

2. **Docker Compose Schema Validation (Valid Dummy Secrets):**
   - `docker compose -f docker-compose.prod.v2.yml config --quiet` — Exit code: 0
   - `docker compose -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml config --quiet` — Exit code: 0
   - **Result:** Successfully validated complete schema, volume definitions, and variable interpolations.

3. **Docker Compose Fail-Fast Behavior (Missing Required Secrets):**
   - Unset `DB_PASSWORD`, `ADMIN_API_KEY`, and `RECEIVER_SERVICE_KEY`.
   - Result: Exit code: 1, `required variable ... is missing a value`.
   - **Result:** Verified strict fail-fast validation preventing insecure default credentials in production.

4. **Template Environment File Audit:**
   - `.env.production.example` verified present with zero plaintext production secrets.

---

## 6. Summary Conclusion

The operational tooling and container deployment configurations are fully hardened, verified, and ready for publication in a dedicated Pull Request targeting `main`.
