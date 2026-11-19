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

### Phase 8C: Reliability Lab, ChaosLab Visualizer & Observability (Planned)
- [ ] **Interactive ChaosLab Visualizer:** Real-time visualization of simulated worker partition, lease expiry, and network fault injection.
- [ ] **Advanced DLQ Operations:** Batch replay, selective discard by failure category, and stacktrace search.
- [ ] **Grafana / Prometheus Embeds:** Live latency histogram and throughput gauges embedded with zero authentication friction.
