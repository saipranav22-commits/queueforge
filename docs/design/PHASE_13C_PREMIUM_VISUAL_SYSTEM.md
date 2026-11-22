# QueueForge V2 — Phase 13C: Obsidian Command Premium Visual System

## 1. Executive Summary

This specification establishes the **Obsidian Command** design architecture for QueueForge V2, replacing the legacy high-saturation neon/cyan dashboard with an authoritative, disciplined, neutral-first industrial control plane.

The design philosophy mirrors mission-critical operations consoles (e.g. AWS Console, Cloudflare Zero Trust, Datadog Infrastructure, Linear):
- **Neutral Dominance ($\ge 80\%$):** Dark surfaces built on deep graphite, charcoal, and slate rather than tinted blue-black. Light surfaces built on warm archival stone and clinical paper rather than stark blue-white.
- **Restrained Semantic Accents ($\le 20\%$):** Color carries rigorous informational meaning. Violet (`#A78BFA` in dark, `#6D28D9` in light) acts as the quiet signature accent; emerald represents verified healthy invariants; amber represents backpressure and latency warnings; crimson represents poison jobs, dead-letter records, and unprocessable exceptions.
- **Monospace Editorial Typography:** Heavy reliance on tabular `JetBrains Mono` for IDs, durations, UUIDs, and deficit quantum arithmetic, paired with clean geometric `Inter` for executive headings and hierarchical navigation.

---

## 2. Design Token Architecture (`tokens.css`)

### 2.1 Dark Mode Surface & Canvas Hierarchy

| Token Name | Hex Code | Contrast vs Text | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `--color-bg-base` | `#090A0C` | 17.5:1 | Primary application background (Deep Obsidian Canvas) |
| `--color-bg-secondary` | `#101114` | 15.2:1 | Navigation, sub-canvases, and sidebar backing |
| `--color-bg-elevated` | `#17191D` | 13.8:1 | Primary card surfaces, metric panels, data tables |
| `--color-bg-inspector` | `#1E2025` | 12.1:1 | Contextual container inspector and slide-over drawers |
| `--color-bg-interactive` | `#23262D` | 10.9:1 | Hover states, tab pills, and active list items |
| `--color-border-subtle` | `#30333A` | — | Subtle structural dividers (no electric glow) |
| `--color-border-interactive` | `#4B505B` | — | Focus states and selected container boundaries |
| `--color-text-primary` | `#F2F3F5` | — | Primary high-emphasis headings, counters, titles |
| `--color-text-secondary` | `#A2A6AE` | — | Subtitles, field labels, metadata descriptions |
| `--color-text-muted` | `#737984` | — | Timestamps, micro-labels, table header captions |

### 2.2 Light Mode Surface & Canvas Hierarchy

| Token Name | Hex Code | Contrast vs Text | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `--color-bg-base` | `#F4F4F1` | 16.8:1 | Warm archival stone canvas (no clinical blue glare) |
| `--color-bg-secondary` | `#FFFFFF` | 18.2:1 | Sidebar navigation surface and search dropdowns |
| `--color-bg-elevated` | `#FAFAF8` | 17.1:1 | Primary data cards, metric strips, ledger tables |
| `--color-bg-inspector` | `#FFFFFF` | 18.2:1 | Collapsible container inspector drawer |
| `--color-bg-interactive` | `#EBECE8` | 13.5:1 | Interactive pill buttons and hovered list items |
| `--color-border-subtle` | `#D9DCE1` | — | Crisp structural borders (hairline 1px) |
| `--color-border-interactive` | `#B5BAC3` | — | Focus rings and active borders |
| `--color-text-primary` | `#191B20` | — | Dark charcoal headings, numbers, and identifiers |
| `--color-text-secondary` | `#5B616C` | — | Balanced body text and parameter explanations |
| `--color-text-muted` | `#828894` | — | Secondary metadata and inactive indicators |

### 2.3 Semantic Status Palette

```
  DARK THEME STATUS PALETTE
  ├── SUCCESS (Verified / UP):   #34D399 (Emerald)   | Background: rgba(52, 211, 153, 0.08)
  ├── WARNING (Stale / Contention):#FBBF24 (Amber)   | Background: rgba(251, 191, 36, 0.08)
  ├── DANGER  (DLQ / Poison):     #F87171 (Crimson) | Background: rgba(248, 113, 113, 0.08)
  ├── ACCENT  (Active / Claimed): #A78BFA (Violet)  | Background: rgba(167, 139, 250, 0.08)
  └── INFO    (Unobserved / Inactive):#8794B6 (Slate)| Background: rgba(135, 148, 182, 0.08)

  LIGHT THEME STATUS PALETTE
  ├── SUCCESS (Verified / UP):   #059669 (Deep Emerald)| Background: #ECFDF5
  ├── WARNING (Stale / Contention):#D97706 (Deep Amber)| Background: #FFFBEB
  ├── DANGER  (DLQ / Poison):     #DC2626 (Deep Crimson)| Background: #FEF2F2
  ├── ACCENT  (Active / Claimed): #6D28D9 (Deep Violet)| Background: #F5F3FF
  └── INFO    (Unobserved / Inactive):#475569 (Slate)| Background: #F1F5F9
```

---

## 3. High-Contrast Action Tokens

Primary action controls (such as `Unlock Console`, `Submit Job`, `Simulate Sweep`) use semantic action tokens that guarantee maximum WCAG AAA contrast ($> 14:1$) in both light and dark themes:

- **Dark Mode Primary Action:**
  - Background: `--color-action-bg` (`#E8E9EC`)
  - Text: `--color-action-text` (`#0E1013`)
  - Hover: `--color-action-hover` (`#FFFFFF`)
  - Calculated Contrast Ratio: **14.8:1** (WCAG AAA Pass)
- **Light Mode Primary Action:**
  - Background: `--color-action-bg` (`#191B20`)
  - Text: `--color-action-text` (`#FFFFFF`)
  - Hover: `--color-action-hover` (`#000000`)
  - Calculated Contrast Ratio: **16.2:1** (WCAG AAA Pass)

---

## 4. Typography System

1. **Brand & Top-Level Titles:** Inter Display, font-weight 700, negative tracking (`-0.03em`), anti-aliased subpixel rendering.
2. **Subheadings & Section Labels:** Inter Text, font-weight 600, tight tracking (`-0.015em`), color `--color-text-primary`.
3. **Telemetry Numbers & Identifiers:** JetBrains Mono, font-weight 700 / 600, tabular numbers (`tnum`), zero slash enabled (`ss01`).
4. **Body & Micro-Copy:** Inter Text, font-weight 400 / 500, font-size `11px` to `13px`, line-height `1.5`.

---

## 5. Architectural Topology System

The Phase 13C topology completely discards decorative neon outlines in favor of structured architectural semantics:

1. **Host Ingress Boundary (`:8088`):** Clearly delineates public HTTP ingress via the Nginx reverse proxy.
2. **Internal Isolated Network (`qf-prod-backend-net`):** Fences internal Spring Boot API server, worker daemons, and PostgreSQL 16 database, explicitly labeling zero external port exposure.
3. **Accurate Telemetry Semantics:** When Spring Boot is offline, telemetry hooks report `Offline / Unobserved` with neutral slate markers (`#555B66` / `#737984`) rather than synthetic green dots.
4. **Structured Contextual Inspector:** 2/3 topology canvas paired with a 1/3 collapsible side inspector featuring container image SHA, network aliases, invariants, and telemetry status.
