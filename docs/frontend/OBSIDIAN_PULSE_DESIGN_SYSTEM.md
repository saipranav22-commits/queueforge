# Obsidian Pulse Design System Specification

## 1. Design Philosophy
**Obsidian Pulse** is an enterprise visual language engineered specifically for distributed systems, mission-critical infrastructure, and high-density operational telemetry. 

### Core Tenets:
1. **Calm Precision:** High-contrast, dark-first foundation with deliberate muted surfaces that minimize operator fatigue during extended monitoring sessions.
2. **Restrained Semantics:** Colors carry strict operational meaning. Red (Laser Crimson) is reserved exclusively for unhandled exceptions, dead-letter failures, or destructive operations.
3. **Information Hierarchy:** Monospace typography anchors operational identifiers (UUIDs, cluster nodes, metrics, timestamps), while clean sans-serif typography powers structural labels and prose.
4. **Cohesive Dual-Mode Support:** Native, mathematically calibrated light mode for high-ambient lighting environments, paired with the signature deep obsidian dark mode.

---

## 2. Color Palette & Token Definitions

### A. Foundations (Dark Signature)
| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--qf-obsidian` | `#08090E` | Main application background (Base canvas) |
| `--qf-graphite` | `#11131B` | Sidebar, deep containers, table headers |
| `--qf-surface-elevated` | `#171922` | Cards, panels, modal dialogs |
| `--qf-surface-interactive` | `#202330` | Hover states, active row selections |
| `--qf-surface-hover` | `#262A3B` | Interactive hover accent |
| `--qf-border-subtle` | `#2A2D3B` | Card outlines, dividers, table borders |
| `--qf-border-strong` | `#3B4054` | Focused controls, active element boundaries |

### B. Typography & Contrast
| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--qf-text-frost` | `#F2F4FA` | Primary headings, KPI values, high-contrast text |
| `--qf-text-chrome` | `#BBC3D1` | Secondary body text, descriptions, table values |
| `--qf-text-muted` | `#9099AC` | Form labels, metadata captions, disabled items |

### C. Brand & Operational Accents
| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--qf-amethyst` | `#9B70F5` | Royal Amethyst: Brand primary, active navigation, focus rings, primary action buttons |
| `--qf-cyan` | `#35D8F5` | Electric Cyan: Active running jobs, outbox relays, high-speed operational highlights |

### D. Semantic Status Colors
| Semantic State | Base Color | Hex Code | Application |
| :--- | :--- | :--- | :--- |
| **Healthy / Success** | Mint Emerald | `#47D6AD` | Completed jobs, UP database, healthy coordinator |
| **Active / Running** | Electric Cyan | `#35D8F5` | Leased jobs currently executing on worker threads |
| **Warning / Degraded** | Amber Gold | `#F4B860` | Pending queue buildup, retries, quota limits |
| **Critical / Incident** | Laser Crimson | `#F04455` | Dead-letter queue entries, panic logs, failures |

---

## 3. Light Mode Specification

The light mode palette preserves semantic hierarchy while ensuring WCAG AAA readability:
- **Base Canvas:** `#F5F7FB`
- **Surface Elevated:** `#FFFFFF`
- **Surface Interactive:** `#F0F2F8`
- **Subtle Borders:** `#D8DEEC`
- **Primary Text:** `#0B0E17`
- **Secondary Text:** `#364052`
- **Amethyst (Light):** `#7E4EE6`
- **Cyan (Light):** `#0796B4`
- **Emerald (Light):** `#16A374`
- **Crimson (Light):** `#E02B3D`

---

## 4. Reusable UI Component Library

### 1. `StatusIndicator`
- Displays a status dot with a gentle CSS pulse ring and accompanying label.
- Supports `healthy`, `warning`, `critical`, `active`, and `neutral`.

### 2. `Badge`
- Compact indicator tag for job lifecycle statuses (`PENDING`, `RUNNING`, `COMPLETED`, `DEAD_LETTER`).
- Subtly tinted background with a crisp border matching its semantic color.

### 3. `CopyableId`
- Formats long UUIDs (`12345678-abcd...`) into readable monospace prefixes.
- One-click copy with clipboard integration, checkmark feedback, and tooltip.

### 4. `TenantQuotaProgress`
- Multi-tenant concurrency bar visualizer.
- Computes active utilization percentage against hard quota limits.
- Automatically transitions from Amethyst -> Cyan -> Amber warning when approaching quota ceiling.
- Displays DRR weight multiplier and Deficit Round-Robin counter.

### 5. `DetailDrawer`
- Contextual slide-over drawer sliding smoothly from the right viewport edge.
- Backed by an accessible backdrop blur with Escape-key dismiss.

### 6. `CommandPalette`
- Spotlight-style command modal triggered via `Cmd+K` / `Ctrl+K`.
- Instant keyboard navigation to any page or operational action.
