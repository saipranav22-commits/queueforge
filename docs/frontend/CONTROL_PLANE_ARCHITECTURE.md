# QueueForge Control Plane Architecture

## 1. Overview & Vision
The **QueueForge Control Plane** provides an enterprise-grade operational interface for managing, inspecting, and governing a high-throughput, lease-fenced distributed queue cluster. 

Rather than serving as a passive metrics dashboard, the Control Plane acts as a **Mission Control Console** where operators can:
- Observe cluster-wide queue lifecycle transitions in real-time.
- Monitor multi-worker fleet attribution across independent nodes (`worker-v2-node-1`, `worker-v2-node-2`).
- Inspect and adjust FairShare multi-tenant quotas and Deficit Round-Robin (DRR) weights.
- Trigger and observe Transactional Outbox event relays to downstream payment services.
- Audit dead-letter queue (DLQ) incidents and initiate idempotent replays.

---

## 2. Distributed State Management & Data Flow

```
   ┌────────────────────────────────────────────────────────┐
   │                   Browser / Client                     │
   │  ┌───────────────────────┐  ┌───────────────────────┐  │
   │  │  Mission Control UI   │  │ FairShare / Pipeline  │  │
   │  └───────────┬───────────┘  └───────────┬───────────┘  │
   │              │                          │              │
   │              ▼                          ▼              │
   │      TanStack React Query Cache (Automatic Deduplication) │
   └──────────────────────────────┬─────────────────────────┘
                                  │ HTTP / JSON
                                  ▼
   ┌────────────────────────────────────────────────────────┐
   │                 QueueForge API Gateway                 │
   │       (/api/v1/dashboard/stats, /system/health, etc)   │
   └──────────────┬──────────────────────────┬──────────────┘
                  │                          │
                  ▼                          ▼
   ┌──────────────────────────────┐  ┌──────────────────────┐
   │     PostgreSQL Database      │  │ Simulated Receiver   │
   │   (SKIP LOCKED Lease Queue)  │  │   (Durable Port 8085)│
   └──────────────────────────────┘  └──────────────────────┘
```

### A. Reactive Polling & Cache Invalidation
- **Live Metric Synchronization:** Primary stats (`/dashboard/stats`), system health (`/system/health`), and metrics summaries (`/system/metrics-summary`) poll at optimized intervals (3–5 seconds).
- **Targeted Cache Invalidation:** Mutation actions (e.g., job creation, tenant provisioning, outbox manual relay, DLQ replay) selectively invalidate only affected cache keys using `useQueryClient().invalidateQueries(...)`, preventing full-page re-renders.
- **Backoff & Idle Optimization:** When browser tabs are out of focus or jobs reach terminal states (`COMPLETED`, `DEAD_LETTER`), polling frequency is dynamically attenuated to conserve CPU and network resources.

---

## 3. Layout Architecture & Component Hierarchy

### A. Persistent Navigation Shell
- **AppLayout:** Coordinates the responsive viewports, managing persistent desktop sidebars and mobile sliding overlays.
- **Sidebar:** Houses the 8 core operational navigation destinations:
  1. Mission Control (`/`)
  2. Job Explorer (`/jobs`)
  3. Worker Fleet (`/workers`)
  4. FairShare Multi-Tenant (`/fairshare`)
  5. Event Pipeline (`/pipeline`)
  6. Reliability Lab (`/dlq`)
  7. Observability (`/monitoring`)
  8. Administration (`/admin`)
- **Header:** Features dynamic breadcrumbs, cluster topology badges (`V2 CLUSTER • DISTRIBUTED`), live database/worker health pills, global theme toggle, and the `Ctrl+K` Command Palette activator.

### B. Slide-Over Detail Drawer
- The `DetailDrawer` component enables deep inspection of job payloads, failure stacktraces, tenant affiliations, and execution logs directly within the context of the active page, avoiding disruptive page navigations.
- Keyboard accessible with `Escape` dismiss and full focus trapping.

### C. Global Command Palette (`Ctrl+K` / `⌘K`)
- Accessible anywhere in the application.
- Allows operators to instantly search commands, jump to sub-consoles, trigger admin unlock, or filter by operational domain.

---

## 4. Security & Administrative Boundaries

### A. Separation of Concerns
1. **Read-Only Telemetry:** Open endpoints (`/dashboard/stats`, `/system/health`, `/jobs`) allow unauthenticated observers and monitoring systems to inspect cluster health safely.
2. **State-Changing Mutations:** All administrative endpoints (`/admin/*`) require:
   - Authenticated session cookie (`JSESSIONID`).
   - Anti-CSRF protection via custom `X-CSRF-Token` headers.
   - Non-interactive operations (e.g., Worker-to-Receiver payment relays) require internal cryptographic `X-Service-Key` verification.

### B. Admin Unlock Modal
- When an operator initiates an administrative action in read-only mode, the `AdminUnlockModal` is seamlessly summoned to prompt for credentials without losing page state.

---

## 5. Architectural Invariants
- **Zero Mock Telemetry:** No synthetic random numbers or artificial mock timers. All displayed statistics directly bind to PostgreSQL cluster state.
- **Strict D:/E: Workspace Policy:** All build caches, logs, and compiled assets strictly reside on local fast storage, preserving operating system isolation.
