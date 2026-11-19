# QueueForge Control Plane Architecture

## 1. Overview & Vision
The **QueueForge Control Plane** provides an enterprise-grade operational interface for managing, inspecting, and governing a high-throughput, lease-fenced distributed queue cluster. 

Rather than serving as a passive metrics dashboard, the Control Plane acts as a **Mission Control Console** where operators can:
- Observe cluster-wide queue lifecycle transitions in real-time with server-side pagination and filters.
- Monitor multi-worker fleet attribution across independent nodes with dynamic heartbeat freshness discovery.
- Inspect and adjust FairShare multi-tenant quotas and Deficit Round-Robin (DRR) weights.
- Trigger and observe Transactional Outbox event relays to downstream payment services.
- Audit dead-letter queue (DLQ) incidents and initiate idempotent replays.
- Trace verified execution attempt histories through chronological vertical audit timelines.

---

## 2. Distributed State Management & Data Flow

```
   ┌────────────────────────────────────────────────────────┐
   │                   Browser / Client                     │
   │  ┌───────────────────────┐  ┌───────────────────────┐  │
   │  │  Mission Control UI   │  │ Job Explorer / Fleet  │  │
   │  └───────────┬───────────┘  └───────────┬───────────┘  │
   │              │                          │              │
   │              ▼                          ▼              │
   │      TanStack React Query Cache (Automatic Deduplication) │
   └──────────────────────────────┬─────────────────────────┘
                                  │ HTTP / JSON
                                  ▼
   ┌────────────────────────────────────────────────────────┐
   │                 QueueForge API Gateway                 │
   │   (/api/v1/jobs, /system/workers, /dashboard/stats)    │
   └──────────────┬──────────────────────────┬──────────────┘
                  │                          │
                  ▼                          ▼
   ┌──────────────────────────────┐  ┌──────────────────────┐
   │     PostgreSQL Database      │  │ Simulated Receiver   │
   │   - qf_jobs (SKIP LOCKED)    │  │   (Durable Port 8085)│
   │   - qf_worker_heartbeats     │  └──────────────────────┘
   │   - qf_job_execution_logs    │
   └──────────────────────────────┘
```

### A. Reactive Polling & Cache Invalidation
- **Live Metric Synchronization:** Primary stats (`/dashboard/stats`), system health (`/system/health`), metrics summaries (`/system/metrics-summary`), and worker fleet (`/system/workers`) poll at optimized intervals (3–5 seconds).
- **Targeted Cache Invalidation:** Mutation actions (e.g., job creation, tenant provisioning, outbox manual relay, DLQ replay) selectively invalidate only affected cache keys using `useQueryClient().invalidateQueries(...)`, preventing full-page re-renders.
- **Backoff & Idle Optimization:** When browser tabs are out of focus or jobs reach terminal states (`COMPLETED`, `DEAD_LETTER`), polling frequency is dynamically attenuated to conserve CPU and network resources.

---

## 3. Distributed Worker Fleet Discovery Architecture

### A. Real Heartbeat Registry (`qf_worker_heartbeats`)
To avoid fragile client assumptions or hardcoded node lists, QueueForge V2 implements a minimal, bounded PostgreSQL heartbeat table:
- `instance_id VARCHAR(64) PRIMARY KEY`
- `mode VARCHAR(32)` (`WORKER_ONLY`, `COMBINED`, `API_ONLY`)
- `status VARCHAR(32)` (`RUNNING`, `STOPPED`)
- `concurrency INT`
- `active_jobs INT`
- `last_heartbeat TIMESTAMPTZ`
- `started_at TIMESTAMPTZ`

### B. Freshness & Truthful Status Evaluation
The backend calculates heartbeat freshness (`heartbeatAgeSeconds`) on each request:
- **`ONLINE`:** Heartbeat received within the last 15 seconds (gentle green pulse).
- **`STALE`:** Heartbeat between 15 and 45 seconds old (amber warning indicator).
- **`OFFLINE`:** Heartbeat older than 45 seconds or explicitly marked `STOPPED` during graceful shutdown.

### C. Attribution & Held Lease Scanning
Each worker card and inspector drawer joins the worker's instance ID against active rows in `qf_jobs` and historical execution logs in `qf_job_execution_logs`. To prevent unsafe prefix collisions where `worker-1` could match `worker-10`, attribution strictly evaluates:
`(j.locked_by = h.instance_id OR j.locked_by LIKE CONCAT(h.instance_id, ':%'))`
for active leases, and similarly for historical worker logs:
`(l.worker_id = h.instance_id OR l.worker_id LIKE CONCAT(h.instance_id, ':%'))`.

---

## 4. Job Explorer & Verified Execution Timeline

### A. Server-Side Query Toolbar
- Multi-dimensional filters: Search (UUID / Idempotency Key), Job Type, Status, Tenant partition, Priority (80+ / 50 / 20), Sorting (Created, Updated, Priority, Retries, Scheduled).
- Server-side bounded pagination (`page`, `size`) with total element tallies.
- Selection checkboxes with bulk counter and clear-selection shortcuts.

### B. Verified Execution Timeline
- The `ExecutionTimeline` component presents only authentic, backend-recorded milestones:
  1. **Job Enqueued:** Submitted timestamp, priority, max retries, tenant partition.
  2. **Scheduled Delay:** Target dispatch timestamp if scheduled > 1s from creation.
  3. **Execution Attempts:** Chronologically ordered attempt records displaying worker actor, duration in milliseconds, status outcome, and specific error messages.
  4. **Active Leases:** Real-time pulse indicator identifying the worker currently holding the lease token.
  5. **Terminal State:** Success confirmation or dead-letter failure classification.

---

## 5. FairShare Multi-Tenant Scheduling Intelligence

### A. Deficit Round-Robin (DRR) Formulation
QueueForge prevents noisy-neighbor starvation through Weighted Deficit Round Robin scheduling across active tenant queues:
- **Quantum Allocation:** At the beginning of each sweep cycle, active tenant $t_i$ receives credit quantum:
  $$Q_i = w_i \times Q_\text{base}$$
- **Concurrency Quota Headroom:** Claim limit is strictly bounded by available concurrency headroom:
  $$H_i = \max(0, \text{max\_concurrency}_i - R_i)$$
- **Batch Bounding:** Maximum claimed jobs per turn is bounded:
  $$K_i = \min(B_\text{remaining}, D_i, H_i)$$
- **Anti-Hoarding Invariant:** If tenant $t_i$'s queue is empty, its deficit counter is immediately reset to 0 ($D_i \leftarrow 0$) to prevent idle tenants from accumulating unbounded deficits.

---

## 6. Transactional Outbox Event Pipeline Architecture

### A. Dual-Write Anomaly Elimination
Business domain operations (e.g. order creation) and outbound integration events are persisted in the same ACID database commit. This guarantees that an event is never created for a rolled-back order, nor is an order created without an associated event.

### B. Reliable Dispatch & Receiver Deduplication
1. **Durable Claiming:** The dispatcher acquires leases using PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` with explicit claim tokens.
2. **At-Least-Once Transport:** Events are dispatched via HTTP to downstream receivers with `X-Service-Key` authentication and `Idempotency-Key` headers.
3. **Receiver Deduplication:** The receiver enforces a database `UNIQUE(idempotency_key)` constraint. Repeated deliveries return the original committed result without duplicate financial charges.
4. **Acknowledgement:** The outbox status updates to `DELIVERED` only upon receiving HTTP 200/201 response.

---

## 7. Performance Optimization & Bundle Code-Splitting

### A. Route-Based Lazy Loading
Monolithic bundle generation was eliminated by wrapping all major page views in `React.lazy()` and `Suspense`:
- Core entry chunk: **32.52 kB** (gzip: 9.07 kB)
- Job Explorer chunk: **21.35 kB** (gzip: 4.48 kB)
- Workers Fleet chunk: **16.09 kB** (gzip: 3.30 kB)
- Job Detail chunk: **10.17 kB** (gzip: 2.87 kB)

### B. Manual Vendor Chunks
Third-party libraries are isolated into dedicated, cached vendor files:
- `vendor-react`: React, React-DOM, React-Router (`245 kB`)
- `vendor-charts`: Recharts, D3 (`369 kB`, loaded only on chart-heavy routes)
- `vendor-query`: TanStack React Query (`35 kB`)
- `vendor-icons`: Lucide React (`17 kB`)

---

## 8. Reliability Lab & Distributed Invariant Verification

The **Reliability Lab (`/reliability`)** acts as the correctness verification center of QueueForge, unifying telemetry with empirical distributed testing evidence:

### A. 8 Core Distributed Resilience Mechanisms
1. **Lease Fencing:** Conditional SQL `UPDATE ... WHERE claim_token = :token AND lease_until >= NOW()` rejects stale zombie commits.
2. **Orphaned Lease Sweeper:** Periodic scan identifies un-heartbeated expired leases and safely resets them to `PENDING`.
3. **Exponential Backoff & Full Jitter:** Decorrelates network load using randomized backoff ceilings to avoid stampedes.
4. **Dead-Letter Queue Poison Isolation:** Quarantines tasks exceeding `maxRetries` or encountering `PERMANENT_FAILURE`.
5. **Transactional Outbox (`SKIP LOCKED`):** Atomic dual-write elimination with non-blocking dispatcher batch claiming.
6. **Consumer-Side Durable Idempotency:** Downstream receiver `UNIQUE(idempotency_key)` deduplication.
7. **FairShare DRR Quotas:** Multi-tenant fair queuing preventing starvation with strict concurrency ceilings.
8. **SmartLifecycle Thread Draining:** Graceful container termination allowing up to 25s for in-flight tasks to complete.

### B. ChaosLab Empirical Fault Scenarios
Presents verified millisecond chronologies from the automated ChaosLab test suite (`docs/engineering/chaoslab.md`):
- **Experiment A:** Hard Worker Crash Mid-Execution (`SIGKILL`, 6s lease expiry, sweeper recovery, fresh token).
- **Experiment B:** Zombie Worker & Fencing Token Protection (GC pause barrier, conditional UPDATE rejected, 0 corruption).
- **Experiment C:** Split-Brain Network Partition (Worker 1 partitioned, Worker 2 maintains continuous queue throughput).

### C. 9 Formal Invariant Verification Matrix
Verified by `InvariantVerifier.java` across database row states and audit logs:
- **SAFETY-1 through SAFETY-6:** Single Valid Owner, Stale Worker Fenced, Durable Storage Survival, Bounded Retries, No Terminal Reversal, Consistent Audit Evidence.
- **LIVENESS-1 through LIVENESS-3:** Abandoned Job Recoverable, Eventual Terminal State, Healthy Worker Continuity.

---

## 9. Dead-Letter Queue Operations & Platform Administration

### A. Dead-Letter Queue Console (`/dlq`)
- **Triage Explorer:** Paginated search and failure category filtering (`TRANSIENT_FAILURE`, `PERMANENT_FAILURE`, `LEASE_EXPIRED`, `HANDLER_NOT_FOUND`).
- **Diagnostic Inspector Drawer:** Metadata, failure taxonomy badge, retry counter, formatted fatal error message, collapsible stack trace, and JSON payload viewer.
- **Safe Recovery Workflows:** Replay modal (resets status to `PENDING` with zeroed claim token) and Discard modal (soft-deleted archival preserving audit trail).

### B. Control Plane Administration (`/admin`)
- **Session Lifecycle:** Double-submit CSRF cookie protection and `X-Admin-Key` authorization status.
- **Tenant Administration Snapshot:** Real-time active tenant tally, total weight allocation, and navigation to FairShare.
- **Runtime Platform Configuration:** Real-time HikariCP pool metrics (active, idle, total connections, timeouts) and Worker Coordinator execution parameters.
- **Security Boundaries:** Enforced tenant isolation, secret masking policies, and append-only audit trail immutability.
