# QUEUEFORGE COMMAND — PHASE 13E DESIGN SYSTEM SPECIFICATION
## "MIDNIGHT SPECTRUM" ULTRA-PREMIUM VISUAL ART DIRECTION

---

### Executive Summary

QueueForge Command Phase 13E delivers a definitive visual art direction transformation called **MIDNIGHT SPECTRUM**. This design system explicitly addresses and resolves the owner's dissatisfaction with prior iterations:
1. **Rejection of Cyan/Teal-Heavy Cyberpunk:** Replaced fluorescent neon teal with purposeful, dignified Royal Violet and Electric Iris primary accents.
2. **Rejection of Flat Charcoal/Grey Monotony:** Replaced washed-out, flat grey panels with layered, elevated indigo/navy surfaces and ambient radial lighting gradients.
3. **Rejection of Ineffective Purple:** Replaced faint or muddy purple with an art-directed spectrum where Royal Violet (`#7955F6`) anchors brand interactions, Electric Iris (`#A78BFA`) provides high-legibility highlights, Champagne Gold (`#F2B85B`) flags warnings and DRR queue backlog, Emerald (`#42D3A2`) denotes nominal health, Coral Rose (`#FF5678`) isolates poison DLQ faults, and Icy Blue (`#8CB8FF`) traces at-least-once outbox events.

---

### Color Architecture & Token Spectrum

#### 1. Foundation Canvases & Surfaces (Dark Mode: Midnight Spectrum)
* **Canvas Base (`--color-bg-base`):** `#0B0B18` (Midnight Ink) — Deep, luminous void eliminating flat muddy black.
* **Header / Deep Nav (`--color-bg-deep`):** `#121126` (Deep Imperial Navy) — Rich backdrop with 95% opacity and backdrop-filter blur.
* **Layered Structural Card (`--color-bg-surface`):** `#19182F` (Deep Indigo Surface) — Angled multi-stop elevation.
* **Elevated Controls & Pills (`--color-bg-elevated`):** `#24213B` (Elevated Plum Graphite) — Tactile card elevation.
* **Interactive Hover Surface (`--color-bg-interactive`):** `#322D52` — Distinct feedback on cursor hover.

#### 2. Borders & Spatial Hierarchy
* **Subtle Structural Border (`--color-border-subtle`):** `#393451` — Soft lavender-tinted 1px perimeter preventing harsh contrast cuts.
* **Standard Active Border (`--color-border-standard`):** `#524B73` — Defined container frame.
* **Interactive / Focus Border (`--color-border-interactive`):** `#6A6293` — Responsive focus ring.

#### 3. Primary & Secondary Accents (Purpose-Driven Spectrum)
* **Primary Brand Action (`--color-action-bg` / `--color-accent`):** `#7955F6` (Royal Violet) — High-contrast, dignified primary button and active indicator.
* **Accent Highlight (`--color-accent-iris`):** `#A78BFA` (Electric Iris) — Clean, legible brand badges and active icons.
* **Attention & Quarantine (`--color-coral-rose` / `--color-danger`):** `#FF5678` (Coral Rose) — Replaces aggressive orange/red with a refined, luminous fault hue.
* **Scheduler & Warning (`--color-champagne-gold` / `--color-warning`):** `#F2B85B` (Champagne Gold) — Distinct DRR queue deficit and warning color.
* **Health & Invariant Nominal (`--color-emerald` / `--color-success`):** `#42D3A2` (Emerald Green) — Vivid, reassuring cluster heartbeat status.
* **Transport & Delivery (`--color-blue-icy`):** `#8CB8FF` (Icy Blue) — Transactional outbox 2PC delivery.

#### 4. Companion Light Mode (Executive Pearl & Lavender)
* **Canvas Base:** `#F6F5FA` (Warm Pearl Canvas)
* **Surfaces:** `#FFFFFF` / `#FCFAFF` (Crisp White with Lavender Undertones)
* **Text:** `#17152B` (Deep Imperial Ink)
* **Borders:** `#D8D3E5` (Soft Amethyst-Tinted Border)
* **Primary Action:** `#6842ED` (Royal Violet Light Variant)

---

### Atmospheric Material System

The UI achieves physical depth and texture through three CSS materials:
1. **`.qf-atmosphere-glow`**: Subtle dual-stop radial gradients overlaid on the main viewport providing a soft Royal Violet vignette in the top right and Coral Rose ambient warmth in the bottom left without interfering with content legibility.
2. **`.surface-spectrum-card`**: Multi-layer 145° angled linear gradient (`#19182F` to `#121126`) with a 1px inset top highlight (`rgba(255, 255, 255, 0.05)`).
3. **`.surface-spectrum-hero`**: Multi-stop gradient banner providing dimensional polish for the Mission Control Cockpit.

---

### Accessibility & Interaction Contracts

- **Contrast Ratios:** All primary text (`#F8F6FF`) meets WCAG AAA against `#0B0B18` and `#19182F` ($\ge 14:1$). Secondary text (`#B4B0CC`) and Muted text (`#827D9E`) exceed WCAG AA standards.
- **Unlock Console Control:** Features an uncompromised $\ge 44 \times 44\text{px}$ touch target, high-contrast `#7955F6` background, crisp `#FFFFFF` typography, and soft Royal Violet elevation shadow (`shadow-[0_2px_12px_rgba(121,85,246,0.35)]`).
- **Truthful Offline Telemetry:** Maintained zero mock masking: backend disconnection displays authentic `—` dashes and `OFFLINE` indicators unless the Operator explicitly activates a deterministic scenario.
