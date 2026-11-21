# QueueForge V2 — API Feasibility & Backend Alignment Matrix

**Document Version:** 1.0.0  
**Phase:** 13A — Obsidian Pulse Ultimate Control Plane Redesign  
**Status:** Invariant Backend Contract Audit & Feasibility Verification  
**Principle:** 100% Client-Side Visualization without Backend Modification  

---

## 1. Executive Feasibility Summary

During Phase 13A, the Obsidian Command Control Plane was designed under strict architectural constraints:
1. **Zero Java Backend Changes:** Backend Java Spring Boot code, JPA entities, Flyway migrations, and REST controllers were left 100% untouched.
2. **Zero Schema Alterations:** PostgreSQL schemas (`sender_db` and `receiver_db`) remained unmodified.
3. **Strict Contract Alignment:** Every single UI metric, chart, status indicator, and diagnostic rule maps directly to existing, tested Spring Boot REST endpoints.
4. **Feasibility Classification:** Every visualized feature is categorized according to the four-tier architectural matrix:
   - **Category A (Direct API):** Data directly served by an existing backend REST endpoint.
   - **Category B (Derived Telemetry):** Data mathematically or logically derived on the client from Category A endpoints without inventing non-existent states.
   - **Category C (Educational Simulation):** Purely client-side educational interactive modeling, prominently badged with disclaimers.
   - **Category D (Architectural Invariant / Documentation):** Static architectural facts, port bindings, or container topologies verified from Docker compose specifications.

---

## 2. Comprehensive Endpoint Feasibility Matrix

| UI Component / Visual Feature | Category | Backend Endpoint / Source | Response Field / Logic | Feasibility Verdict |
| :--- | :---: | :--- | :--- | :--- |
| **Pending Queue KPI** | **A** | `GET /api/stats` | `stats.pendingJobs` | Fully Feasible (Active) |
| **Active Running KPI** | **A** | `GET /api/stats` | `stats.runningJobs` | Fully Feasible (Active) |
| **Completed Total KPI** | **A** | `GET /api/stats` | `stats.completedJobs` / `stats.completedTotal` | Fully Feasible (Active) |
| **Dead-Letter Queue KPI** | **A** | `GET /api/stats` | `stats.deadLetterJobs` | Fully Feasible (Active) |
| **Cluster Status Pill** | **B** | `GET /api/system/health`, `GET /api/workers` | `health.dbStatus === 'UP' && max(heartbeatAge) < 15s` | Fully Feasible (Active) |
| **Database Status Badge** | **A** | `GET /api/system/health` | `health.dbStatus` (`UP` / `DOWN`) | Fully Feasible (Active) |
| **Worker Capacity Ratio** | **A** | `GET /api/stats` | `stats.activeWorkers` / `stats.workerCapacity` | Fully Feasible (Active) |
| **Worker Node Heartbeats** | **A** | `GET /api/workers` | `worker.lastHeartbeat`, `worker.status` | Fully Feasible (Active) |
| **Job Execution Ledger** | **A** | `GET /api/jobs` | `jobs.content[]`, `job.jobId`, `job.status` | Fully Feasible (Active) |
| **Job Payload & Error Trace**| **A** | `GET /api/jobs/{id}` | `job.payload`, `job.lastErrorMessage` | Fully Feasible (Active) |
| **Synthetic Job Creation** | **A** | `POST /api/jobs` | `{ jobType, tenantId, payload, priority }` | Fully Feasible (Active) |
| **Transactional Outbox Backlog**| **A** | `GET /api/outbox/stats` | `outbox.unprocessedCount`, `outbox.failedCount` | Fully Feasible (Active) |
| **Manual Outbox Trigger** | **A** | `POST /api/outbox/dispatch` | `{ batchSize: 25 }` (Authenticated) | Fully Feasible (Active) |
| **DLQ Poison Inspection** | **A** | `GET /api/dlq` | `dlqJobs.content[]`, `failureCategory` | Fully Feasible (Active) |
| **DLQ Authenticated Replay** | **A** | `POST /api/dlq/{id}/replay` | Requires `QF_SESSION` admin cookie | Fully Feasible (Active) |
| **Tenant Registry & Weights** | **A** | `GET /api/tenants` | `tenants[].id`, `tenants[].weight`, `tenants[].bucketTokens` | Fully Feasible (Active) |
| **Empirical DRR Benchmarks** | **D** | Profile 3 Performance Report | `11,868 ms` (FIFO) vs `1,210 ms` (DRR) | Fully Feasible (Static Documented) |
| **DRR Step-Through Simulator**| **C** | Pure Client-side Math | $D_i \leftarrow D_i + Q \times W_i$ with educational disclaimer | Fully Feasible (Sandboxed) |
| **Interactive 7-Node Topology**| **D** | Verified Docker Compose Spec | Architecture roles, container names, loopback :8088 | Fully Feasible (Static Structural) |
| **Container Node Health** | **B** | `GET /api/system/health`, `GET /api/workers` | Dynamically maps live health to SVG node markers | Fully Feasible (Active) |
| **Operator Intelligence Rules**| **B** | Telemetry Invariants | Heartbeat freshness, poison counts, outbox backlog | Fully Feasible (Deterministic) |
| **Session Observation Buffer** | **B** | Consecutive 3s TanStack Polls | Client-side bounded ring buffer (labeled session-only)| Fully Feasible (Non-fabricated) |

---

## 3. Security & Access Boundary Feasibility

### 3.1 Authentication & Operator Unlock
- **Endpoint:** `POST /api/auth/unlock`
- **Payload:** `{ operatorKey: string }`
- **Contract:** If operator key matches backend configuration (`dev-operator-key`), backend sets HTTP-only `QF_SESSION` cookie with `SameSite=Strict`.
- **Frontend Behavior:** Handled securely via `AuthProvider` and `AdminUnlockModal`.

### 3.2 Public Demo Payload Redaction
- **Invariant:** When running in unauthenticated Public Demo mode, payload previews and error traces are automatically redacted by the backend or masked on the client to prevent sensitive data exposure.
- **Contract Alignment:** All detail drawers gracefully accommodate `[REDACTED IN DEMO MODE]` responses without crashing JSON formatters.

---

## 4. Architectural Defensibility Verdict

The Obsidian Command redesign adheres 100% to production distributed systems engineering ethics:
1. **Zero Simulated Telemetry in Production Views:** No fabricated websocket feeds, no fake graphs, no deceptive "live throughput" when backend is idle.
2. **Explicit Labeling:** Every synthetic or client-side calculation is explicitly labeled (`Observed in this browser session`, `Educational Simulator`).
3. **Verifiable Consistency:** Every component was validated against the actual running Spring Boot DTO contracts defined in `types/`.
