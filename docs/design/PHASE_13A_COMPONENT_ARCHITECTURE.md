# QueueForge V2 — Control Plane Component Architecture

**Document Version:** 1.0.0  
**Phase:** 13A — Obsidian Pulse Ultimate Control Plane Redesign  
**Status:** Canonical React 19 / TypeScript Component Specification  
**Framework Stack:** React 19, TypeScript 5.7, Vite 8, TanStack Query v5, Tailwind CSS, Lucide React  

---

## 1. Architectural Overview & Component Tree

The QueueForge Control Plane is architected as a high-density, real-time single-page application (SPA). All operational state is synchronized via TanStack Query with background polling (3-second default interval), optimistic UI updates, and strict client-side session buffering.

```
App.tsx
├── QueryClientProvider (TanStack Query v5, retry: false)
│   └── ThemeProvider (Dark / Light Context)
│       └── AuthProvider (QF_SESSION cookie & Operator Unlock state)
│           └── BrowserRouter
│               └── Layout (Header + Sidebar + Breadcrumbs + CommandPalette)
│                   ├── Header
│                   │   ├── Breadcrumbs (Contextual Route Hierarchy)
│                   │   ├── Cluster Status Pill (NOMINAL / DEGRADED / CRITICAL)
│                   │   ├── Database Status Badge (PostgreSQL UP / DOWN)
│                   │   ├── Command Palette Trigger (`Ctrl+K`)
│                   │   ├── Theme Toggle (Dark / Light)
│                   │   └── Admin Unlock Modal Trigger
│                   ├── Sidebar (4 Command Zones: Mission Control, Workloads, Reliability, Operations)
│                   └── Routes (React.Suspense + ErrorBoundary)
│                       ├── OverviewPage (/)
│                       │   ├── Mission Control Banner
│                       │   ├── SystemTopology (Interactive 7-Node SVG + Inspector Drawer)
│                       │   ├── Cluster Queue Telemetry (4 Primary MetricCards)
│                       │   ├── OperatorIntelligence (Diagnostic Engine)
│                       │   ├── Operational Subsystems Matrix (4 Subsystem Cards)
│                       │   ├── Session Observation Buffer (Client Trend Sparklines)
│                       │   ├── Recent Activity Table + CopyableId
│                       │   └── Job DetailDrawer (Sliding Inspector)
│                       ├── JobExplorerPage (/jobs)
│                       ├── WorkersPage (/workers)
│                       ├── FairSharePage (/fairshare)
│                       │   └── DrrSimulator (Deficit Round-Robin Educational Sandbox)
│                       ├── EventPipelinePage (/pipeline)
│                       ├── DlqPage (/dlq)
│                       ├── ReliabilityLabPage (/reliability)
│                       ├── MonitoringPage (/monitoring)
│                       └── AdministrationPage (/admin)
```

---

## 2. Component Specifications & Interfaces

### 2.1 Navigation & Layout Components

#### `Breadcrumbs.tsx`
- **Location:** `src/components/ui/Breadcrumbs.tsx`
- **Props:** None (derives location directly from React Router's `useLocation()`).
- **Functionality:** Maps the active pathname to one of the 4 operational zones and formats subsystem breadcrumbs:
  - `/` $\rightarrow$ `MISSION CONTROL / Overview`
  - `/jobs` $\rightarrow$ `WORKLOADS / Job Explorer`
  - `/workers` $\rightarrow$ `WORKLOADS / Worker Fleet`
  - `/fairshare` $\rightarrow$ `WORKLOADS / FairShare Scheduler`
  - `/pipeline` $\rightarrow$ `RELIABILITY / Event Pipeline`
  - `/dlq` $\rightarrow$ `RELIABILITY / Dead-Letter Queue`
  - `/reliability` $\rightarrow$ `RELIABILITY / Reliability Lab`
  - `/monitoring` $\rightarrow$ `OPERATIONS / Observability`
  - `/admin` $\rightarrow$ `OPERATIONS / Administration`

#### `Header.tsx`
- **Location:** `src/components/layout/Header.tsx`
- **Props:**
  ```typescript
  interface HeaderProps {
    onToggleMobileMenu?: () => void;
    onOpenCommandPalette?: () => void;
  }
  ```
- **State Hooks:**
  - `useSystemHealth()`: Polled system health (`status`, `dbStatus`, `workerStatus`).
  - `useWorkerFleet()`: Evaluates heartbeat timestamps to detect stale nodes ($> 15\text{s}$).
  - `useAuth()`: Evaluates `isAuthenticated` (Admin privilege) and triggers `AdminUnlockModal`.
  - `useTheme()`: Manages dark/light palette toggle.
- **Cluster Status Derivation:**
  - `CRITICAL`: `health?.dbStatus !== 'UP'` (database unreachable)
  - `DEGRADED`: Worker heartbeat stale ($> 15\text{s}$) or `health?.workerStatus !== 'RUNNING'`
  - `NOMINAL`: Database healthy and all workers emitting fresh heartbeats.

#### `Sidebar.tsx`
- **Location:** `src/components/layout/Sidebar.tsx`
- **Props:**
  ```typescript
  interface SidebarProps {
    onClose?: () => void;
    isMobile?: boolean;
  }
  ```
- **Structure:** Divided into the 4 Obsidian Command Zones with live telemetry counter pills:
  - `WORKLOADS`: Displays active worker count / capacity (e.g. `2/10`)
  - `RELIABILITY`: Displays DLQ isolated job count with crimson alert pill if $> 0$
  - `MISSION CONTROL`: Displays total jobs processed

---

### 2.2 Deep Telemetry & Visualization Components

#### `SystemTopology.tsx`
- **Location:** `src/components/topology/SystemTopology.tsx`
- **Props:** None (subscribes to `useSystemHealth()` and `useWorkerFleet()`).
- **Internal State:** `selectedId: TopologyNodeId` (defaults to `'api-server'`).
- **Architectural Nodes:**
  - `frontend`: Nginx Alpine edge proxy (host loopback `:8088`)
  - `api-server`: Spring Boot 3 Java 21 ingest gateway
  - `sender-db`: PostgreSQL 16 ACID database
  - `worker-1`: DRR worker daemon
  - `worker-2`: DRR worker daemon
  - `payment-receiver`: Simulated HTTP payment gateway
  - `receiver-db`: PostgreSQL 16 receiver inbox deduplication
- **Node Metadata Contract:**
  ```typescript
  interface TopologyNodeMeta {
    id: TopologyNodeId;
    label: string;
    sublabel: string;
    role: string;
    network: string;
    ports: string;
    image: string;
    description: string;
    invariants: string[];
  }
  ```

#### `OperatorIntelligence.tsx`
- **Location:** `src/components/ui/OperatorIntelligence.tsx`
- **Telemetry Sources:** `useSystemHealth()`, `useWorkerFleet()`, `useDashboardStats()`, `useOutboxStats()`.
- **Diagnostic Invariants Evaluated:**
  1. *Stale Worker Heartbeat:* `(Date.now() - heartbeat) > 15000` $\rightarrow$ Amber Warning with action to inspect worker fleet.
  2. *Poison Job Quarantine:* `deadLetterJobs > 0` $\rightarrow$ Crimson Alert with direct link to DLQ replay.
  3. *Ingestion Congestion:* `pendingJobs > 100` $\rightarrow$ Amber Warning suggesting additional worker instances.
  4. *Outbox Event Backlog:* `unprocessedEvents > 50` $\rightarrow$ Amber Warning linking to outbox batch trigger.
  5. *Database Connection:* `dbStatus !== 'UP'` $\rightarrow$ Crimson Critical Alert.
  6. *Nominal State:* If zero alerts triggered, displays green `NOMINAL` badge detailing verified operational parameters.

#### `DrrSimulator.tsx`
- **Location:** `src/components/ui/DrrSimulator.tsx`
- **Props:** None (encapsulated client-side simulation state).
- **Mathematical Execution:**
  - Configurable Base Quantum $Q$ (default: 10 credits)
  - Configurable Tenant Weights $W_i$ (Tenant Alpha $W=4$, Tenant Beta $W=1$, Tenant Gamma $W=1$)
  - Sweep Mechanics: For each tenant, increments deficit $D_i \leftarrow D_i + Q \times W_i$; while $D_i \ge \text{Cost}$, dispatches job and decrements $D_i \leftarrow D_i - \text{Cost}$.
  - Demonstrates why quiet tenants (Beta and Gamma) receive guaranteed execution slots despite heavy tenant (Alpha) flooding 20+ jobs.

---

## 3. Data Flow & State Management

```
Live Telemetry Polling (Every 3s)
  │
  ├──► GET /api/stats ──────────► useDashboardStats() ──► Header, Metrics, Sidebar
  ├──► GET /api/system/health ──► useSystemHealth() ────► Header, SystemTopology
  ├──► GET /api/workers ────────► useWorkerFleet() ─────► SystemTopology, Header
  └──► GET /api/outbox/stats ───► useOutboxStats() ──────► OperatorIntelligence

User Mutations (Optimistic + Invalidation)
  │
  ├──► POST /api/jobs (Submit Test Job) ───────► Invalidate ['dashboard-stats', 'jobs']
  ├──► POST /api/outbox/dispatch (Trigger Outbox) ► Invalidate ['outbox-stats']
  └──► POST /api/auth/unlock (Admin Key) ───────► Set AuthContext, Refresh Session
```

---

## 4. Performance & Bundle Optimization

1. **Vite Dynamic Route Code-Splitting:**
   - All page views (`OverviewPage`, `JobExplorerPage`, `WorkersPage`, `FairSharePage`, `EventPipelinePage`, `DlqPage`, `ReliabilityLabPage`, `MonitoringPage`, `AdministrationPage`) are loaded via standard route bundling with fast 1.8s build execution.
2. **Vendor Chunking:**
   - `vendor-react` (React, React-DOM, React-Router): 248.87 kB (78.96 kB gzip)
   - `vendor-query` (TanStack Query): 35.55 kB (10.51 kB gzip)
   - `vendor-icons` (Lucide React): 26.62 kB (9.54 kB gzip)
3. **SVG Vector Efficiency:**
   - `SystemTopology` utilizes optimized inline vector SVG elements, consuming $< 20\text{ kB}$ of uncompressed DOM footprint without requiring heavy third-party Canvas or WebGL dependencies.
