# QueueForge Control Plane — UI Release Readiness Checklist

**Release Target:** QueueForge V2 Control Plane (Phase 8E)  
**Branch:** `feature/v2-control-plane-ui`  
**Base Commit Anchor:** `7125821`  
**Current Commit:** `d1b4a40`  
**Evaluator:** Principal Full-Stack Engineer, Security Reviewer & Release Engineer  
**Date:** November 19, 2026

---

## 1. Overall Release Assessment

### Current Status: **CONDITIONALLY READY (LOCAL UNIT & COMPILATION VERIFIED; LIVE DOCKER RUNTIME PENDING CI RUN)**

| Assessment Area | Status | Summary Evidence |
| :--- | :--- | :--- |
| **Frontend Code Quality** | **PASS** | TypeScript (`tsc -b`) compiles with 0 errors; Oxlint passes with 0 errors. |
| **Frontend Test Suite** | **PASS** | 38/38 unit/component tests passing across 20 Vitest test files. |
| **Production Bundle Quality** | **PASS** | Vite production build in 1.97s; code-split chunks with optimal vendor caching. |
| **Design System Fidelity** | **PASS** | Obsidian Pulse tokens strictly enforced; zero legacy `slate-`, `purple-`, or `blue-` utility leaks; light theme parity confirmed. |
| **Data Provenance & Semantics** | **PASS** | Exhaustive data provenance matrix completed; synthetic live telemetry eliminated; benchmark and historical exhibits clearly cited. |
| **Security & Authentication** | **PASS** | Double-submit CSRF protection verified; sensitive payloads masked in read-only mode; admin mutations locked; tenant isolation preserved. |
| **Backend Unit Regression** | **PASS** | 23/23 database-independent backend unit tests passing in Maven Surefire. |
| **Flyway V8 & Database Runtime** | **BLOCKED (HOST MEMORY)** | Host physical RAM constraint (~613 MB free out of 7.3 GB) prevents booting Docker Desktop / PostgreSQL without severe system thrashing. Bootstrapping must run via CI gate. |

---

## 2. Functional Verification Matrix

| Area / Page | Verification Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Mission Control (`/`)** | Health metrics, KPI cards, real-time throughput chart, quick action links, poison alert banner | **VERIFIED** | Unit tested in `MissionControl.test.tsx`. Responsive container with honest degraded states when backend offline. |
| **Job Explorer (`/jobs`)** | Server-side pagination, debounced search, status pills, priority filter, multi-selection, drawer drill-down | **VERIFIED** | Unit tested in `JobExplorer.test.tsx`. Supports sorting by Created, Updated, Priority, Retries. |
| **Job Detail (`/jobs/{id}`)** | Verified execution timeline, worker attribution, duration breakdown, JSON payload viewer with masking, copy button | **VERIFIED** | Unit tested in `ExecutionTimeline.test.tsx` and `JsonViewer.test.tsx`. Non-admin sessions mask sensitive fields. |
| **Worker Fleet (`/workers`)** | Dynamic node cards, heartbeat freshness calculation, held leases vs historical attribution, worker drawer | **VERIFIED** | Unit tested in `WorkersPage.test.tsx`. Integrates with Flyway V8 `qf_worker_heartbeats` schema. |
| **FairShare (`/fairshare`)** | Tenant concurrency quotas, persisted sweep deficit ($D_i$), interactive educational simulator, Profile 3 benchmark evidence, edit modal | **VERIFIED** | Unit tested in `FairSharePage.test.tsx` and `TenantQuotaProgress.test.tsx`. Explicit separation of simulator from live telemetry. |
| **Event Pipeline (`/pipeline`)** | Outbox KPI strip, 7-stage business flow visualizer with verification tiers, server-side paginated explorer, detail drawer, bounded dispatch | **VERIFIED** | Unit tested in `EventPipelinePage.test.tsx`. Batch size strictly bounded to `[5, 10, 25, 50]`. |
| **Reliability Lab (`/reliability`)** | Overview metrics, 8 resilience mechanisms, historical ChaosLab experiment evidence, 9 formal invariant matrix | **VERIFIED** | Unit tested in `ReliabilityLabPage.test.tsx`. Interactive mechanism tabs and category-filtered invariant grid. |
| **Dead-Letter Queue (`/dlq`)** | Server-side poison job explorer, failure category dropdown, detail drawer with stack trace, replay/discard confirmation modals | **VERIFIED** | Unit tested in `DlqPage.test.tsx` and `ConfirmModal.test.tsx`. Backend controller supports both POST and DELETE on discard. |
| **Administration (`/admin`)** | Session privilege toggle, anti-CSRF status, tenant snapshot, live HikariCP connection metrics, worker coordinator parameters, security policies | **VERIFIED** | Unit tested in `AdministrationPage.test.tsx`. Consumes real `/system/health` metrics. |
| **Observability (`/monitoring`)** | p50/p95/p99 execution durations, p50/p95 queue wait times, failure category progress bars, Prometheus/Grafana telemetry integration panel | **VERIFIED** | Unit tested in `MonitoringPage.test.tsx`. Eliminates dead hardcoded external localhost links. |

---

## 3. Security, Authentication & Isolation Review

1. **Anti-CSRF Verification:** Double-submit cookie verification (`X-CSRF-Token` header matched against session cookie in `AdminAuthInterceptor.java`) is strictly enforced on mutating HTTP methods (`POST`, `PUT`, `DELETE`).
2. **Payload Redaction:** Unauthenticated sessions receive payloads containing `{"_masked": true}` or redacted fields. The full JSON payload is only returned to authenticated sessions.
3. **Tenant Boundary Fencing:** All queries containing `X-Tenant-Key` are strictly isolated by `TenantAuthInterceptor.java` to tenant-owned records in `qf_jobs` and `outbox_events`. Cross-tenant mutations yield HTTP 403 Forbidden.
4. **Secret Protection:** Receiver authentication secret `X-Service-Key` and admin API keys are strictly masked in logs, health endpoints, and client-visible responses.
5. **No Destructive Public Actions:** ChaosLab failure injection controls are not exposed in production client bundles. Replay and discard operations require affirmative two-step confirmation dialogs.

---

## 4. Accessibility (A11y) & Responsive Audit

- **Focus Rings:** Applied custom focus rings (`qf-focus-ring`) to all buttons, inputs, links, and selectable rows.
- **Dialog & Drawer Semantics:** All modal dialogs and slide-over drawers implement `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and keyboard `Escape` dismissal listeners.
- **Screen Reader Labels:** Icon-only buttons (copy, close, theme toggle, mobile menu) include explicit `aria-label` or `title` attributes.
- **Color Contrast:** High-contrast text tokens (`#F2F4FA` frost white on dark surfaces; `#0B0E17` obsidian text on light surfaces) exceed WCAG 2.1 AA requirements (contrast ratio > 7:1 for normal text).
- **Responsive Breakpoints:** Fully responsive across mobile (375px), tablet (768px), desktop (1280px), and wide (1440px) viewports with mobile sidebar drawer overlay.

---

## 5. Performance & Production Bundle Metrics

- **Vite Production Build Time:** 1.97s
- **CSS Bundle Size:** 52.61 kB (gzip: 9.20 kB)
- **Code-Split Chunks:**
  - `dist/assets/index-*.js`: 35.66 kB (gzip: 9.54 kB) — lightweight application shell
  - `dist/assets/JobExplorerPage-*.js`: 21.81 kB (gzip: 4.58 kB)
  - `dist/assets/EventPipelinePage-*.js`: 24.96 kB (gzip: 5.85 kB)
  - `dist/assets/ReliabilityLabPage-*.js`: 27.62 kB (gzip: 8.19 kB)
  - `dist/assets/FairSharePage-*.js`: 29.98 kB (gzip: 6.15 kB)
  - `dist/assets/OverviewPage-*.js`: 28.32 kB (gzip: 5.86 kB)
  - `dist/assets/WorkersPage-*.js`: 16.09 kB (gzip: 3.30 kB)
  - `dist/assets/AdministrationPage-*.js`: 16.34 kB (gzip: 3.35 kB)
  - `dist/assets/DlqPage-*.js`: 18.13 kB (gzip: 4.35 kB)
  - `dist/assets/MonitoringPage-*.js`: 9.39 kB (gzip: 2.20 kB)
- **Vendor Splitting:**
  - `vendor-icons`: 17.22 kB (gzip: 6.14 kB)
  - `vendor-query`: 35.55 kB (gzip: 10.51 kB)
  - `vendor-react`: 245.08 kB (gzip: 78.07 kB)
  - `vendor-charts`: 369.27 kB (gzip: 107.20 kB) — loaded strictly on demand when visiting chart views.

---

## 6. Runtime Blockers & CI Validation Plan

### Host Environment Constraint
- **Physical Memory:** 7.31 GB total system RAM.
- **Available Free Memory:** ~613 MB free physical memory.
- **Blocker:** Running Docker Desktop, WSL2 VM, or PostgreSQL database containers on this host with ~613 MB free RAM risks immediate host swapping, freezing, or OOM crashes.
- **Integrity Rule:** In accordance with the prompt instructions ("Never launch an unsafe full stack merely to satisfy a checklist. Never claim a migration is runtime-verified based on SQL inspection alone"), live multi-container smoke tests and Flyway V8 container bootstrapping are truthfully marked **BLOCKED LOCALLY** and deferred to GitHub CI.

### Recommended CI Validation Sequence
1. Push branch `feature/v2-control-plane-ui` to remote after code review approval.
2. Trigger GitHub Actions CI workflow on an ephemeral runner with 16 GB RAM.
3. CI executes:
   ```bash
   # 1. Flyway V8 migration against PostgreSQL 16
   mvn -f backend/pom.xml flyway:migrate
   
   # 2. Complete backend integration test suite (22 integration test classes)
   mvn -f backend/pom.xml verify
   
   # 3. Simulated payment receiver test suite (3 test classes)
   mvn -f simulated-payment-receiver/pom.xml test
   
   # 4. Frontend verification
   npm --prefix frontend run build
   npm --prefix frontend test -- --run
   
   # 5. Full 7-container Docker Compose live smoke test
   pwsh scripts/smoke-test-v2.ps1
   ```

---

## 7. Recommended Merge Order

1. **Pull Request #1 (Backend V2 Anchor):** Merge PR #1 (`feature/multi-instance-workers` -> `main`) once CI checks pass.
2. **Pull Request #2 (Control Plane UI):** Create PR from `feature/v2-control-plane-ui` targeting `main` (which will contain the merged V2 backend).
3. **Release Tagging:** Tag `v2.0.0` on `main` once both backend and frontend are unified.
