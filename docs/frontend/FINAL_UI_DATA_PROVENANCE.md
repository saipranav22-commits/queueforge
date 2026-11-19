# QueueForge Control Plane — Final UI Data Provenance Matrix

**Specification Version:** V2.0  
**Design System:** Obsidian Pulse  
**Last Audited:** November 19, 2026 (Phase 8E)  
**Target Codebase:** `feature/v2-control-plane-ui` (`d1b4a40`)

---

## 1. Overview & Semantic Principles

To ensure complete engineering integrity and eliminate misleading "mock operational data" disguised as live telemetry, every user-facing metric, counter, status badge, and chart in the QueueForge Control Plane is audited against its verified backend data source.

### Semantic Metric Classifications
- **GAUGE:** Point-in-time instantaneous measurement of a changing quantity (e.g. active running jobs, pool connections).
- **COUNTER:** Monotonically increasing tally of occurrences since cluster epoch or reset (e.g. lifetime completed jobs).
- **RATE / DERIVED:** Computed ratio or moving average calculated over a sliding observation window (e.g. throughput jobs/sec).
- **HISTORICAL EXHIBIT:** Authenticated measurement captured during controlled distributed failure experiments or benchmarks (e.g. Profile 3 Noisy Neighbor benchmark, ChaosLab timelines). Clearly labeled with artifact citations.
- **PERSISTED SWEEP SNAPSHOT:** Discrete database state updated at the conclusion of periodic scheduling sweeps (e.g. $D_i$ tenant deficit counter in `qf_tenants.deficit_counter`).

---

## 2. Complete UI Data Provenance Table

| # | Page / Component | Visible UI Label | Backend API Endpoint | Source Field | Unit / Type | Metric Class | Polling Cadence | Auth Scope | Degraded / Unavailable Handling | Validation Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `OverviewPage` (KPI) | Active Cluster Workers | `/dashboard/stats` | `activeWorkers`, `workerCapacity` | Workers / Integer | GAUGE | 3,000 ms | Public (Read-Only) | Shows `0 / 4 WORKERS` | `WorkerFleetAttributionTest.java` |
| **2** | `OverviewPage` (KPI) | Active Running Jobs | `/dashboard/stats` | `activeJobs` | Jobs / Integer | GAUGE | 3,000 ms | Public (Read-Only) | Shows `0` | `JobQueryService.java` |
| **3** | `OverviewPage` (KPI) | Pending Execution Queue | `/dashboard/stats` | `pendingJobs` | Jobs / Integer | GAUGE | 3,000 ms | Public (Read-Only) | Shows `0` | `JobQueryService.java` |
| **4** | `OverviewPage` (KPI) | System Throughput | `/dashboard/stats` | `throughputJobsPerSec` | Jobs/sec | RATE | 3,000 ms | Public (Read-Only) | Shows `0.0/s` | `MetricsService.java` |
| **5** | `OverviewPage` (Chart) | Real-Time Execution Flow | `/dashboard/stats` | Time-series buffer | Jobs/sec (5-min window) | RATE (Rolling) | 3,000 ms | Public (Read-Only) | Empty chart with baseline 0 | `OverviewPage.tsx#L120` |
| **6** | `OverviewPage` (Table) | Live Tenant Queue Partitioning | `/admin/tenants` | `name, weight, maxConcurrency, activeRunningJobs, deficitCounter` | Slots & Weights | GAUGE + SNAPSHOT | 5,000 ms | Admin Cookie / Header | Collapses to unauthenticated prompt | `TenantSecurityIntegrationTest.java` |
| **7** | `OverviewPage` (Alert) | Poison Jobs Quarantined | `/dashboard/stats` | `deadLetterJobs` | Jobs / Integer | GAUGE | 3,000 ms | Public (Read-Only) | Hidden if 0 | `AdminDlqService.java` |
| **8** | `JobExplorerPage` | Total Queue Count | `/api/v1/jobs` | `totalElements` | Jobs / Integer | COUNTER (Filtered) | 3,000 ms | Public / Tenant Scoped | Shows `0 jobs total` | `JobController.java` |
| **9** | `JobExplorerPage` | Job Status Badge | `/api/v1/jobs` | `content[].status` | Enum (PENDING..DEAD_LETTER) | GAUGE | 3,000 ms | Public / Tenant Scoped | Renders `StatusBadge` default | `StatusBadge.tsx` |
| **10** | `JobDetailPage` | Attempt Number & Max | `/api/v1/jobs/{id}/detail` | `attemptCount`, `maxRetries` | Integer ratio | COUNTER | 2,000 ms (active) / 10s | Public / Tenant Scoped | `1 / 3` | `JobClaimService.java` |
| **11** | `JobDetailPage` | Execution Duration | `/api/v1/jobs/{id}/history` | `executionLogs[].executionTimeMs` | Milliseconds | GAUGE | 3,000 ms | Public / Tenant Scoped | Shows `— ms` | `qf_job_execution_logs` |
| **12** | `JobDetailPage` | In-Flight Active Lease | `/api/v1/jobs/{id}/detail` | `lockedBy` | Worker Instance UUID | GAUGE | 2,000 ms | Public / Tenant Scoped | Shows `Unassigned` | `LeaseFencingIntegrationTest.java` |
| **13** | `JobDetailPage` | Payload Masking | `/api/v1/jobs/{id}/detail` | `payload._masked` | Boolean | GAUGE | 10,000 ms | Public (Masked) / Admin (Clear) | Shows `{"_masked": true}` | `JobDetailResponse.java` |
| **14** | `WorkersPage` | Registered Worker Instance | `/api/v1/system/workers` | `instanceId` | String UUID | GAUGE | 3,000 ms | Public (Read-Only) | Shows empty fleet banner | `V8__create_worker_heartbeats` |
| **15** | `WorkersPage` | Heartbeat Freshness | `/api/v1/system/workers` | `lastHeartbeat` | Timestamp / Seconds ago | DERIVED GAUGE | 3,000 ms | Public (Read-Only) | Stale (>10s) / Dead (>30s) | `WorkersPage.tsx#L45` |
| **16** | `WorkersPage` | Held Active Leases | `/api/v1/system/workers` | `activeLeases` | Leases / Integer | GAUGE | 3,000 ms | Public (Read-Only) | Shows `0 held` | `WorkerFleetAttributionTest.java` |
| **17** | `WorkersPage` | Lifetime Node Completed | `/api/v1/system/workers` | `completedTotal` | Jobs / Integer | COUNTER | 3,000 ms | Public (Read-Only) | Shows `0 jobs` | `WorkerCoordinator.java` |
| **18** | `FairSharePage` | Concurrency Quota Headroom | `/admin/tenants` | `maxConcurrency`, `runningCount` | Slots / Integer | GAUGE | 5,000 ms | Admin Cookie / Header | Shows 0 slots | `FairShareScheduler.java` |
| **19** | `FairSharePage` | Persisted Sweep Deficit ($D_i$) | `/admin/tenants` | `deficitCounter` | Decimal Credits | PERSISTED SNAPSHOT | 5,000 ms | Admin Cookie / Header | Shows `0.0` (reset on drain) | `qf_tenants.deficit_counter` |
| **20** | `FairSharePage` | Base Quantum ($Q_\text{base}$) | `/admin/tenants/scheduler-config`| `baseQuantum` | Credits / Integer | GAUGE | Static (On Load) | Admin Cookie / Header | Fallback default 1 | `FairShareConfigResponse.java` |
| **21** | `FairSharePage` | Profile 3 Benchmark Metrics | `docs/benchmarks/profile-3.md` | Recorded FIFO vs DRR wait | Milliseconds | HISTORICAL EXHIBIT | Static Artifact | Public | Permanent exhibit banner | `Profile3Benchmark.java` |
| **22** | `EventPipelinePage` | Pending Outbox Events | `/admin/outbox/stats` | `pendingCount` | Events / Integer | GAUGE | 3,000 ms | Admin Cookie / Header | Shows `0` | `OutboxReadApiUnitTest.java` |
| **23** | `EventPipelinePage` | Delivered Outbox Events | `/admin/outbox/stats` | `deliveredCount` | Events / Integer | COUNTER | 3,000 ms | Admin Cookie / Header | Shows `0` | `OutboxReadApiUnitTest.java` |
| **24** | `EventPipelinePage` | Pipeline Stage Verification | `EventPipelinePage.tsx` | Stage Tier (`VERIFIED` / `INFERRED`)| Badge String | ARCHITECTURAL SPEC | Static | Public | Labeled per stage card | `EventPipelinePage.tsx#L35` |
| **25** | `EventPipelinePage` | Order Domain UUID | `/admin/outbox/events/{id}` | `aggregateId`, `aggregateType` | UUID String | GAUGE | On Demand | Admin Cookie / Header | Shows Order Entity UUID | `qf_orders.id` |
| **26** | `ReliabilityLabPage` | Total System Failures | `/system/metrics-summary` | `failedTotal` | Attempts / Integer | COUNTER | 5,000 ms | Public (Read-Only) | Shows `0` | `MetricsService.java` |
| **27** | `ReliabilityLabPage` | ChaosLab Millisecond Traces | `docs/engineering/chaoslab.md` | Exp A, B, C chronologies | Milliseconds / Sequence | HISTORICAL EXHIBIT | Static Artifact | Public | Documented exhibit box | `InvariantVerifierTest.java` |
| **28** | `ReliabilityLabPage` | 9 Correctness Invariants | `InvariantVerifier.java` | Safety-1..6, Liveness-1..3 | Verification Logic | FORMAL MATRIX | Static Specification | Public | `VERIFIED PASS` status | `InvariantVerifier.java` |
| **29** | `DlqPage` | DLQ Poison Tally | `/admin/dlq` / `/jobs?status=DLQ`| `totalElements` | Poison Jobs / Integer | GAUGE | 3,000 ms | Admin / Public Fallback | Shows clean state | `AdminDlqController.java` |
| **30** | `DlqPage` | Failure Category Badge | `/admin/dlq` | `failureCategory` | Enum String | GAUGE | 3,000 ms | Admin / Public Fallback | Shows `UNKNOWN` if null | `FailureCategory.java` |
| **31** | `DlqPage` | Diagnostic Stack Trace | `/admin/dlq/{id}` | `lastErrorStack` | Exception Frames / Text | GAUGE | On Demand | Admin Cookie / Header | Prompts admin unlock | `DlqJobDetailResponse.java` |
| **32** | `AdministrationPage` | Session Privilege Mode | `/api/v1/auth/status` | `authenticated` | Boolean | GAUGE | 5,000 ms | Public / Cookie | Shows `READ-ONLY` | `AuthController.java` |
| **33** | `AdministrationPage` | HikariCP Active Connections | `/system/health` | `databasePoolActive` | Connections / Integer | GAUGE | 5,000 ms | Public (Read-Only) | Shows `0` | `HikariDataSourcePoolMetadata`|
| **34** | `AdministrationPage` | Worker Lease Duration | `/system/health` | `leaseDurationSeconds` | Seconds / Integer | GAUGE | 5,000 ms | Public (Read-Only) | Shows `30 seconds` | `WorkerCoordinator.java` |
| **35** | `MonitoringPage` | Median (p50) Execution Latency | `/system/metrics-summary` | `executionLatencyP50Ms` | Milliseconds | GAUGE | 5,000 ms | Public (Read-Only) | Shows `0 ms` | `MetricsService.java` |
| **36** | `MonitoringPage` | 95th Percentile Execution | `/system/metrics-summary` | `executionLatencyP95Ms` | Milliseconds | GAUGE | 5,000 ms | Public (Read-Only) | Shows `0 ms` | `MetricsService.java` |
| **37** | `MonitoringPage` | Queue Wait Time (p95) | `/system/metrics-summary` | `queueWaitLatencyP95Ms` | Milliseconds | GAUGE | 5,000 ms | Public (Read-Only) | Shows `0 ms` | `MetricsService.java` |
| **38** | `MonitoringPage` | Failure Category Progress | `/system/metrics-summary` | `failuresByCategory` | Map<String, Long> | GAUGE Distribution | 5,000 ms | Public (Read-Only) | Shows clean operational window | `MetricsService.java` |

---

## 3. Specific Subsystem Audits (Points A through J)

### A. Worker Heartbeat Status Thresholds
- **Threshold Rule:**
  - $\Delta t \le 10\text{s}$: `ONLINE` (green heartbeat, `Fresh`)
  - $10\text{s} < \Delta t \le 30\text{s}$: `DEGRADED` (amber pulse, `Stale`)
  - $\Delta t > 30\text{s}$: `STOPPED` / `UNRESPONSIVE` (crimson indicator, `Lease Expired`)
- **Semantic Truthfulness:** The frontend does NOT synthesize artificial heartbeats. If the PostgreSQL table `qf_worker_heartbeats` is unpopulated or unreachable, the UI honestly renders empty state with clear documentation of the V8 migration requirement.

### B. Current Lease Ownership vs Historical Worker Attribution
- **Current Lease Ownership:** Derived from `qf_jobs.locked_by = :instanceId` where `status IN ('CLAIMED', 'RUNNING')` and `lease_until >= NOW()`. Represents transient, exclusive ownership protected by fencing tokens.
- **Historical Attribution:** Derived from append-only `qf_job_execution_logs.worker_id = :instanceId`. Represents completed or failed past attempts.
- **UI Clarification:** In `WorkersPage.tsx` and `WorkerDetailDrawer`, these two metrics are visually and structurally segregated into *Current Active Leases* and *Total Completed History*.

### C. Persisted FairShare Deficit Counter vs Live Streaming Gauge
- **Audit Correction:** The deficit counter is stored in PostgreSQL as `qf_tenants.deficit_counter`. It is updated at the conclusion of each DRR sweep:
  $$D_i \leftarrow D_i + Q_i - K_i$$
  and reset to zero ($D_i \leftarrow 0$) whenever the tenant queue drains.
- **Labeling:** Accurately designated across `FairSharePage.tsx` and `TenantQuotaProgress.tsx` as *Persisted Sweep Deficit ($D_i$)*, preventing users from expecting a high-frequency streaming microsecond counter.

### D. Benchmark Results vs Live Throughput
- **Audit Rule:** Benchmark figures from Profile 3 (Noisy Neighbor: 11,868 ms FIFO latency vs 1,210 ms FairShare DRR latency) are permanently isolated into a dedicated *Historical Benchmark Evidence* card.
- **Truthful Labeling:** The live cluster throughput meter strictly consumes `/dashboard/stats` (`throughputJobsPerSec`). Live meters never display synthetic benchmark constants.

### E. Outbox Architectural Stages vs Recorded Delivery Evidence
- **7-Stage Categorization:**
  - `VERIFIED`: Step 1 (Order in `qf_orders`), Step 2 (Pending record in `outbox_events`), Step 3 (Claimed with UUID `claim_token`), Step 7 (Acknowledged with HTTP 200/201 and `delivered_at`).
  - `INFERRED / ACTIVE`: Step 4 (Dispatcher HTTP POST in-flight).
  - `ARCHITECTURAL / INFERRED`: Step 5 (Receiver database idempotency check) and Step 6 (Downstream charge commitment).
- **Visual Distinction:** Distinctly badged with `[VERIFIED]`, `[INFERRED / ACTIVE]`, and `[ARCHITECTURAL / INFERRED]` tags.

### F. Retry Attempts vs Unique Jobs
- **Distinction:** In all summary grids, `totalJobs` represents unique database rows in `qf_jobs`, whereas `attemptCount` represents attempts on that job. System-wide `failedTotal` in `/system/metrics-summary` tracks failure transitions across attempts.

### G. DLQ Status Values & Failure Categories
- **Statuses:** `DEAD_LETTER` is a first-class terminal state in `qf_jobs.status`.
- **Taxonomy:** Strictly maps to backend enum `FailureCategory`: `TRANSIENT_FAILURE`, `PERMANENT_FAILURE`, `LEASE_EXPIRED`, `HANDLER_NOT_FOUND`.

### H. Live HikariCP Parameters vs Static Configured Values
- **Audited:** In `AdministrationPage.tsx`, active connections (`health.databasePoolActive`), idle connections (`health.databasePoolIdle`), and maximum total (`health.databasePoolTotal`) are read dynamically from Spring Boot actuator health metrics via `HikariDataSourcePoolMetadata`. Timeouts (30,000ms connection timeout, 600,000ms idle timeout) are documented as configured driver limits.

### I. Worker Coordinator Interval Defaults vs Runtime Configuration
- **Audited:** Lease duration (`health.leaseDurationSeconds` = 30s) and poll interval (`health.pollIntervalMs` = 100ms) are dynamically retrieved from the runtime health payload. Recovery sweep (1,000ms) and termination drain (25s) are verified against `WorkerCoordinator.java` implementation defaults.

### J. Latency Percentiles & Time-Range Semantics
- **Audited:** p50, p95, and p99 execution latencies are populated from real Micrometer histograms via `/api/v1/system/metrics-summary`. Time ranges that lack time-bucket persistence in the database are not presented as fake historical trend lines.
