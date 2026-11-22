# QueueForge V2 — Local Operator & Demonstration Playbook

**Document Identifier:** `QF-PORTFOLIO-LOCAL-DEMO-PLAYBOOK`  
**Classification:** Operational Runbook & Local Demonstration Guide  
**Repository:** `https://github.com/saipranav22-commits/queueforge`  
**Target Environment:** Local Windows Workstation (Localhost: `127.0.0.1:8088`)  
**Container Resource Limit:** ~2.3 GB RAM aggregated across 7 services

---

## 1. Local Runtime Strategy & Resource Guardrails

Demonstrating QueueForge locally on a resource-constrained development machine requires avoiding full compilation of three separate container images (Maven JDK build and Vite Node build). 

Two operational pathways are provided:

```
                          ┌────────────────────────┐
                          │ Choose Execution Path  │
                          └───────────┬────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
   [Path A: Live Local Runtime]                      [Path B: Visual Evidence Walkthrough]
   Requires Docker Desktop running                   Zero Docker or RAM required
   Uses published immutable GHCR images             Uses 9 authentic PNG screenshots (1440x900)
   Starts 7 containers with 2.3 GB cap               Uses vector benchmark chart SVG
   Live UI at http://127.0.0.1:8088                  Demonstrates via GitHub Actions CI
```

### Safety & Integrity Rules
1. **Never erase persistent volumes:** Do not run `docker compose down -v`. Run `docker compose down` without `-v` to preserve demo data.
2. **Never build locally during a demo:** Always pass `--no-build` when using prebuilt GHCR images.
3. **Never expose admin credentials:** In videos or live screen shares, do not type production passwords into plain text fields. Use synthetic local test keys (`demo_admin_api_key_2026`).
4. **Honest attribution:** Clearly state that demo jobs are created for functional demonstration, while the 89.8% latency reduction chart was captured during standardized synthetic benchmark runs (under 1,000-job flood contention with an ~21% throughput trade-off).
5. **Accurate wording:** QueueForge uses PostgreSQL row-level locks that skip locked rows without waiting (`SELECT FOR UPDATE SKIP LOCKED`), not lock-free concurrency in the atomic CAS sense.

---

## 2. Path A: Live Local Demonstration (Prebuilt GHCR Images)

### Step 1: Pre-requisites & Environment Setup
Ensure Docker Desktop is running on Windows. Create a local `.env.production` file using the verified template:

```powershell
# Copy the verified production template
Copy-Item .env.production.example .env.production
```

Ensure `.env.production` contains valid local test credentials:
```env
DB_PASSWORD=demo_local_db_password_2026
ADMIN_API_KEY=demo_admin_api_key_2026
RECEIVER_SERVICE_KEY=demo_receiver_service_key_2026
FRONTEND_PORT=8088
IMAGE_TAG=latest
QUEUEFORGE_PUBLIC_DEMO_MODE=true
```

### Step 2: Launch 7-Service Topology Without Local Compilation
Execute Docker Compose using the production GHCR override:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml up -d --no-build
```

Verify service health:
```powershell
docker compose -f docker-compose.prod.v2.yml ps
```
*Expected output: All 7 containers (`sender-db`, `receiver-db`, `payment-receiver`, `api-server`, `worker-1`, `worker-2`, `frontend`) reporting `healthy`.*

### Step 3: Access Obsidian Pulse Console
Open browser:
```text
http://127.0.0.1:8088
```

---

## 3. Path B: Visual Evidence Walkthrough (Zero Docker Overhead)

If Docker Desktop is stopped, system memory is needed for other workloads, or time is short, execute the demonstration using the verified authentic screenshots in the repository:

| Feature Area | Demonstration Asset | Location | Actual Dimensions |
| :--- | :--- | :--- | :--- |
| **System Overview** | `01_overview_dashboard.png` | [`docs/screenshots/01_overview_dashboard.png`](../screenshots/01_overview_dashboard.png) | **1440 × 900** |
| **Job Explorer & Payload** | `02_job_explorer.png`, `03_job_detail_masked.png` | [`docs/screenshots/02_job_explorer.png`](../screenshots/02_job_explorer.png) | **1440 × 900** |
| **Admin Key Unlock Modal** | `04_admin_unlock_modal.png`, `05_job_detail_unlocked.png` | [`docs/screenshots/04_admin_unlock_modal.png`](../screenshots/04_admin_unlock_modal.png) | **1440 × 900** |
| **Dead-Letter Queue (DLQ)**| `06_dead_letter_queue.png` | [`docs/screenshots/06_dead_letter_queue.png`](../screenshots/06_dead_letter_queue.png) | **1440 × 900** |
| **Distributed Workers** | `07_workers_health.png` | [`docs/screenshots/07_workers_health.png`](../screenshots/07_workers_health.png) | **1440 × 900** |
| **Telemetry & Metrics** | `08_monitoring_metrics.png` | [`docs/screenshots/08_monitoring_metrics.png`](../screenshots/08_monitoring_metrics.png) | **1440 × 900** |
| **Mobile Responsiveness** | `09_mobile_responsive_view.png` | [`docs/screenshots/09_mobile_responsive_view.png`](../screenshots/09_mobile_responsive_view.png) | **390 × 844** |
| **FairShare DRR Benchmark** | Vector Benchmark SVG | [`docs/benchmark/fairshare_benchmark_chart.svg`](../benchmark/fairshare_benchmark_chart.svg) | Scalable Vector Graphic |
| **Full-Stack CI Pipeline** | GitHub Actions Run 44935616424 | [GitHub Actions Run 44935616424](https://github.com/saipranav22-commits/queueforge/actions/runs/44935616424) | Live Web Page |

---

## 4. Frontend Route Reference

Verify exact React Router paths defined in `frontend/src/App.tsx`:

| UI Navigation Target | React Router URL | Component | Notes |
| :--- | :--- | :--- | :--- |
| **Overview** | `http://127.0.0.1:8088/` | `OverviewPage` | Default home view with cluster health & throughput |
| **Job Explorer** | `http://127.0.0.1:8088/jobs` | `JobExplorerPage` | Filterable data grid; nested drawer at `/jobs/:jobId` |
| **FairShare Scheduler** | `http://127.0.0.1:8088/fairshare` | `FairSharePage` | **Note:** `/tenants` does not exist in frontend router |
| **Event Pipeline (Outbox)** | `http://127.0.0.1:8088/pipeline` | `EventPipelinePage` | **Note:** `/outbox` does not exist; `/events` redirects to `/pipeline` |
| **Reliability Lab** | `http://127.0.0.1:8088/reliability` | `ReliabilityLabPage` | Chaos injection & telemetry simulator |
| **Dead-Letter Queue (DLQ)** | `http://127.0.0.1:8088/dlq` | `DlqPage` | DLQ job inspection and atomic replay controls |
| **Workers** | `http://127.0.0.1:8088/workers` | `WorkersPage` | Active worker fleet heartbeats and lease counts |
| **Monitoring** | `http://127.0.0.1:8088/monitoring` | `MonitoringPage` | Latency/throughput charts (`/observability` redirects here) |
| **Administration** | `http://127.0.0.1:8088/admin` | `AdministrationPage` | Administrative session configuration |

---

## 5. Step-by-Step Operator Click Paths & Validated API Commands

### Stage 1: Obsidian Pulse Dashboard & Telemetry
- **Browser URL:** `http://127.0.0.1:8088/`
- **UI Elements:** Point to the top metric cards: Total Jobs, Active Workers (2), Queue Depth, and System Health indicator.
- **Underlying API:** `GET http://127.0.0.1:8088/api/v1/dashboard/stats` and `GET http://127.0.0.1:8088/api/v1/system/health`.
- **Operator Commentary:** Explain that the dashboard refreshes automatically every 3 seconds via TanStack Query periodic polling, avoiding fragile persistent WebSocket/SSE connections during container restarts.

---

### Stage 2: Submitting a Background Job (Validated API Contract)
Submit a valid background job using an authenticated HTTP POST request:

```powershell
# Copyable PowerShell example using safe local synthetic credentials
$headers = @{
    "Content-Type" = "application/json"
    "X-Admin-Key"  = "demo_admin_api_key_2026"
    "Idempotency-Key" = [System.Guid]::NewGuid().ToString()
}

$body = @{
    jobType      = "GENERATE_REPORT"
    priority     = 50
    maxRetries   = 3
    delaySeconds = 0
    tenantId     = "tenant-fintech"
    payload      = @{
        reportType  = "QUARTERLY_FINANCIAL"
        format      = "PDF"
        requestedBy = "demo-operator"
    }
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod -Uri "http://127.0.0.1:8088/api/v1/jobs" -Method Post -Headers $headers -Body $body
$response
```

#### Contract Verification Details:
- **Endpoint:** `POST /api/v1/jobs`
- **Supported `jobType` values:** Must be one of `SupportedJobType`:
  `GENERATE_REPORT`, `SEND_EMAIL`, `DATA_EXPORT`, `INDEX_DOCUMENT`, `WEBHOOK_DISPATCH`, `CLEANUP_TEMP_DATA`, `CHAOS_TEST`.
  *(Note: `ORDER_PROCESSING` and `IMAGE_RESIZE` are invalid and will be rejected with 400 Bad Request).*
- **Authentication:** Requires `X-Admin-Key` header or valid active `X-Tenant-Key`.
- **Payload Schema:** Must be a valid JSON Object (`JsonNode`), NOT a stringified JSON string.
- **HTTP Success Status:** `202 Accepted`
- **Response Schema (`CreateJobResponse`):**
  ```json
  {
    "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "PENDING",
    "createdAt": "2026-11-22T00:30:00.000Z",
    "scheduledAt": "2026-11-22T00:30:00.000Z",
    "tenantId": "tenant-fintech"
  }
  ```

---

### Stage 3: Job Explorer, Detail Drawer & Field Redaction
- **Browser URL:** `http://127.0.0.1:8088/jobs`
- **Click Action:** Click the newly submitted job in the table.
- **Observations:**
  - The side drawer slides open showing the Execution Timeline (`PENDING` -> `PROCESSING` -> `COMPLETED`).
  - In Public Demo mode, response-level field redaction masks sensitive payload attributes (`***MASKED***`) in unauthenticated API responses.
- **Admin Unlock:**
  - Click the **Unlock Admin** button in the top navigation bar.
  - Enter the local admin API key: `demo_admin_api_key_2026`.
  - The frontend executes `POST /api/v1/auth/login` to establish an HttpOnly `QF_SESSION` cookie with CSRF token.
  - The payload immediately decrypts and renders in cleartext.

---

### Stage 4: Multi-Instance Worker Fleet & Heartbeats
- **Browser URL:** `http://127.0.0.1:8088/workers`
- **UI Elements:**
  - Table showing two independent worker JVM instances: `worker-prod-01` and `worker-prod-02`.
  - Last heartbeat column (pulsing green, refreshing every 5 seconds).
  - Active leases and completed job counters attributed per worker node.
- **Underlying API:** `GET http://127.0.0.1:8088/api/v1/system/workers`
- **Operator Commentary:** Mention that each worker claims jobs using PostgreSQL row locks that skip locked rows (`SELECT FOR UPDATE SKIP LOCKED`) and maintains an ephemeral 30-second lease with monotonic `claim_version` fencing.

---

### Stage 5: FairShare Multi-Tenant DRR Configuration
- **Browser URL:** `http://127.0.0.1:8088/fairshare` *(Note: URL is `/fairshare`, not `/tenants`)*
- **UI Elements:**
  - Progress bars displaying tenant quantum allocations, weights, and active concurrency limits.
- **Command to Update Tenant Quota:**
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-Admin-Key"  = "demo_admin_api_key_2026"
}
$body = @{
    weight         = 10
    maxConcurrency = 4
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8088/api/v1/admin/tenants/tenant-fintech" -Method Put -Headers $headers -Body $body
```
- **Operator Commentary:** Highlight that under asymmetric load (one tenant enqueuing 1,000 tasks), the DRR scheduler limits the noisy tenant to its concurrency ceiling, allowing quiet tenants to be processed with 89.8% lower wait latency (at an acceptable ~21% throughput trade-off).

---

### Stage 6: Transactional Outbox & Simulated Payment Receiver
Demonstrate atomic order creation and outbox event dispatching:

```powershell
$headers = @{
    "Content-Type" = "application/json"
}
$body = @{
    orderNumber = "ORD-DEMO-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-01"
    customerId  = "CUST-DEMO-01"
    amountCents = 19995
    currency    = "USD"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8088/api/v1/orders" -Method Post -Headers $headers -Body $body
```

Trigger an outbox dispatch sweep:
```powershell
$headers = @{
    "X-Admin-Key" = "demo_admin_api_key_2026"
}
Invoke-RestMethod -Uri "http://127.0.0.1:8088/api/v1/admin/outbox/dispatch?batchSize=10&leaseDurationSeconds=10" -Method Post -Headers $headers
```

- **Browser URL:** `http://127.0.0.1:8088/pipeline` *(Note: URL is `/pipeline`, not `/outbox`)*
- **Observations:**
  - An outbox event `ORDER_PAYMENT_REQUESTED` appears with status `PUBLISHED`.
  - The order entity and outbox event were committed atomically in the sender database.
  - The background dispatcher delivered the charge to the simulated payment receiver (`payment-receiver:8098/api/v1/payments/charges`).
  - The receiver enforced primary-key deduplication on the idempotency key, preventing double billing.

---

### Stage 7: Dead-Letter Queue (DLQ) & Operator Recovery
- **Browser URL:** `http://127.0.0.1:8088/dlq`
- **Data Provenance Distinction:**
  - The standard seed script (`seed-demo-data.sh`) submits valid jobs that complete normally; it does **not** generate DLQ records.
  - To demonstrate DLQ live, an operator must submit a job configured to exhaust retries (e.g., `CHAOS_TEST` with failure trigger) or trigger a receiver fault.
  - In Pathway B (or when presenting evidence), use the authentic screenshot [`docs/screenshots/06_dead_letter_queue.png`](../screenshots/06_dead_letter_queue.png) (1440x900) where categorized failures (`TRANSIENT_FAILURE` vs `PERMANENT_FAILURE`) and retry histories are pre-recorded.
- **Replay Action:** When unlocked as administrator, clicking **Replay Job** triggers `POST http://127.0.0.1:8088/api/v1/admin/dlq/{jobId}/replay` with `X-Admin-Key`. The job resets atomically to `PENDING` with retry count reset to 0.

---

### Stage 8: Automated CI Pipeline Evidence
- **Browser URL:** Open GitHub Actions CI:
  `https://github.com/saipranav22-commits/queueforge/actions/runs/44935616424`
- **Key Evidence:**
  - 187 backend integration tests passed.
  - 13 payment receiver tests passed.
  - 44 frontend Vitest tests passed.
  - 20 Playwright browser E2E scenarios passed.
  - 8 multi-container Docker smoke stages passed.
  - Total: **264 automated tests** (+ 8 smoke stages) with 100% green status across 7 jobs.

---

## 6. Non-Destructive Teardown
When the demonstration is complete, safely stop the containers without destroying database volumes:

```powershell
# Stop and remove containers, preserving database volumes
docker compose -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml down
```
*(Do NOT pass `-v` to ensure seeded demo data and metrics are retained for future sessions).*
