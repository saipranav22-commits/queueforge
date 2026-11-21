# QueueForge V2 — Phase 11A: Live Deployment Infrastructure Preparation & Final Pre-Provisioning Gate

**Phase:** Phase 11A — Live Deployment Infrastructure Preparation & Final Pre-Provisioning Gate  
**Date:** November 2026  
**Verified Baseline:** Commit `fc460c248f6360bedfab964bad4a8bf6e6fd0704` on `origin/main`  
**Current Active Branch:** `feature/v2-deployment-preparation`  
**Preserved Archive Branches:**  
- `feature/v2-control-plane-ui` (`e27fc7403eda920d52cd2f98aa51f353630fd293`)  
- `feature/v2-public-demo-hardening` (`e926d11`)  
**Verified CI Workflow:** [Run 44911050985](https://github.com/saipranav22-commits/queueforge/actions/runs/44911050985) (100% Green across 6 jobs)  
**Final Pre-Provisioning Verdict:** **READY FOR USER HOSTING DECISION**  

---

## 1. Executive Summary & Pre-Provisioning Boundary

Phase 11A establishes complete operational and deployment readiness for QueueForge V2 without incurring cloud infrastructure costs or prematurely provisioning servers.

All operational scripts, preflight validators, health checks, coordinated dual-database backup routines, non-destructive restore tests, and recruiter demo seeding workflows have been authored, verified against Compose specifications, and committed to the isolated branch `feature/v2-deployment-preparation`.

In strict compliance with release boundaries:
- **Zero cloud resources were purchased or provisioned.**
- **Zero domains or DNS records were registered.**
- **Zero container images were pushed to registries.**
- **Zero git tags or GitHub releases were published.**
- **The remote `main` branch remains unmodified.**

---

## 2. Definitive 22-Point Pre-Provisioning Report

### 1. Verified Main Commit
`fc460c248f6360bedfab964bad4a8bf6e6fd0704` (Merged Pull Request #3 with 6/6 green GitHub Actions jobs).

### 2. Local Branch and HEAD
- Active Branch: `feature/v2-deployment-preparation` (tracking `origin/main`).
- Clean separation from previous documentation branches.

### 3. Recommended VPS Provider
**Hetzner Cloud** (Cost-Optimized x86 standard line).

### 4. Hosting Region
**Falkenstein (FSN1) or Nuremberg (NBG1), Germany** (or **Ashburn, VA (IAD), USA** for North American recruiter focus).

### 5. VPS Specifications
- Plan: **CX23**
- Compute: **2 shared vCPUs** (x86-64)
- Memory: **4 GB RAM**
- Storage: **40 GB NVMe SSD**
- Network: **20 TB monthly traffic included** (1 Gbps port)
- Operating System: **Ubuntu 24.04 LTS x86_64**

### 6. Monthly Cost Breakdown
- Hetzner CX23 Base: **€5.49 / month (~$6.00 USD)**
- Primary IPv4: **~$0.55 / month** (if unbundled)
- Automated Daily Backups (20%): **~$1.20 / month**
- Domain Amortization: **~$1.00 / month**
- **Total Operating Ceiling:** **$8.75 – $9.00 USD / month** (vs. $29.80/mo on DigitalOcean).

### 7. Exact Seven-Service Topology
Verified matching [docker-compose.prod.v2.yml](file:///D:/Projects/QueueForge/docker-compose.prod.v2.yml):
1. `sender-db`: PostgreSQL 16.8 (Queuing & Outbox Storage, 384 MB limit)
2. `receiver-db`: PostgreSQL 16.8 (Idempotent Payment Inbox, 256 MB limit)
3. `payment-receiver`: JVM Service (Webhook Target, 256 MB limit)
4. `api-server`: Spring Boot JVM (Ingestion API & Admin Mission Control, 512 MB limit)
5. `worker-1`: Spring Boot JVM (Distributed Worker Node 1, 384 MB limit)
6. `worker-2`: Spring Boot JVM (Distributed Worker Node 2, 384 MB limit)
7. `frontend`: Nginx 1.27 (Obsidian Pulse UI & Reverse Proxy, 128 MB limit)
- *Total Memory Bounded:* ~2.3 GB (leaves 1.7 GB headroom on 4 GB VPS).
- *Zero Redis or JWT dependencies.*

### 8. TLS & Domain Strategy
- Host Edge: Caddy Reverse Proxy listening on ports 80/443.
- Automated Certificates: ACME HTTP-01 challenge via Let's Encrypt with automated renewal.
- Upstream Forwarding: Proxies strictly to `127.0.0.1:8088`.
- Header Sanitization: Strips untrusted client forwarding headers and enforces `X-Forwarded-Proto: https`.

### 9. Public-Demo Access Model
- Anonymous Recruiter View: Read-only access allowlisted for 5 summary DTOs (`/dlq`, `/outbox/stats`, `/outbox/events`, `/tenants`, `/scheduler-config`).
- Sensitive Field Masking: Excludes raw job payloads, stack traces, payment details, and tenant API keys.
- Owner Access: Full mutation capability preserved via `X-Admin-Key` header or authenticated `QF_SESSION` cookie.

### 10. Production Environment Requirements
- Enforces [`.env.production.example`](file:///D:/Projects/QueueForge/.env.production.example) with permissions `600`.
- Mandatory secrets: `DB_PASSWORD`, `ADMIN_API_KEY`, `RECEIVER_SERVICE_KEY`.
- Fails fast on startup if secrets are missing or placeholder defaults.

### 11. Image Build & Registry Plan
- CI Build Pipeline: Multi-arch container builds executed in GitHub Actions.
- Target Registry: GitHub Container Registry (`ghcr.io/saipranav22-commits/queueforge/*`).
- Deployment Mechanism: The 4 GB VPS pulls immutable prebuilt image tags, eliminating memory-exhausting local compilation.

### 12. Backup & Coordinated Restore Plan
- Automated Script: [`deploy/vps/backup.sh`](file:///D:/Projects/QueueForge/deploy/vps/backup.sh) generates synchronized `pg_dump` archives with SHA-256 checksums.
- Retention: Automated 7-day pruning.
- Verification Script: [`deploy/vps/restore-test.sh`](file:///D:/Projects/QueueForge/deploy/vps/restore-test.sh) tests restorations in ephemeral test containers without disrupting production.

### 13. Resource Monitoring Plan
- Script: [`deploy/vps/healthcheck.sh`](file:///D:/Projects/QueueForge/deploy/vps/healthcheck.sh).
- Actuator Readiness: Probes `/actuator/health/readiness` on API and Receiver.
- Swap Protection: 2 GB swapfile created by `prepare-host.sh` with `swappiness=10`.

### 14. Demo Data Strategy
- Script: [`deploy/vps/seed-demo-data.sh`](file:///D:/Projects/QueueForge/deploy/vps/seed-demo-data.sh).
- Populates synthetic tenants (`NovaPay Global`, `Starlight Retail`), multi-priority jobs, outbox transactions, and categorized DLQ failures.

### 15. Deployment Scripts Created
- [deploy/vps/README.md](file:///D:/Projects/QueueForge/deploy/vps/README.md)
- [deploy/vps/prepare-host.sh](file:///D:/Projects/QueueForge/deploy/vps/prepare-host.sh)
- [deploy/vps/preflight.sh](file:///D:/Projects/QueueForge/deploy/vps/preflight.sh)
- [deploy/vps/deploy.sh](file:///D:/Projects/QueueForge/deploy/vps/deploy.sh)
- [deploy/vps/healthcheck.sh](file:///D:/Projects/QueueForge/deploy/vps/healthcheck.sh)
- [deploy/vps/backup.sh](file:///D:/Projects/QueueForge/deploy/vps/backup.sh)
- [deploy/vps/restore-test.sh](file:///D:/Projects/QueueForge/deploy/vps/restore-test.sh)
- [deploy/vps/seed-demo-data.sh](file:///D:/Projects/QueueForge/deploy/vps/seed-demo-data.sh)

### 16. Documentation Deliverables Created
- [docs/deployment/PHASE_11A_VPS_DEPLOYMENT_PLAN.md](file:///D:/Projects/QueueForge/docs/deployment/PHASE_11A_VPS_DEPLOYMENT_PLAN.md)
- [docs/deployment/PHASE_11A_HOSTING_COST_COMPARISON.md](file:///D:/Projects/QueueForge/docs/deployment/PHASE_11A_HOSTING_COST_COMPARISON.md)
- [docs/deployment/PHASE_11A_SECURITY_AND_TLS_CHECKLIST.md](file:///D:/Projects/QueueForge/docs/deployment/PHASE_11A_SECURITY_AND_TLS_CHECKLIST.md)
- [docs/deployment/PHASE_11A_DEMO_DATA_STRATEGY.md](file:///D:/Projects/QueueForge/docs/deployment/PHASE_11A_DEMO_DATA_STRATEGY.md)
- [docs/release/PHASE_11A_PRE_DEPLOYMENT_GATE.md](file:///D:/Projects/QueueForge/docs/release/PHASE_11A_PRE_DEPLOYMENT_GATE.md)
- [.env.production.example](file:///D:/Projects/QueueForge/.env.production.example)

### 17. Validations Performed
- Shell script syntax validated.
- Docker Compose production schema validated via `docker compose -f docker-compose.prod.v2.yml config --quiet`.
- Fail-fast missing secret handling verified.

### 18. Security Findings
- Zero exposed internal database/worker ports.
- Frontend binds exclusively to `127.0.0.1:8088`.
- No hardcoded secrets in client bundles or git repository.
- Cookies verified with `HttpOnly`, `SameSite=Lax`, and `Secure` behind TLS.

### 19. Remaining Operational Blockers
- User decision on cloud provider selection (Hetzner vs. DigitalOcean).
- User provisioning of VPS server instance.
- User registration/assignment of domain name or public hostname for Let's Encrypt TLS.

### 20. Exact Actions Requiring User Approval
1. Approving the selection of the VPS provider (recommended: Hetzner Cloud CX23).
2. Authorizing host server creation and payment method setup.
3. Supplying or configuring the public domain name (A Record -> VPS IP).

### 21. Final Readiness Verdict
# **READY FOR USER HOSTING DECISION**

### 22. Recommended Phase 11B Execution Plan
1. **Host Setup:** Operator launches Hetzner CX23 instance and provides server IP.
2. **DNS Pointing:** Point `queueforge.yourdomain.com` to server IP.
3. **Execution:** Run `prepare-host.sh`, configure `.env`, run `deploy.sh`.
4. **Verification:** Execute `healthcheck.sh` and `seed-demo-data.sh`.
5. **Release:** Tag `v2.0.0` and update README with live recruiter demo URL.
