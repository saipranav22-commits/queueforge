# QueueForge Frontend Engineering Roadmap

## 1. Overview
The QueueForge frontend engineering strategy is structured into disciplined, verifiable phases to transition from an initial monitoring dashboard to a market-leading distributed infrastructure control plane.

---

## 2. Phase Deliverables & Status

### Phase 8A: Obsidian Pulse Premium UI/UX & Mission Control (Completed)
- [x] **Visual Token Foundation:** Formalize the **Obsidian Pulse** design system tokens in `tokens.css` with dark signature and light mode specifications.
- [x] **Theme Context Provider:** Implement `ThemeContext` supporting local persistence, system preference synchronization, and instantaneous theme toggle.
- [x] **Design System Component Library:**
  - `StatusIndicator`: Live animated pulse indicators with semantic statuses.
  - `Badge`: Crisp lifecycle state badges (`PENDING`, `RUNNING`, `COMPLETED`, `DEAD_LETTER`).
  - `CopyableId`: Monospace UUID formatter with one-click clipboard copy and tooltip.
  - `TenantQuotaProgress`: Real-time concurrency bar with dynamic color grading and DRR deficit tracking.
  - `DetailDrawer`: Slide-over inspection drawer with focus trapping and backdrop blur.
  - `CommandPalette`: Keyboard-activated (`Ctrl+K` / `⌘K`) spotlight modal for rapid navigation.
  - `MetricCard`: Obsidian Pulse elevated surface styling with restrained semantic accents.
- [x] **Mission Control Flagship Page:**
  - Section A: System Status Banner (DB, Coordinator, V2 cluster architecture).
  - Section B: Primary KPIs (Pending, Running, Completed, DLQ, Throughput).
  - Section C: Cluster Execution Activity AreaChart with time range selector (1h, 6h, 24h).
  - Section D: Distributed Worker Fleet Snapshot connected to real `/system/workers` discovery.
  - Section E: Recent Jobs Audit Table with filter dropdowns and slide-over Detail Drawer integration.
  - Section F: Reliability Lab Snapshot (DLQ counts, retries, failure breakdown).
  - Section G: FairShare Multi-Tenant Snapshot (weights, quotas, deficit counters).
  - Section H: Transactional Outbox Snapshot & manual dispatch action.
- [x] **Dedicated Sub-pages & Navigation Routes:**
  - `/fairshare`: Multi-tenant registry, quota monitor, and tenant provisioning modal.
  - `/pipeline`: Transactional outbox event pipeline visualizer and relay controls.
  - `/admin`: Security administration, session lifecycle, and authentication boundaries.

---

### Phase 8B: Advanced Job Explorer, Worker Fleet & Live Experience (Completed)
- [x] **Real Distributed Worker Registry Backend:**
  - Flyway migration `V8__create_worker_heartbeats_schema.sql` creating `qf_worker_heartbeats`.
  - Background coordinator heartbeat publisher loop updating instance status and active jobs.
  - Safe, read-only endpoint `GET /api/v1/system/workers` returning instance status (`ONLINE`, `STALE`, `OFFLINE`), held lease count, and completion totals.
  - Backwards-compatible `JobSummaryResponse` with `lockedBy` worker attribution and optional `priority` query parameter.
- [x] **Advanced Job Explorer Console:**
  - Search by UUID or idempotency key with instant input debounce.
  - Job type text filter, global vs isolated tenant selector, status filter pills (`PENDING`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`).
  - Priority filter pills (`High 80+`, `Med 50`, `Low 20`, `All`).
  - Server-side sorting across 5 database columns (`createdAt`, `updatedAt`, `priority`, `retryCount`, `scheduledAt`) with ASC/DESC direction toggle.
  - Multi-row selection checkboxes with bulk action clear toolbar.
  - In-page slide-over Job Inspector drawer with tabs: Overview, Timeline, Payload (with redaction toggle), and Failures.
- [x] **Verified Execution Timeline:**
  - Dedicated `ExecutionTimeline` component strictly displaying authentic recorded milestones: Enqueued, Scheduled Delay, Execution Attempt records (worker actor, duration, status, error), In-Flight Active Leases, and Terminal States.
- [x] **Distributed Worker Fleet Page (`/workers`):**
  - Full node discovery cards displaying instance ID, mode, concurrency, held leases, total completed, and total failures.
  - Real-time heartbeat freshness indicator (`Heartbeat 3s ago (fresh)`, `Stale (25s)`, `Unresponsive`).
  - Worker node inspector drawer with direct drill-down link to Job Explorer.
- [x] **Performance Optimization & Code-Splitting:**
  - Route-based `React.lazy()` and `Suspense` implementation across all routes.
  - Vite `manualChunks` vendor splitting (`vendor-react`, `vendor-charts`, `vendor-query`, `vendor-icons`).
  - Production bundle size reduced from monolithic 787 kB to individual page chunks (entry: 32.5 kB, charts: 369 kB lazy-loaded).
- [x] **Quality Verification:**
  - 100% passing test suite across 20 Vitest unit/component tests.
  - Clean TypeScript build (`tsc -b`), 0 compilation errors.
  - Clean linting (`oxlint`).
  - Optimized production Vite build in 2.30s.

---

### Phase 8C: FairShare Intelligence & Transactional Event Pipeline (Completed)
- [x] **FairShare Scheduling Analytics & Intelligence:**
  - Integrated real `/api/v1/admin/tenants/scheduler-config` endpoint providing base quantum, max sweep size, and active partition totals.
  - Live tenant concurrency quota and deficit tracking with real `runningCount` and `pendingCount` tallies.
  - Interactive Educational Simulator ("Deficit Round-Robin Mechanics") allowing operators to step through quantum addition ($Q_i = w_i \times Q_\text{base}$), quota bounding, and anti-hoarding deficit reset on empty queues.
  - Empirical Benchmark Evidence panel documenting verified local measurements from Profile 3 (Noisy Neighbor experiment: 11,868 ms quiet-tenant wait under FIFO reduced to 1,210 ms under FairShare DRR, with explicit ~21% throughput trade-off documentation).
  - Tenant editing modal supporting weight, maxConcurrency, and status updates via `PUT /api/v1/admin/tenants/{id}`.
- [x] **Transactional Event Pipeline Workspace:**
  - Implemented real backend read APIs: `GET /api/v1/admin/outbox/stats`, `GET /api/v1/admin/outbox/events` (paginated, filtered, searchable), and `GET /api/v1/admin/outbox/events/{id}`.
  - Real Outbox KPI counters: Pending, In-Flight Dispatching, Acknowledged Delivered, and Dead Letter.
  - 7-Stage End-to-End Business Flow Visualizer with active stage highlighting linked to selected database records.
  - Server-paginated Outbox Event Explorer table with debounced search across aggregate IDs, idempotency keys, and UUIDs.
  - Slide-over Event Detail Inspector drawer with delivery timeline, last error diagnostic box, and JSONB payload viewer.
  - Deep-link cross-page navigation between events and related jobs in Job Explorer.
  - Audited manual outbox dispatch bounded strictly to `[5, 10, 25, 50]` with admin confirmation modal.

---

### Phase 8D: Reliability Lab, Dead-Letter Operations & Premium Administration (Completed)
- [x] **Reliability Lab & Distributed Verification (`/reliability`):**
  - Real-time reliability overview metrics: DLQ poison jobs, system failures, successful completions, outbox dead-letter events, and active worker fleet resilience.
  - Core Distributed Resilience Mechanisms explorer: 8 interactive mechanism cards (Lease Fencing, Orphan Lease Sweeper, Full Jitter Backoff, DLQ Poison Isolation, Transactional Outbox, Durable Idempotency, FairShare DRR, SmartLifecycle Graceful Drain) with problems solved, implementations, and formal guarantees.
  - Historical ChaosLab Experiment Evidence panel: 3 empirical fault injection experiments (Experiment A: Hard Worker Crash mid-execution, Experiment B: Zombie Worker & Fencing Token protection, Experiment C: Split-Brain Network Partition) with millisecond execution chronologies and verified pass statuses.
  - Formal Correctness Invariant Matrix: 9 mathematical distributed invariants (SAFETY-1 through SAFETY-6, LIVENESS-1 through LIVENESS-3) evaluated across database states and append-only audit traces.
- [x] **Dead-Letter Queue Operations Console (`/dlq`):**
  - Full Obsidian Pulse design system overhaul eliminating legacy Tailwind styling.
  - Server-side filtered and paginated poison job explorer with search and failure category filtering (`TRANSIENT_FAILURE`, `PERMANENT_FAILURE`, `LEASE_EXPIRED`, `HANDLER_NOT_FOUND`).
  - Slide-over diagnostic inspector drawer displaying metadata, failure taxonomy badge, retry counter, formatted fatal error message, collapsible stack trace, formatted JSON payload viewer, and direct link to Job Explorer.
  - Safe replay workflow with confirmation modal explaining status reset to `PENDING` and zeroed claim token.
  - Safe discard workflow with confirmation modal explaining soft-deleted archival to preserve audit trail.
  - Backend controller update supporting both `POST` and `DELETE` on `/api/v1/admin/dlq/{jobId}/discard`.
- [x] **Control Plane Administration (`/admin`):**
  - Obsidian Pulse design tokens across all administration widgets.
  - Access control and session lifecycle management with real-time privilege status (ADMINISTRATOR vs READ-ONLY), unlock/lock modal controls, and anti-CSRF double-submit cookie verification.
  - Tenant administration snapshot with active tenant counts, aggregate weight capacity, and direct navigation to FairShare.
  - Runtime platform configuration displaying real HikariCP connection pool metrics (active, idle, total, timeouts) and Worker Coordinator execution thresholds (lease duration, poll interval, recovery sweep).
  - Explicit security boundaries documenting cross-tenant isolation, secret masking policies, and append-only audit trail immutability.
- [x] **Observability & Distributed Metrics (`/monitoring`):**
  - Obsidian Pulse design tokens with median (p50), p95, and p99 execution latencies, as well as p50 and p95 queue wait times from `/api/v1/system/metrics-summary`.
  - Failure category breakdown progress bars.
  - Truthful external telemetry integration panel documenting Prometheus scrape endpoint (`/actuator/prometheus`) and Docker Compose Grafana dashboard definitions.
- [x] **Quality Gate:**
  - 30/30 Vitest tests passing across 17 test files.
  - Clean TypeScript compilation (`tsc -b`), 0 errors.
  - 23/23 backend unit tests passing in Maven Surefire.
  - Optimized production Vite build with perfect chunk splitting.

---

### Phase 8E: Obsidian Pulse Final Product Polish, Full-Stack Validation & Release Readiness (Completed)
- [x] **Obsidian Pulse Token Standardization:**
  - Standardized all component surfaces, borders, text, and badges onto official Obsidian Pulse tokens (`tokens.css`).
  - Added explicit `--color-amber` and `--color-crimson` variables to both dark and light theme palettes.
  - Replaced all legacy Tailwind utilities (`slate-*`, `purple-*`, `blue-*`, `emerald-*`, `rose-*`) with verified semantic design tokens.
  - Verified light theme parity and high-contrast WCAG 2.1 AA accessibility ratios.
- [x] **Accessible Component Upgrades:**
  - Upgraded `ConfirmModal.tsx`, `AdminUnlockModal.tsx`, `JsonViewer.tsx`, and `Pagination.tsx` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and keyboard `Escape` dismissal listeners.
  - Added safe optional chaining in `JsonViewer.tsx` to prevent clipboard crashes in unsupported environments.
- [x] **Data Provenance & Semantic Truthfulness:**
  - Created exhaustive 38-metric UI Data Provenance Matrix (`docs/frontend/FINAL_UI_DATA_PROVENANCE.md`).
  - Strictly segregated educational simulations, benchmark exhibits, and live telemetry.
  - Corrected live deficit counter labeling to *Persisted Sweep Deficit ($D_i$)* from `qf_tenants.deficit_counter`.
- [x] **Demonstration Readiness:**
  - Created recruiter-friendly demonstration script (`docs/demo/QUEUEFORGE_DEMO_SCRIPT.md`) with 60–90 second pitch and 3–5 minute technical walkthrough.
- [x] **Release Readiness Assessment:**
  - Created formal release readiness checklist (`docs/release/UI_RELEASE_READINESS_CHECKLIST.md`) assessing platform as **CONDITIONALLY READY**.
  - Documented physical host RAM constraints (~613 MB free RAM) and provided an automated CI validation plan.
- [x] **Final Quality Gates:**
  - 38/38 Vitest unit/component tests passing across 20 test files (100% green).
  - Clean TypeScript build (`tsc -b`), 0 errors.
  - Clean linting (`oxlint`), 0 errors.
  - Optimized production Vite build in 1.97s (CSS: 52.61 kB; entry JS: 35.66 kB).
  - 23/23 backend unit tests passing in Maven Surefire.
  - Simulated payment receiver test-compiles cleanly with 0 errors.
