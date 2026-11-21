# QueueForge V2 — Obsidian Command Design System Specification

**Document Version:** 1.0.0  
**Phase:** 13A — Obsidian Pulse Ultimate Control Plane Redesign  
**Status:** Canonical Design Token & UI Architecture Reference  
**Target Environment:** Mission-Critical Distributed Systems Control Plane  

---

## 1. Executive Design Philosophy

QueueForge V2 was architected as a high-throughput, ACID-compliant distributed job orchestrator featuring PostgreSQL 16 `FOR UPDATE SKIP LOCKED` lease claiming, multi-tenant Deficit Round-Robin (DRR) scheduling, and an at-least-once Transactional Outbox.

The **Obsidian Command Design System** establishes a world-class visual and interaction language tailored specifically for distributed systems operators, infrastructure architects, and technical hiring managers. Moving beyond conventional generic administrative templates, Obsidian Command combines:
1. **Information Density with Cognitive Clarity:** High-density telemetry matrices balanced by strict typographic hierarchy and deliberate negative space.
2. **Defensive Color Semantics:** High-contrast, WCAG 2.2 AA compliant status signals where color conveys deterministic operational invariants rather than decorative flair.
3. **Architectural Transparency:** Native visualization of distributed network boundaries, loopback protections, zero-port-exposure guarantees, and real-time lease expirations.
4. **Zero-Deception Observability:** Clear demarcation between live backend telemetry, bounded client session observation buffers, and educational simulation sandboxes.

---

## 2. Design Token Palette & Variables

The design system is implemented via CSS custom properties in `src/styles/tokens.css` with dynamic dark/light theme awareness and strict WCAG 2.2 AA contrast ratios ($> 4.5:1$ for normal text, $> 3:1$ for UI controls and graphical borders).

### 2.1 Core Dark Theme Surfaces & Accents

| Token Name | CSS Variable | Hex Value | Purpose / Role |
| :--- | :--- | :--- | :--- |
| **Command Void** | `--color-bg-base` | `#06080F` | Deepest root canvas; maximizes contrast for glows and SVG topology. |
| **Graphite Deep** | `--color-bg-deep` | `#0B0F19` | Surface for code viewers, nested panels, and terminal inspectors. |
| **Elevated Surface** | `--color-bg-elevated` | `#111625` | Card containers, sidebar background, and modal dialogs. |
| **Interactive Surface** | `--color-bg-interactive`| `#171E32` | Table hover states, inactive tabs, pill backgrounds. |
| **Hover Surface** | `--color-bg-hover` | `#1F2842` | Button hover, active dropdown selection, clickable list items. |
| **Border Subtle** | `--color-border-subtle` | `#1E293B` | Structural dividers, card borders, SVG interconnection traces. |
| **Border Interactive** | `--color-border-interactive`| `#334155` | Focused inputs, card hover borders, active tabs. |
| **Cyber Cyan** | `--color-cyan` | `#00F0FF` | Primary telemetry accent, healthy coordinators, system brand. |
| **Amethyst Purple** | `--color-amethyst` | `#A855F7` | FairShare DRR scheduler accent, multi-tenant weight indicators. |
| **Operational Emerald**| `--color-success` | `#10B981` | Completed jobs, healthy heartbeats, active worker nodes. |
| **Contention Amber** | `--color-warning` | `#F59E0B` | Stale worker heartbeats, degraded connectivity, simulation disclaimers. |
| **Poison Crimson** | `--color-danger` | `#F43F5E` | Dead-letter queue, unhandled exceptions, lease expirations. |

### 2.2 Semantic Tint & Glow Tokens

| Token Name | CSS Variable | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Cyan Glow** | `--color-cyan-glow` | `rgba(0, 240, 255, 0.25)` | Drop shadows for critical action buttons and active SVG nodes. |
| **Cyan Background** | `--color-cyan-bg` | `rgba(0, 240, 255, 0.08)` | Badges, status pills, and code callouts. |
| **Cyan Border** | `--color-cyan-border` | `rgba(0, 240, 255, 0.28)` | Metric card left accents and status badge borders. |
| **Amethyst Glow** | `--color-amethyst-glow`| `rgba(168, 85, 247, 0.25)` | DRR sweep progress and quantum calculation visual indicators. |
| **Amethyst Background**| `--color-amethyst-bg` | `rgba(168, 85, 247, 0.08)` | FairShare scheduler tenant cards. |
| **Success Glow** | `--color-success-glow` | `rgba(16, 185, 129, 0.25)` | Healthy worker pulse indicators. |
| **Danger Glow** | `--color-danger-glow` | `rgba(244, 63, 94, 0.30)` | Dead-letter queue isolation warnings and emergency replay modals. |

---

## 3. Typography Hierarchy & Font Stacks

Obsidian Command employs a dual-font typographic architecture:
- **Primary Sans Interface Font:** `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`  
  Used for navigation, headings, conceptual descriptions, and button labels.
- **Precision Monospace Telemetry Font:** `'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace`  
  Used for UUIDs, database timestamps, job IDs, thread IDs, queue metrics, DRR deficit formulas ($D_i \leftarrow D_i + Q \times W_i$), and container network ports.

### Typographic Scale

| Role | Font Size / Line Height | Tracking | Weight | Styling Classes |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | `20px / 28px` (`text-xl`) | `-0.025em` | Bold (`font-bold`) | `text-[var(--color-text-primary)] tracking-tight` |
| **Section Header** | `14px / 20px` (`text-sm`) | `-0.015em` | Semibold (`font-semibold`) | `text-[var(--color-text-primary)]` |
| **Category Overline**| `10px / 14px` (`text-[10px]`) | `+0.08em` | Bold (`font-mono font-bold`) | `uppercase text-[var(--color-text-muted)]` |
| **Telemetry Metric** | `24px / 32px` (`text-2xl`) | `-0.02em` | Bold (`font-mono font-bold`) | `text-[var(--color-text-primary)] tabular-nums` |
| **Table Body** | `12px / 18px` (`text-xs`) | Normal | Regular / Medium | `text-[var(--color-text-secondary)] font-sans` |
| **Code / UUID** | `11px / 16px` (`text-[11px]`) | Normal | Medium (`font-mono`) | `text-[var(--color-cyan)] bg-[var(--color-bg-deep)] px-1.5 py-0.5 rounded` |

---

## 4. UI Component Specifications

### 4.1 Spotlight Command Palette (`CommandPalette.tsx`)
- **Keybinding:** `Ctrl + K` or `Cmd + K` (with visible shortcut badge in header).
- **Architecture:** Modally rendered via React portal with backdrop blur (`backdrop-blur-md bg-black/60`).
- **Grouping:** 5 distinct operational sections:
  1. `NAVIGATION`: Direct jumping to all 9 control plane routes.
  2. `WORKLOADS`: Submit synthetic jobs, filter running leases.
  3. `RELIABILITY`: DLQ quarantine inspection, Transactional Outbox trigger.
  4. `OPERATIONS`: Observability trends, Prometheus metrics export.
  5. `SECURITY`: Operator key unlock, Public Demo mode toggle.
- **Interactions:** Keyboard navigation via Up/Down arrow keys, Enter to execute, Escape to dismiss, fuzzy substring matching.

### 4.2 Interactive 7-Service Topology (`SystemTopology.tsx`)
- **Rendering:** Responsive vector SVG with custom gradients, drop shadows, and animated data flows.
- **Nodes Rendered:**
  1. `frontend` (Nginx 1.27 Alpine edge proxy, port 8088 loopback)
  2. `api-server` (Spring Boot 3 Java 21 REST backend)
  3. `sender-db` (PostgreSQL 16 sender transactional database)
  4. `worker-1` (Background worker daemon executing DRR claims)
  5. `worker-2` (Concurrent worker daemon validating fencing tokens)
  6. `payment-receiver` (Simulated external payment gateway)
  7. `receiver-db` (PostgreSQL 16 receiver idempotency inbox)
- **Data Flow Traces:**
  - REST Ingress: Frontend $\rightarrow$ API Server (Emerald solid stroke)
  - JDBC Pool: API Server $\rightarrow$ Sender DB (Cyan dashed stroke)
  - Worker Claim: Worker 1 & 2 $\rightarrow$ Sender DB (`SKIP LOCKED` lease poll)
  - At-Least-Once Outbox: Workers $\rightarrow$ Payment Receiver (Purple dashed stroke)
  - Idempotency Inbox: Payment Receiver $\rightarrow$ Receiver DB (Emerald solid stroke)
- **Contextual Inspector:** Sliding drawer displaying container image, loopback bindings, network boundaries, zero-port-exposure proofs, and active health derivations.

### 4.3 Deterministic Operator Intelligence (`OperatorIntelligence.tsx`)
- **Diagnostic Philosophy:** Zero marketing buzzwords or fabricated "AI" claims. Strictly evaluates deterministic invariant rules against live TanStack Query telemetry cache:
  - *Heartbeat Age Rule:* Flags worker nodes with heartbeat age $> 15\text{s}$ as degraded.
  - *Poison Isolation Rule:* Inspects `deadLetterJobs > 0` and links directly to quarantined error traces.
  - *Congestion Rule:* Flags pending jobs backlog $> 100$ and suggests adding worker concurrency.
  - *Outbox Latency Rule:* Flags unprocessed outbox events $> 50$ and links to manual dispatch trigger.
  - *Database Invariant:* Asserts PostgreSQL `UP` status and connection pool readiness.
- **Actionability:** Every diagnostic alert card includes an immediate, single-click subsystem link (`View Dead-Letter Queue`, `Inspect Worker Fleet`, `Trigger Outbox`).

### 4.4 Deficit Round-Robin Educational Simulator (`DrrSimulator.tsx`)
- **Separation of Concerns:** Clearly framed in an amber educational warning banner (`⚠️ EDUCATIONAL SIMULATION — NOT LIVE SCHEDULER STATE`).
- **Mathematical Modeling:** Implements exact DRR deficit calculation:
  $$D_i \leftarrow D_i + Q \times W_i$$
  where $Q$ is configurable base quantum (default: 10 credits) and $W_i$ is tenant configured weight.
- **Visuals:** Step-by-step sweep visualization displaying deficit counter accumulations, job cost deductions (10 credits/job), and execution logs.

---

## 5. Accessibility (WCAG 2.2 AA Compliance)

1. **Color Contrast:**
   - Foreground text `#F8FAFC` on `#06080F`: Contrast ratio **18.7:1** (exceeds AAA requirement of 7:1).
   - Cyber cyan `#00F0FF` on `#0B0F19`: Contrast ratio **11.2:1** (exceeds AAA requirement).
   - Emerald `#10B981` on `#0B0F19`: Contrast ratio **6.8:1** (exceeds AA requirement of 4.5:1).
   - Crimson `#F43F5E` on `#0B0F19`: Contrast ratio **5.2:1** (exceeds AA requirement of 4.5:1).
2. **Focus Visibility:**
   - Universal outline ring `focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]`.
3. **Screen Reader Semantics:**
   - Native HTML5 elements (`<nav>`, `<header>`, `<main>`, `<table>`, `<button>`).
   - SVG elements tagged with `aria-hidden="true"` or contextual `role="img"`.
   - Modals and drawers implement `aria-modal="true"` and proper keyboard focus trapping.
