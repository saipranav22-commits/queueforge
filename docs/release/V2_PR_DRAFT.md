# Pull Request: QueueForge V2 — Distributed Workers, Transactional Outbox and FairShare Scheduling

**Title:** `feat: QueueForge V2 — distributed workers, transactional outbox and FairShare scheduling`  
**Base Branch:** `main` (or `master`)  
**Source Branch:** `feature/multi-instance-workers`  
**Author:** Senior Backend & Distributed Systems Reliability Engineer  

---

## 1. Summary

QueueForge V2 transforms QueueForge from a single-node background job processor into a hardened, multi-tenant distributed task execution engine. This release introduces:
1. **Multi-Instance Worker Coordination:** Decoupled `API_ONLY`, `WORKER_ONLY`, and `COMBINED` node operational modes with cryptographic lease fencing and automated crash recovery across independent JVM processes.
2. **Transactional Outbox Engine:** Guaranteed cross-service event publishing with real HTTP delivery, dual PostgreSQL databases, and consumer-side inbox deduplication that ensures exactly-one durable business effect despite transient network drops or dropped ACKs.
3. **FairShare Multi-Tenant Scheduler:** Deficit Round Robin (DRR) fair scheduling with cluster-wide tenant concurrency quotas (`max_concurrency`) enforced via PostgreSQL row-level locks, mitigating noisy-neighbor starvation.
4. **ChaosLab Distributed Fault-Injection Harness:** Automated fault injection for cross-process crash testing, dropped HTTP responses, and lease recovery verification.
5. **Security & Credential Hardening:** SHA-256 tenant API key hashing (Flyway V7), constant-time token comparison, service-to-service authentication, and production release gates rejecting default secrets.

---

## 2. Why This Change Was Needed

In QueueForge V1:
- **Monolithic Process Topology:** API handling and job execution ran in a single JVM. CPU-intensive background tasks could starve HTTP request handling, and process restarts risked interrupting in-flight tasks without automated multi-process recovery.
- **Noisy-Neighbor Monopolization:** Jobs were claimed purely by FIFO and static priority. A single batch tenant submitting thousands of jobs could monopolize all worker capacity, starving interactive tenants for minutes.
- **Cross-Service Dual-Write Hazard:** Creating an order and initiating external actions (such as payment processing) lacked transactional coordination; a failure between database commit and network dispatch caused inconsistent state.
- **Plaintext Tenant Credentials:** Tenant API keys were stored without cryptographic hashing.

QueueForge V2 systematically addresses each limitation with ACID-guaranteed distributed algorithms implemented directly on PostgreSQL 16.

---

## 3. Architecture Overview

QueueForge V2 operates across 7 decoupled services orchestrated via Docker Compose:

```
                                    +---------------------------+
                                    |   Operators & Clients     |
                                    +-------------+-------------+
                                                  |
                                                  v
                                    +---------------------------+
                                    |    Nginx Reverse Proxy    | (127.0.0.1:8088)
                                    |  React 19 Admin Console   |
                                    +-------------+-------------+
                                                  |
                          +-----------------------+-----------------------+
                          | (HTTP Ingress /api/v1)                        |
                          v                                               |
             +--------------------------+                                 |
             |   API Server (JVM Node)  |                                 |
             |   AppMode: API_ONLY      |                                 |
             +------------+-------------+                                 |
                          |                                               |
                          +-----------------------+                       |
                          |                       |                       |
                          v                       v                       |
             +--------------------------+  +--------------------------+   |
             |   Worker 1 (JVM Node)    |  |   Worker 2 (JVM Node)    |   |
             |   AppMode: WORKER_ONLY   |  |   AppMode: WORKER_ONLY   |   |
             |   FairShare DRR Claims   |  |   FairShare DRR Claims   |   |
             |   Outbox Dispatcher      |  |   Outbox Dispatcher      |   |
             +------------+-------------+  +------------+-------------+   |
                          |                       |                       |
                          +-----------+-----------+                       |
                                      |                                   |
                                      v                                   v
             +----------------------------------+          +----------------------------------+
             |       Sender PostgreSQL          |          |     Payment Receiver (JVM)       |
             |  - qf_jobs (Queue)               |   HTTP   |  - Real HTTP /charges            |
             |  - qf_tenants (FairShare DRR)    | -------->|  - Inbox Deduplication Table     |
             |  - orders (Business Domain)      | Dispatch |  - Simulated Charges Table       |
             |  - outbox_events (Outbox)        |          +-----------------+----------------+
             +----------------------------------+                            |
                                                                             v
                                                           +----------------------------------+
                                                           |      Receiver PostgreSQL         |
                                                           |  - Independent physical database |
                                                           +----------------------------------+
```

---

## 4. Major Implemented Features

### A. Multi-Instance Worker Coordination & Lease Fencing
- Workers run independently with distinct `instanceId` identifiers (`worker-v2-node-1`, `worker-v2-node-2`).
- Each claim assigns a cryptographically unique `UUID claim_token` and an expiring lease (`claim_expires_at`).
- Completion and failure queries enforce `WHERE id = ? AND claim_token = ?`, preventing zombie workers from corrupting job state after lease expiration.
- Autonomous background recovery thread detects and reclaims expired leases.

### B. FairShare Multi-Tenant DRR Scheduler
- Deficit Round Robin scheduling dynamically allocates job claim opportunities based on tenant `weight` (1–100) and `deficit_counter`.
- Cluster-wide concurrency quotas (`max_concurrency`) enforced across all worker JVMs using atomic row counts (`SELECT COUNT(*) FROM qf_jobs WHERE tenant_id = ? AND status = 'RUNNING'`).
- Prevents batch tenants from starving low-volume interactive tenants.

### C. Transactional Outbox & Real HTTP Delivery
- Orders and outbox events are inserted atomically in the **exact same database transaction** on the Sender database.
- Background `OutboxDispatcherScheduler` claims pending events via `SELECT ... FOR UPDATE SKIP LOCKED` with lease fencing.
- Dispatches HTTP POST requests to the decoupled `payment-receiver` service over internal container networks.
- Retries with exponential backoff and jitter on network failures.

### D. Consumer-Side Durable Idempotency
- Payment receiver verifies request payload with SHA-256 fingerprint matching.
- Commits charges and idempotency records inside a single transaction on the independent Receiver database.
- Duplicate requests for the same `idempotency_key` return the cached response with `idempotentReplay: true` without double-charging.
- Mismatched payloads with duplicate keys are rejected with `HTTP 409 Conflict`.

### E. ChaosLab Distributed Fault Harness
- Reproducible scenarios testing worker crash simulation, dropped ACKs, database connection cuts, and dual-worker recovery.

---

## 5. Database Migrations

Three new versioned Flyway migrations were introduced in the backend:

1. **`V5__create_transactional_outbox_schema.sql`**:
   - Creates `orders` table (business aggregate).
   - Creates `outbox_events` table with partial index on `(status, next_retry_at) WHERE status IN ('PENDING', 'DISPATCHING')`.
   - Creates receiver domain tables for local/testing compatibility.
2. **`V6__create_fairshare_multi_tenant_schema.sql`**:
   - Creates `qf_tenants` with weights, concurrency limits, and deficit tracking.
   - Adds `tenant_id` column to `qf_jobs` with foreign key and default value `'default'`.
   - Adds `tenant_id` to `qf_job_execution_logs`.
   - Adds tenant-partitioned indexes: `idx_qf_jobs_tenant_claimable`, `idx_qf_jobs_tenant_running`.
3. **`V7__secure_tenant_credentials.sql`**:
   - Adds `api_key_hash` (VARCHAR 64) and `api_key_prefix` (VARCHAR 16).
   - Migrates existing API keys to SHA-256 hashes (`encode(sha256(api_key::bytea), 'hex')`).
   - Invalidates hardcoded default keys.
   - Drops cleartext keys by setting `api_key = NULL`.
   - Adds composite index `idx_qf_jobs_tenant_claim_v2` matching claim `ORDER BY (priority DESC, scheduled_at ASC, id ASC)`.

**Receiver Database Migration:**
- `V1__create_receiver_schema.sql` creates `simulated_payment_charges` and `inbox_deduplication`.

---

## 6. Security Changes

- **Tenant API Key Hashing:** API keys are never stored in plaintext. They are SHA-256 hashed upon registration, and only the first 8 characters (`api_key_prefix`) are retained for display and logging.
- **Constant-Time Verifications:** All token and API key comparisons use `MessageDigest.isEqual` to prevent timing attacks.
- **Tenant Isolation:** Cross-tenant resource queries return `HTTP 404 Not Found` to prevent resource enumeration. Submissions attempting to spoof another `tenantId` return `HTTP 403 Forbidden`.
- **Service-to-Service Authentication:** The payment receiver endpoint `/api/v1/payments/charges` requires an `X-Service-Key` header matching the shared secret. Missing or invalid keys return `HTTP 401 Unauthorized`.
- **Production Guardrails:** `AdminProperties` throws an `IllegalStateException` on startup if the default development secret is detected in `prod` profile.
- **Test Endpoint Isolation:** Test and fault-injection controllers are disabled by default via `@ConditionalOnProperty(name="queueforge.receiver.test-endpoints-enabled", havingValue="true", matchIfMissing=false)`.

---

## 7. Backward Compatibility

- **Existing Jobs:** Flyway V6 automatically assigns legacy jobs and audit logs to the `'default'` tenant (`DEFAULT 'default'`).
- **Single-Node Mode:** Setting `QUEUEFORGE_MODE=COMBINED` preserves V1 behavior where a single JVM serves both API requests and executes background worker threads.
- **API Payloads:** Existing job submission requests without explicit `tenantId` automatically inherit the authenticated tenant's identity or default fallback when permitted.

---

## 8. Testing and Verification

### Automated Test Suite
- **Backend Tests:** **144 / 144 passed** (0 failures, 0 errors, 0 skipped).
- **Payment Receiver Tests:** **13 / 13 passed** (0 failures, 0 errors, 0 skipped).
- **Frontend Tests:** **7 / 7 passed** (`vitest run`), 0 linter errors (`oxlint`).
- **Live Stack Smoke Test:** **6 / 6 stages passed** on 7-container Docker Compose V2 environment.

### Live Stack Smoke Test Stages
1. Reverse Proxy Health Check (`GET /health` -> 200 OK)
2. Dynamic Tenant Registration via Admin API
3. Authenticated Job Submission & Worker Attribution (`worker-v2-node-1` completed in 406ms)
4. Cross-Tenant Security Isolation (404 Not Found, 403 Forbidden, 401 Unauthorized)
5. Transactional Outbox HTTP Dispatch, Order Settlement (`PAID`), and Receiver Idempotency (`idempotentReplay: true`)
6. Multi-Worker Concurrent Processing Attribution (both `worker-v2-node-1` and `worker-v2-node-2` evenly distributed)

---

## 9. Benchmark Methodology and Tradeoffs

- **Workload:** 100 flood jobs from noisy tenant (weight=1, quota=2) concurrent with 10 interactive jobs from quiet tenant (weight=5, quota=4).
- **Observed Result (Local Test Environment):**
  - Quiet-tenant median wait latency dropped from ~2,450 ms under FIFO to ~250 ms under FairShare DRR (**~89.8% reduction in p50 queue wait**).
- **Trade-Off:**
  - FairShare DRR incurs additional query overhead for tenant deficit updates and active running job counts.
  - In local burst testing, raw batch drain throughput was ~35-40% lower than unconstrained FIFO, deliberately trading peak single-tenant throughput for fair multi-tenant isolation.
  - *Note: These figures reflect local single-host benchmarking and should be treated as comparative behavior rather than absolute production throughput guarantees.*

---

## 10. Deployment Instructions

### Docker Compose V2 Quickstart
```bash
# 1. Clone repository
git clone https://github.com/saipranav22-commits/queueforge.git
cd queueforge

# 2. Configure production secrets
cp .env.production.example .env
# Edit .env with high-entropy ADMIN_API_KEY, DB_PASSWORD, and RECEIVER_SERVICE_KEY

# 3. Boot 7-service V2 stack
docker compose -p queueforge-v2 -f docker-compose.v2.yml up -d

# 4. Verify service health
docker compose -p queueforge-v2 -f docker-compose.v2.yml ps

# 5. Run live smoke test
powershell -ExecutionPolicy Bypass -File scripts/smoke-test-v2.ps1
```

### Access URLs
- **Web Console:** `http://127.0.0.1:8088`
- **Reverse Proxy Health:** `http://127.0.0.1:8088/health`
- **Prometheus Metrics:** `http://127.0.0.1:8088/actuator/prometheus` (via internal backend)

---

## 11. Risks and Limitations

1. **At-Least-Once Network Delivery:** The Transactional Outbox guarantees that events will not be lost. Network disconnects can cause retry dispatches; downstream consumers **must** implement idempotent processing (as demonstrated by the inbox pattern in `simulated-payment-receiver`).
2. **FairShare Under Extreme Tenant Counts:** DRR queries scan active tenants with pending jobs. For systems with tens of thousands of active concurrent tenants, partitioning or caching active tenant sets is recommended.
3. **Simulated Payment Receiver:** The payment receiver in this repository serves as an integration test harness and architectural reference; production deployments will integrate real PSP webhooks and APIs.
4. **Hardware Resource Requirements:** Running all 7 containers locally requires bounded JVM heaps (`-Xmx220m` recommended on machines with <= 8 GB RAM).

---

## 12. Reviewer Checklist

- [x] Java 21 LTS compatibility confirmed.
- [x] Spring Boot 3.3.5 and PostgreSQL 16.8 compatibility confirmed.
- [x] Cryptographic lease fencing prevents split-brain writes.
- [x] FairShare DRR and cluster-wide tenant quotas prevent noisy-neighbor starvation.
- [x] Flyway migrations V5, V6, and V7 are forward-only and backward-compatible.
- [x] No plaintext credentials or secrets committed in Git history.
- [x] CI workflow covers backend, receiver, frontend, and Docker image compilation.
- [x] All 144 backend tests, 13 receiver tests, and 7 frontend tests pass 100% green.
