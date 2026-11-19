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
Each worker card and inspector drawer joins the worker's instance prefix against active rows in `qf_jobs` (`locked_by LIKE instanceId% AND status = 'RUNNING'`) and historical execution logs in `qf_job_execution_logs`.

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

## 5. Performance Optimization & Bundle Code-Splitting

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
- `vendor-icons`: Lucide React (`15 kB`)
