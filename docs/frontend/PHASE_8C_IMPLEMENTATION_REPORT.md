# QueueForge Phase 8C: FairShare Intelligence & Transactional Event Pipeline Report

**Date:** November 19, 2026  
**Active Branch:** `feature/v2-control-plane-ui`  
**Base Commit:** `47bb430`  
**Design System:** Obsidian Pulse  

---

## 1. Executive Summary

Phase 8C transforms QueueForge's FairShare multi-tenant scheduler and Transactional Outbox event pipeline from basic operational screens into technically accurate, interactive SaaS product experiences.

Operators can now observe, simulate, and audit QueueForge's two distinctive backend features:
1. **FairShare Scheduling Intelligence:** Real-time tenant deficit tracking, cluster-wide concurrency quota ceilings, interactive Deficit Round Robin (DRR) algorithm simulation, and empirical benchmark evidence against noisy-neighbor starvation.
2. **Transactional Event Pipeline Workspace:** Real-time PostgreSQL outbox counters, a 7-stage end-to-end business flow visualizer, a server-paginated and searchable Event Explorer, an in-depth Event Detail Inspector drawer, and deep-link cross-page navigation.

All frontend type checks, linters, and 24 Vitest tests passed with zero errors. All backend production and test sources (123 classes) compiled cleanly under Java 23, and all 23 backend unit tests passed with 100% green status.

---

## 2. Real Backend APIs Implemented & Integrated

To support genuine data provenance without mocking, minimal read-only backend endpoints were added and integrated:

| Endpoint Path | HTTP Method | Auth Required | CSRF Required | Request Parameters / Body | Response DTO | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/admin/tenants/scheduler-config` | `GET` | Yes (Admin) | No | None | `FairShareConfigResponse` | Exposes scheduler status, base quantum ($Q_\text{base}$), max sweep size, and active partition totals |
| `/api/v1/admin/tenants` | `GET` | Yes (Admin) | No | None | `TenantSummary[]` | Lists all tenants with weights, concurrency caps, real deficit counters, running jobs, and pending backlog |
| `/api/v1/admin/tenants` | `POST` | Yes (Admin) | Yes | `id, name, weight, maxConcurrency` | `{ tenant, apiKey }` | Provisions new tenant; returns ephemeral plaintext API key once |
| `/api/v1/admin/tenants/{id}` | `PUT` | Yes (Admin) | Yes | Path: `id`, Body: `name, weight, maxConcurrency, status` | `TenantDetail` | Updates tenant weight, concurrency quota, or activation status |
| `/api/v1/admin/outbox/stats` | `GET` | Yes (Admin) | No | None | `OutboxStatsResponse` | Aggregated counts for `PENDING`, `DISPATCHING`, `DELIVERED`, and `DEAD_LETTER` |
| `/api/v1/admin/outbox/events` | `GET` | Yes (Admin) | No | `page, size, status, eventType, search, sortBy, sortDirection` | `PageResponse<OutboxEventSummaryResponse>` | Bounded, server-paginated, filterable event explorer table |
| `/api/v1/admin/outbox/events/{id}` | `GET` | Yes (Admin) | No | Path: `id` (UUID) | `OutboxEventDetailResponse` | Full event metadata, timeline timestamps, last error message, and JSONB payload |
| `/api/v1/admin/outbox/dispatch` | `POST` | Yes (Admin) | Yes | `batchSize (1–50), leaseDurationSeconds (1–60)` | `OutboxDispatchResult` | Triggers immediate outbox dispatch using PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` |

---

## 3. FairShare — Intelligent Scheduling Console

### A. Real-Time Telemetry & Algorithmic Service Share Semantics
- **Metrics Strip:** Real active tenant count, total configured weight sum, cluster concurrency allocation, and scheduler base quantum ($Q_\text{base} = 1\text{ job/sweep}$, max sweep = 10 tenants).
- **Truthful Semantics Notice:** Distinguishes configured weight multipliers from actual observed service share. Explains that weights govern relative credit accumulation ($Q_i = w_i \times Q_\text{base}$) per sweep under contention, rather than fixed percentage CPU throughput guarantees when queues are idle or unequally saturated.
- **Tenant Quota Real-Time Distribution:** Real-time visual progress bars displaying live running jobs against concurrency ceilings, current pending jobs, and persistent deficit counters ($D_i$).

### B. Configured Tenant Registry
- Interactive table displaying Tenant ID (with one-click clipboard copy), Name, DRR Weight, Concurrency Quota, Running/Pending counts, Deficit Counter, and Status.
- **Cross-Page Drill-Down:** Each tenant row includes an "Inspect Jobs" button that deep-links directly to `/jobs?tenantId=${t.id}` in the Job Explorer.
- **Tenant Configuration Modal:** Allows administrators to modify weight, max concurrency, and status (`ACTIVE` vs `SUSPENDED`) via `PUT /api/v1/admin/tenants/{id}` with input validation constraints.

### C. Interactive Educational Simulator: "Deficit Round-Robin (DRR) Mechanics"
- **Clear Demarcation:** Prominently tagged as an *"Educational Simulation: Demonstrates QueueForge's scheduling mathematics and anti-hoarding rules under simulated multi-tenant contention; not live production traces"*.
- **Interactive Controls:** "Simulate Sweep (Round N)" and "Reset" controls.
- **Step-by-Step State Tracking:**
  1. Quantum accumulation: $D_i \leftarrow D_i + (w_i \times Q_\text{base})$.
  2. Concurrency quota bounding: $H_i = \max(0, M_i - R_i)$.
  3. Batch claim bounding: $K_i = \min(B, D_i, H_i, \text{queue})$.
  4. Anti-hoarding invariant: if a tenant's queue becomes empty, its deficit counter is immediately reset to 0 ($D_i \leftarrow 0$) to prevent idle tenants from monopolizing the worker cluster upon awakening.
- **Visual Log:** Chronological trace table detailing the exact mathematical reason for every claimed or skipped job.

### D. Empirical Benchmark Evidence
- Documented and visualized directly from verified benchmark repository artifacts (`docs/benchmark/benchmark-results-fairshare.json` — Profile 3: Noisy Neighbor experiment: 1,000 batch jobs vs 4 quiet tenants with 20 jobs each = 1,080 total jobs).
- **FIFO Baseline:** Quiet tenant p50 wait = **11,868 ms**, quiet tenant p95/p99 wait = **12,219 ms**, throughput = **89.6 jobs/s**, max tail starvation = **12,219 ms**.
- **FairShare (DRR):** Quiet tenant p50 wait = **1,210 ms** (**-89.8% latency reduction**), quiet tenant p95/p99 wait = **1,990 ms**, throughput = **70.6 jobs/s**, max tail starvation = **1,990 ms**.
- **Trade-off Analysis:** Explicitly highlights that FairShare introduces an ~21% throughput reduction (from 89.6 to 70.6 jobs/s) due to round-robin sweep locking overhead, in exchange for eliminating multi-second quiet-tenant starvation.

---

## 4. Transactional Event Pipeline Workspace

### A. Real Outbox Status Counters
- Live counts fetched via `useOutboxStats()`:
  - **Pending Events:** Unclaimed records in `outbox_events` awaiting relay.
  - **In-Flight Dispatching:** Records currently leased by dispatcher instances (`claim_token` assigned, `claim_expires_at > CURRENT_TIMESTAMP`).
  - **Acknowledged Delivered:** Successfully processed events acknowledged by the payment receiver.
  - **Dead Letter Events:** Events that exceeded `max_retries` due to non-transient failures.

### B. 7-Stage End-to-End Business Flow Visualizer
Interactive left-to-right architectural pipeline:
1. **Order Created:** Business domain API receives request (`qf_orders`).
2. **Outbox Event Persisted:** Outbox record committed in same ACID database transaction (`outbox_events`).
3. **Dispatcher Claims Event:** Background relayer acquires lease via `SELECT FOR UPDATE SKIP LOCKED`.
4. **HTTP Dispatch to Receiver:** Relayer dispatches POST request with `X-Service-Key` and `Idempotency-Key`.
5. **Receiver Idempotency Check:** Receiver validates key against `UNIQUE(idempotency_key)` constraint.
6. **Business Effect Recorded:** Downstream payment microservice commits simulated financial charge.
7. **Delivery Acknowledged:** Dispatcher receives HTTP 200/201 and updates outbox status to `DELIVERED`.
- **Dynamic Inspection Link:** Selecting an event in the table highlights the exact verified stage reached based on authentic database timestamps and status.

### C. Outbox Event Explorer Table
- Server-side bounded pagination (`page`, `size`).
- Multi-field disjunctive search debounced against aggregate ID, idempotency key, and event UUID.
- Status filter pills (`ALL`, `PENDING`, `DISPATCHING`, `DELIVERED`, `DEAD_LETTER`).
- Displays Event ID (CopyableId), Aggregate Type/ID, Event Type, Status (StatusBadge), Attempt counter, Created timestamp, and Delivered / Next Retry schedule.

### D. Event Detail Slide-Over Inspector Drawer
- Triggered by clicking "Inspect" on any table row.
- Displays metadata, delivery timeline, formatted JSONB payload, and last error diagnostics.
- Cross-Page Navigation: Provides direct link to *"Inspect Related Jobs in Explorer"* (`/jobs?search=${event.aggregateId}`).

### E. Audited Manual Outbox Dispatch Controls
- Bounded batch size selector: strictly offers `[5, 10, 25, 50]`, eliminating the invalid `100` option that exceeded backend `MAX_BATCH_SIZE = 50`.
- Requires administrator authorization; prompts with confirmation modal before dispatching.
- Provides immediate feedback with verified dispatched count.

---

## 5. Security & Authorization Review

1. **Administrative Boundary Interceptors:**
   - All `/api/v1/admin/**` endpoints are guarded by `AdminAuthInterceptor`, requiring either an `X-Admin-Key` header (CLI) or a verified `QF_SESSION` cookie (browser).
   - Mutating HTTP methods (`POST`, `PUT`, `DELETE`) strictly require `X-CSRF-Token`.
   - `AppModeGuardInterceptor` rejects mutating requests with HTTP 503 on `WORKER_ONLY` nodes.
2. **Receiver Service Key Secrecy:**
   - `X-Service-Key` is strictly handled server-to-server between the backend outbox dispatcher and the simulated payment receiver. It is never exposed in browser payloads or frontend network requests.
3. **Raw API Key Protection:**
   - Plaintext tenant API keys are only returned once upon creation or key rotation. Subsequent queries return masked prefix representations (`keyPrefix...`).
4. **Tenant Isolation:**
   - Multi-tenant boundary checks in `JobService.java` prevent cross-tenant job querying for non-admin callers.

---

## 6. Automated Test Results

### A. Frontend Test Suite (Vitest) — 24/24 Passed (13 Test Files)
- `FairSharePage.test.tsx` (2 tests): Renders overview, DRR engine badges, benchmark metrics; verifies stepping educational simulator.
- `EventPipelinePage.test.tsx` (2 tests): Renders pipeline header, outbox KPI counters, 7-step architecture; verifies batch size selector bounds (`[5, 10, 25, 50]`).
- `JobExplorer.test.tsx` (1 test): Toolbar, search, status pills, priority presets (`High 80+`).
- `ExecutionTimeline.test.tsx` (2 tests): Enqueued, worker actor, duration, and terminal state milestones.
- `WorkersPage.test.tsx` (1 test): Node discovery cards, heartbeat freshness, drawer inspect drill-down.
- `MissionControl.test.tsx` (1 test): Mission control banner, KPI cards, worker fleet snapshot.
- `TenantQuotaProgress.test.tsx` (2 tests): Quota bars and deficit display.
- `AdminUnlockModal.test.tsx` (1 test): Modal trigger and key entry.
- `MetricCard.test.tsx` (1 test): Surface styling and semantic variant rendering.
- `StatusBadge.test.tsx` (4 tests): Lifecycle badge styling.
- `StatusIndicator.test.tsx` (3 tests): Live pulse indicators.
- `CopyableId.test.tsx` (3 tests): Clipboard copying and prefix truncation.
- `SecurityScan.test.ts` (1 test): Token and secret leakage scan.

### B. Static Analysis & Compilation
- **Frontend TypeScript (`npx tsc -b`):** 0 errors.
- **Frontend Linter (`oxlint`):** 0 errors.
- **Backend Compilation (`mvn test-compile`):** 123 classes compiled cleanly with `javac [release 21]`.
- **Backend Unit Tests (Surefire):** 23/23 passed:
  - `OutboxReadApiUnitTest` (3 tests)
  - `WorkerFleetAttributionTest` (4 tests)
  - `InvariantVerifierTest` (10 tests)
  - `BackoffCalculatorTest` (6 tests)

---

## 7. Production Bundle Performance & Code-Splitting

Production build verified via `npm run build` (`tsc -b && vite build` in 2.44s):

```
dist/index.html                                0.91 kB │ gzip:   0.43 kB
dist/assets/index-BNqIjY1L.css                61.54 kB │ gzip:  10.77 kB
dist/assets/ExecutionTimeline-Bm5jEQHh.js      8.53 kB │ gzip:   1.71 kB
dist/assets/JobDetailPage-BxuldGp3.js         10.17 kB │ gzip:   2.87 kB
dist/assets/WorkersPage-C8-Zz99G.js           16.09 kB │ gzip:   3.30 kB
dist/assets/JobExplorerPage-DWzwIwGu.js       21.81 kB │ gzip:   4.58 kB
dist/assets/EventPipelinePage-Bn3A2Flv.js     23.87 kB │ gzip:   5.63 kB
dist/assets/OverviewPage-D_g-ad9W.js          28.25 kB │ gzip:   5.84 kB
dist/assets/FairSharePage-D1jai0Qt.js         29.86 kB │ gzip:   6.10 kB
dist/assets/index-M_36cEX2.js                 34.00 kB │ gzip:   9.33 kB
dist/assets/vendor-icons-DcvQOpqH.js          16.24 kB │ gzip:   5.84 kB
dist/assets/vendor-query-BjnKI_5L.js          35.55 kB │ gzip:  10.51 kB
dist/assets/vendor-react-BLmuYti0.js         245.08 kB │ gzip:  78.07 kB
dist/assets/vendor-charts-CSpsmQwr.js        369.27 kB │ gzip: 107.20 kB (Lazy-loaded on chart routes)
```

- **Entry Chunk:** `34.00 kB` (gzip: `9.33 kB`).
- **Page Isolation:** Both `FairSharePage` (`29.86 kB`) and `EventPipelinePage` (`23.87 kB`) are completely code-split and only fetched when navigating to their respective routes.
- **Chart Deferral:** `vendor-charts` (`369.27 kB`) remains deferred until chart-heavy views are opened.

---

## 8. Host Environment & Unverified Runtime Backlog

- **Host Resources:** Total RAM 7.31 GB with approximately 830 MB free physical memory.
- **Docker Daemon:** Inactive on host. In adherence to strict host safety guidelines, Docker Desktop was not forcibly booted to prevent system thrashing or out-of-memory kernel panics.
- **Explicit Unverified Runtime Backlog:**
  1. *Flyway V8 PostgreSQL Migration:* Verified for SQL syntax and constraints; live PostgreSQL execution pending Docker/database availability.
  2. *Spring Integration Tests (PostgreSQL port 5435):* 19 SpringBootTest integration tests require an active database daemon.
  3. *Full Multi-Instance Docker Compose V2 Smoke Test:* Requires live Docker engine.
  4. *Live Browser DevTools Screenshots:* Headless Chrome DevTools execution unverified due to host RAM constraints.

---

## 9. Recommendations for Phase 8D

1. **ChaosLab Reliability Console:** Build the interactive ChaosLab visualizer to run simulated network partitions, worker crashes, and lease expiry experiments.
2. **Distributed Invariant Verification:** Surface the 9 ChaosLab formal invariants in real time with interactive pass/fail monitors.
3. **Selective DLQ Batch Operations:** Implement multi-row selective DLQ replaying and discarding partitioned by failure category.
