# QUEUEFORGE V2 — PHASE 13D: EXPERIENCE ARCHITECTURE & PRODUCT TRANSFORMATION

**Document ID:** `QF-DOC-13D-ARCH`  
**Classification:** Architecture & Product Design Specification  
**Status:** Implemented & Verified  
**Branch:** `feature/v2-ultimate-control-plane`  
**Target Environment:** Localhost (Vite dev server on `http://127.0.0.1:5173`)  

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 The Owner's Feedback
Following Phase 13A (the initial Obsidian Pulse redesign) and Phase 13C (token refinement and unlock button contrast correction), the platform frontend remained functional but felt **bland, generic, and visually underwhelming**. Specifically:
- **Repetitive Component Layouts:** Every page began with an identical 4-card metric grid spanning the top of the viewport.
- **Topology Demoted:** The distributed system topology—the signature architectural differentiator of QueueForge—was placed beneath KPI cards in a secondary slot.
- **Offline Cold State Void:** On the owner's 8 GB laptop (where Docker, PostgreSQL, and Spring Boot workers cannot be continuously run alongside IDEs), the application rendered zero counts, disconnected banners, and empty tables.
- **Color-Only Pitfall:** Simply adjusting hex codes or adding border glows failed to communicate the deep distributed systems engineering (DRR multi-tenancy, atomic outbox 2PC, advisory lease fencing, poison DLQ quarantine) under the hood.

### 1.2 The Transformation Vision: QueueForge Command
Phase 13D transitions the frontend from a dark administrative dashboard into **QUEUEFORGE COMMAND — Distributed Execution Intelligence Platform**:
1. **Unified Platform Command Header:** Immediate system identity, data provenance badges, and action triggers.
2. **Dominant Centerpiece Topology Workspace:** Centered, interactive SVG canvas with 4 architectural subsystem zones (`INGRESS`, `PERSISTENCE`, `EXECUTION`, `DELIVERY`), zoom controls, and contextual 4-tab container inspector.
3. **Compact High-Density Telemetry Rail:** Replaces repetitive oversized cards with an information-dense telemetry strip (Backlog Queue, Active Leases, Fleet Health, Outbox Delivery, Poison DLQ) with inline progress sparkbars and honest offline status.
4. **Deterministic Scenario Explorer:** Opt-in simulation engine executing 5 realistic architectural scenarios with persistent safety banners, authentic data fixtures, and zero backend mutations.

---

## 2. Information Architecture & Spatial Hierarchy

### 2.1 Mission Control (`OverviewPage.tsx`) Spatial Layout

```
+---------------------------------------------------------------------------------------------------+
| PLATFORM COMMAND HEADER: QUEUEFORGE COMMAND (V2 Intelligence | ACID Fenced | Provenance Badge)     |
+---------------------------------------------------------------------------------------------------+
| PERSISTENT SCENARIO BANNER (When Simulation Active: Invariants, Conditions, Exit to Live)         |
+---------------------------------------------------------------------------------------------------+
| COMPACT TELEMETRY RAIL: [Backlog Queue] [Active Leases] [Fleet Health] [Outbox Delivery] [DLQ]   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
| PRIMARY TOPOLOGY WORKSPACE (Interactive SVG Canvas + Contextual Inspector 4-Tab Panel)           |
|                                                                                                   |
|  [ZONE 1: INGRESS]     [ZONE 2: EXECUTION]     [ZONE 3: PERSISTENCE]     [ZONE 4: DELIVERY]       |
|  - frontend (:8088)    - DRR Scheduler         - sender-db (PG 16)       - Outbox Dispatcher      |
|  - api-server (:8080)  - worker-1 (4 Threads)  - qf_jobs / leases        - payment-receiver       |
|                        - worker-2 (4 Threads)  - qf_outbox_events        - receiver-db (:5433)    |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
| OPERATOR INTELLIGENCE ENGINE (Distributed Invariant Verifier & Proactive Diagnostic Heuristics)   |
+---------------------------------------------------------------------------------------------------+
| OPERATIONAL WORKSPACES (7 Cols)                  | REAL SESSION OBSERVATION LEDGER (5 Cols)       |
| - Worker Fleet (SKIP LOCKED Fencing)             | - Bounded ring buffer (max 20 samples)         |
| - FairShare Scheduler (DRR Quantum Studio)       | - 3-second consecutive observation trends      |
| - Transactional Outbox (2PC Pipeline)            | - Zero memory leak guarantee                   |
| - Reliability & DLQ (Poison Isolation)           |                                                |
+---------------------------------------------------------------------------------------------------+
| EVIDENCE-DRIVEN OPERATIONAL ACTIVITY STREAM (Ledger Table with Status Filter & Detail Drawer)     |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Subsystem Domain Workspaces

### 3.1 FairShare Scheduler Studio (`FairSharePage.tsx`)
- **DRR Quantum Mechanics:** Visualizes $Q_i = w_i \times Q_{\text{base}}$ deficit credit accumulation and anti-hoarding zero resets.
- **Empirical Benchmark Callout:** Prominently highlights recorded contention benchmark results from Profile 3:
  - FIFO p50 wait: **11,868 ms** vs FairShare p50 wait: **1,210 ms** (89.8% reduction in quiet-tenant starvation).
  - Explicit disclosure of the **21.2% aggregate throughput trade-off** (89.6 jobs/s vs 70.6 jobs/s).
- **Interactive Multi-Tenant Simulator:** Step-by-step sweep execution with tenant deficit bar charts.

### 3.2 Distributed Worker Fleet (`WorkersPage.tsx`)
- **Heartbeat Freshness Decay:** Visualizes worker instance heartbeats against the 15-second stale threshold and 45-second dead worker boundary.
- **Concurrent Lease Fencing:** Inspects thread allocations (4 threads per JVM worker) and PostgreSQL advisory lock ownership.

### 3.3 Transactional Outbox Pipeline (`EventPipelinePage.tsx`)
- **7-Stage End-to-End Pipeline:** Interactive visual journey from order creation, atomic table commit, SKIP LOCKED poller claim, HTTP dispatch, downstream SHA-256 idempotency deduplication check, business effect commit, to delivery receipt acknowledgment.
- **Exponential Backoff Timeline:** Simulates 503 Service Unavailable retries ($2^n \times \text{delay}$) with full jitter.

### 3.4 Reliability & DLQ Quarantine (`DlqPage.tsx`)
- **Poison Isolation Lab:** Quarantines permanent poison jobs after 3 exhausted execution attempts.
- **Forensic Diagnostic Inspector:** Inspects structured error stacks (`DataCorruptionException`, `InvalidPayloadSchemaException`) and provides authenticated replay workflows.

---

## 4. Design Verification & Invariants

| Architectural Invariant | Enforcement Mechanism | Verification Status |
| :--- | :--- | :--- |
| **Strict Data Provenance** | Header and cards explicitly tag data origin (`LIVE_CONNECTED`, `LIVE_OFFLINE`, `SIMULATED_SCENARIO`). | **VERIFIED** |
| **Zero Mock Injection in Live Mode** | Live mode never returns fake zero or dummy data on TanStack error. | **VERIFIED** |
| **Deterministic Scenario Isolation** | Scenario engine runs client-side in `ScenarioContext` with 0 network mutations. | **VERIFIED** |
| **Memory-Bounded Observations** | Bounded ring buffer restricts telemetry samples to $\le 20$ elements. | **VERIFIED** |
| **High-Contrast Touch Targets** | Unlock Console button and key controls maintain $\ge 44 \times 44\text{px}$ touch targets. | **VERIFIED** |

---

*Authored by Antigravity Design & Architecture Team — Phase 13D.*
