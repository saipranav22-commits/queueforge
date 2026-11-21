# QueueForge V2 — Phase 11B: GitHub Container Registry (GHCR) Release Plan

**Phase:** Phase 11B — Deployment Pipeline Hardening, GHCR Readiness & Pre-Deployment Validation  
**Date:** November 2026  
**Verified Baseline:** Commit `fc460c248f6360bedfab964bad4a8bf6e6fd0704` on `origin/main`  
**Current Active Branch:** `feature/v2-deployment-preparation`  
**Execution Target:** Phase 11D (Authorized Container Publishing)  
**Status:** **PLAN PREPARED & VALIDATED (NO IMAGES PUSHED IN PHASE 11B)**  

---

## 1. Architectural Strategy & Objectives

The primary operational constraint of deploying QueueForge V2 on an entry-tier 2 vCPU / 4 GB RAM VPS is avoiding host-level compilation. Building Java 21 Spring Boot applications via Maven and frontend bundles via Vite on the host system triggers high CPU spikes, swap thrashing, and memory exhaustion that destabilize running database containers.

To ensure deterministic, rapid, and low-resource deployments:
1. **Build Once, Deploy Anywhere:** All production container images are built, tagged, and tested within GitHub Actions runners.
2. **Pre-Built Immutable Artifacts:** Production images are stored in GitHub Container Registry (`ghcr.io`).
3. **Lightweight Host Deployment:** The VPS pulls immutable pre-built images directly over HTTPS via Docker Compose v2, consuming zero compilation RAM or build CPU.
4. **Instant Rollback:** Deployments are pinned to explicit Git commit SHA tags, allowing instantaneous rollback by updating an environment variable.

---

## 2. GHCR Package Topology

The QueueForge V2 system is decomposed into three distinct container artifacts hosted under the GitHub repository namespace:

| Service Component | GHCR Package Identifier | Base Image | Multi-Stage Build Context |
| :--- | :--- | :--- | :--- |
| **Backend & Workers** | `ghcr.io/saipranav22-commits/queueforge/backend` | `eclipse-temurin:21-jre-alpine` | `backend/Dockerfile`<br>(Maven multi-stage build) |
| **Payment Receiver** | `ghcr.io/saipranav22-commits/queueforge/payment-receiver` | `eclipse-temurin:21-jre-alpine` | `simulated-payment-receiver/Dockerfile`<br>(Maven multi-stage build) |
| **Frontend Control Plane** | `ghcr.io/saipranav22-commits/queueforge/frontend` | `nginx:1.27-alpine` | `frontend/Dockerfile`<br>(Node 22 Vite build -> Nginx Alpine) |

> **Note on Worker Nodes:** Both `worker-1` and `worker-2` utilize the identical `queueforge/backend` image artifact, configured with differing entrypoint profiles or environment variables for worker execution.

---

## 3. Tagging Strategy & Immutability Rules

Every container build enforces a multi-tag hierarchy to guarantee traceability from running production instances directly back to verified Git commits:

1. **Full Commit SHA Tag (Primary Immutable Tag):**
   - Format: `ghcr.io/saipranav22-commits/queueforge/<component>:<full-git-sha>`
   - Example: `backend:fc460c248f6360bedfab964bad4a8bf6e6fd0704`
   - Purpose: Cryptographically immutable link to the exact source tree. Never overwritten.

2. **Short SHA Tag (Convenience Reference):**
   - Format: `ghcr.io/saipranav22-commits/queueforge/<component>:sha-<short-sha>`
   - Example: `backend:sha-fc460c2`
   - Purpose: Human-readable reference matching `git log --oneline`.

3. **Semantic Release Tag (Release Milestone):**
   - Format: `ghcr.io/saipranav22-commits/queueforge/<component>:v2.0.0`
   - Condition: Only generated when a formal release tag is pushed.

4. **Floating Latest Tag:**
   - Format: `ghcr.io/saipranav22-commits/queueforge/<component>:latest`
   - Condition: Only updated when `push_images: true` is explicitly authorized.

### OpenContainers Metadata Standard
All images include standard OCI annotations:
```dockerfile
LABEL org.opencontainers.image.title="QueueForge <component>"
LABEL org.opencontainers.image.description="QueueForge V2 Multi-Tenant Control Plane - <component>"
LABEL org.opencontainers.image.source="https://github.com/saipranav22-commits/queueforge"
LABEL org.opencontainers.image.revision="${{ github.sha }}"
LABEL org.opencontainers.image.licenses="Apache-2.0"
```

---

## 4. GitHub Actions Workflow: `publish-images.yml`

The publishing workflow is engineered in `.github/workflows/publish-images.yml` with strict fail-safe parameters:

```yaml
name: Publish QueueForge V2 Container Images to GHCR

on:
  workflow_dispatch:
    inputs:
      push_images:
        description: 'Publish container images to GitHub Container Registry (ghcr.io)'
        required: true
        type: boolean
        default: false
      image_tag:
        description: 'Additional custom image tag (e.g. v2.0.0, rc1)'
        required: false
        type: string
        default: ''

permissions:
  contents: read
  packages: write
```

### Key Workflow Safeguards:
- **Default Dry-Run Mode:** `push_images` defaults to `false`. Running the workflow without explicit authorization tests the multi-stage Docker build without publishing artifacts.
- **Matrix Parallelism:** Builds `backend`, `payment-receiver`, and `frontend` concurrently using GitHub-hosted runners.
- **Layer Caching:** Utilizes `cache-from: type=gha` and `cache-to: type=gha,mode=max` to drastically accelerate subsequent builds.
- **Digest Verification:** Captures and echoes the unique sha256 container digest (`${{ steps.build-push.outputs.digest }}`) in the job summary for cryptographically verified deployment tracking.

---

## 5. Host Authentication & Image Access Strategy

### Recommended Model: Public GHCR Package Visibility
By default, newly published packages in GHCR under a user account are private. Once the first container push occurs in Phase 11D, package visibility should be adjusted to **Public** in GitHub Package settings:
1. Navigate to GitHub Profile -> **Packages** -> Select `queueforge/backend`, `queueforge/frontend`, `queueforge/payment-receiver`.
2. Package Settings -> Change package visibility -> **Public**.
3. **Operational Advantage:** The VPS host requires **zero credentials or Personal Access Tokens (PAT)** on disk to pull public container images (`docker compose pull`). This completely eliminates token compromise risks from the VPS filesystem.

### Alternative Model: Private GHCR Package Access
If packages remain private:
1. Generate a fine-grained GitHub PAT with `read:packages` permission only.
2. Store the token in the VPS deployment user directory.
3. Authenticate before deployment:
   ```bash
   echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u saipranav22-commits --password-stdin
   ```

---

## 6. VPS Deployment & Rollback Execution Procedure

### Initial Deployment via Pre-Built Images
On the target VPS:
```bash
# 1. Clone or copy deployment directory
cd /opt/queueforge

# 2. Configure environment with desired image tag
cat << 'EOF' >> .env.production
IMAGE_TAG=sha-fc460c2
RECEIVER_IMAGE=ghcr.io/saipranav22-commits/queueforge/payment-receiver:sha-fc460c2
BACKEND_IMAGE=ghcr.io/saipranav22-commits/queueforge/backend:sha-fc460c2
FRONTEND_IMAGE=ghcr.io/saipranav22-commits/queueforge/frontend:sha-fc460c2
EOF

# 3. Execute zero-downtime deployment script
./deploy/vps/deploy.sh
```

### Instant Rollback Runbook
If an anomaly is detected post-deployment:
```bash
# Option A: Automatic rollback using rollback script
./deploy/vps/rollback.sh

# Option B: Manual rollback to prior verified commit SHA
export IMAGE_TAG=sha-prior_verified_sha
./deploy/vps/deploy.sh
```
Because the old image layers remain cached locally on the VPS, rollback executes in under 15 seconds without network transfer.

---

## 7. Phased Implementation Roadmap

- **Phase 11A (Complete):** VPS infrastructure sizing, hosting cost comparison, operational scripts authored.
- **Phase 11B (Current):** Pipeline hardening, script defect resolution, dual Compose parameterization, workflow authoring.
- **Phase 11C (Next):** Publish PR #4 (`feature/v2-deployment-preparation` -> `main`), verify hosted CI execution.
- **Phase 11D:** Merge PR #4, execute authorized GHCR container publication workflow, verify image digests.
- **Phase 11E:** Provision VPS, configure DNS and Let's Encrypt TLS, pull images, seed demo data, and verify live public demo.
