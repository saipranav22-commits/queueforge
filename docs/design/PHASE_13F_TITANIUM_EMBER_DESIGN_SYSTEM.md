# QUEUEFORGE COMMAND — PHASE 13F DESIGN SYSTEM SPECIFICATION
## "TITANIUM × EMBER" — PRECISION ENGINEERING MEETS LUXURY INDUSTRIAL INSTRUMENTATION

---

### 1. Executive Vision & Philosophy

QueueForge Command Phase 13F establishes a complete visual redirection: **TITANIUM × EMBER**.
This design system answers the owner's explicit rejection of:
- Purple, violet, blue, and teal as dominant colors
- Neon cyberpunk aesthetics
- Flat monochrome grey wash
- Generic Tailwind administrative dashboards
- Repetitive small card layouts and box-heavy topology diagrams

The visual identity is grounded in **precision engineering and luxury industrial instrumentation**, drawing inspiration from high-end automotive cockpits, professional industrial control surfaces, architectural visualization tools, and hardware engineering consoles.

---

### 2. Precise Palette Specification

#### Primary Structural Foundations
* **Carbon Black (`#0C0D0E`):** Foundation base canvas in dark mode; deep, light-absorbent, eliminates flat washed-out grey.
* **Graphite (`#17191B`):** Secondary canvas, side navigation, and primary console bays.
* **Titanium (`#292B2D`):** Elevated structural surfaces, tactile instrumentation frames, and bezel accents.
* **Machined Steel (`#45494D`):** Interactive component rims, slider tracks, and secondary button borders.

#### High-Contrast Typography & Metallic Accents
* **Warm Ivory (`#F0EDE5`):** High-contrast primary typography in dark mode ($\ge 15:1$ WCAG AAA); base canvas in light mode.
* **Muted Silver (`#A8A9A7`):** Technical body text, secondary labels, and unit denominators.
* **Ember Orange (`#E66B35`):** Distinctive, high-heat brand-action accent. Used selectively on primary execution buttons, active navigation, and focal alerts.
* **Burnished Copper (`#A94D2C`):** Depth accent, secondary active highlights, and DRR scheduling telemetry.
* **Champagne Brass (`#C5A16A`):** Precision instrument rules, calibration tick marks, and luxury detail accents.

#### Calibrated Semantic Status
* **Success (`#65A884`):** Precision instrument green (nominal cluster status, healthy heartbeats, verified invariants).
* **Warning (`#D9A052`):** Calibrated amber/gold (simulated scenarios, degraded capacity, advisory lease warnings).
* **Critical (`#D65D58`):** Precision fault red (poison DLQ isolation, database disconnection).
* **Unavailable (`#81858A`):** Muted steel dash (truthful offline representation, zero fake zeroes).

---

### 3. Companion Light Theme: Warm Ivory & Titanium

Rather than a mechanical inversion, the light theme is an intentionally crafted luxury document and engineering console:
* **Canvas:** Warm Ivory (`#F0EDE5`)
* **Surfaces:** Crisp White (`#FFFFFF`) with subtle 1px titanium borders (`#D3CCC0`)
* **Typography:** Deep Titanium Ink (`#17191B`) and Machined Steel (`#45494D`)
* **Separators:** Subtle Brass Rules (`#B38E54` / `#D8CFBC`)
* **Actions:** High-Contrast Ember Orange (`#E66B35`) with deep white text

---

### 4. Typography & Proportional Scale

* **Command Numerals:** `text-2xl` to `text-3xl font-extrabold font-mono tracking-tight tabular-nums`
* **Micro-Labels:** `text-[10px]` to `text-[11px] font-mono uppercase tracking-widest font-semibold`
* **Card & Module Framing:** Elimination of uniform box borders; use of integrated dividing rules, corner alignment ticks, and calibrated spatial grouping.
* **Touch Targets:** The primary "Unlock Console" control maintains a strict minimum $\ge 44 \times 44\text{px}$ touch target with Ember action styling.
