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
  - Section D: Distributed Worker Fleet Snapshot (`worker-v2-node-1`, `worker-v2-node-2`).
  - Section E: Recent Jobs Audit Table with filter dropdowns and slide-over Detail Drawer integration.
  - Section F: Reliability Lab Snapshot (DLQ counts, retries, failure breakdown).
  - Section G: FairShare Multi-Tenant Snapshot (weights, quotas, deficit counters).
  - Section H: Transactional Outbox Snapshot & manual dispatch action.
- [x] **Dedicated Sub-pages & Navigation Routes:**
  - `/fairshare`: Multi-tenant registry, quota monitor, and tenant provisioning modal.
  - `/pipeline`: Transactional outbox event pipeline visualizer and relay controls.
  - `/admin`: Security administration, session lifecycle, and authentication boundaries.
- [x] **Quality Verification:**
  - 100% clean TypeScript build (`npx tsc -b`).
  - 100% passing test suite (16/16 Vitest tests).
  - Clean linting (`oxlint`).
  - High-performance Vite production build bundle.

---

### Phase 8B: Advanced Explorer, Live Event Streaming & Chaos Controls (Planned)
- [ ] **Job Explorer Advanced Filtering:** Multi-column sorting, pagination controls, date range pickers, and JSON payload query filter.
- [ ] **Live Execution Log Streaming:** WebSocket or Server-Sent Events (SSE) log tailing for active worker execution attempts.
- [ ] **ChaosLab Visualizer:** Interactive failure simulation controls (simulate worker partition, DB disconnection, and lease expiry).
- [ ] **Worker Fleet Deep Dive:** Node thread threadpool visualization and per-worker task affinity charts.

---

### Phase 9: Telemetry Dashboards & Multi-Cluster Federation (Future)
- [ ] **Embedded Grafana Dashboards:** Zero-authentication telemetry embeds for high-frequency Prometheus metrics.
- [ ] **Multi-Cluster Tenant Management:** Federated multi-region cluster status view.
- [ ] **Export & Audit Logging:** CSV/JSON export capabilities for compliance and audit reporting.
