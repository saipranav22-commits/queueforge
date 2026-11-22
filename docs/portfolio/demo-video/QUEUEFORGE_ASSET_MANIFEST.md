# QueueForge V2 — Walkthrough Presentation Asset Manifest

**Document Identifier:** `QF-PORTFOLIO-ASSET-MANIFEST`  
**Classification:** Visual Asset Catalog & Technical Provenance  
**Repository Baseline:** `6f9d971b3c560aa8fb575aef86d1a806771f06a2`  
**Branch:** `portfolio/v2-demo-and-career-readiness`  

---

## 1. Asset Inventory & Verification Table

Every asset referenced in the presentation exists directly on disk in the QueueForge repository. No external CDN requests, simulated browser mocks, or fabricated assets are utilized.

| # | Presentation Role | Relative Path from Presentation | Repository Absolute Path | Type | Verified Dimensions | Size (Bytes) | SHA-256 Digest (First 12) |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **1** | Scene 1 Topology Diagram | *Inline Vector SVG* | Embedded in HTML | Vector SVG | 920 × 480 ViewBox | N/A | Valid SVG XML |
| **2** | Scene 2 Overview Dashboard | `../../screenshots/01_overview_dashboard.png` | `D:\Projects\QueueForge\docs\screenshots\01_overview_dashboard.png` | PNG Image | **1440 × 900** | 99,057 | `99a0d8e2bfb8...` |
| **3** | Scene 3 Workers Health | `../../screenshots/07_workers_health.png` | `D:\Projects\QueueForge\docs\screenshots\07_workers_health.png` | PNG Image | **1440 × 900** | 86,179 | `7f41a0e8832c...` |
| **4** | Scene 3 Job Explorer Inset | `../../screenshots/02_job_explorer.png` | `D:\Projects\QueueForge\docs\screenshots\02_job_explorer.png` | PNG Image | **1440 × 900** | 57,689 | `4c8d23e590fa...` |
| **5** | Scene 4 FairShare Benchmark | `../../benchmark/fairshare_benchmark_chart.svg` | `D:\Projects\QueueForge\docs\benchmark\fairshare_benchmark_chart.svg` | Vector SVG | Scalable Vector | 5,457 | `e2a4049fc1e2...` |
| **6** | Scene 5 Outbox Flow Diagram | *Inline Vector SVG* | Embedded in HTML | Vector SVG | 920 × 480 ViewBox | N/A | Valid SVG XML |
| **7** | Scene 6 Dead-Letter Queue | `../../screenshots/06_dead_letter_queue.png` | `D:\Projects\QueueForge\docs\screenshots\06_dead_letter_queue.png` | PNG Image | **1440 × 900** | 76,972 | `18f9df083c27...` |
| **8** | Scene 7 CI & Test Matrix | *Inline CSS / DOM Elements* | Embedded in HTML | DOM Vector | Responsive | N/A | Verified CI Data |

---

## 2. Additional Authentic Screenshot Assets (In Repository)

The following auxiliary screenshots are also available in `docs/screenshots/` for deep-dive technical interview discussions:

| File Name | Dimensions | File Size | Description |
| :--- | :---: | :---: | :--- |
| `03_job_detail_masked.png` | 1440 × 900 | 74,856 bytes | Job detail view showing public demo masking and field-level redaction |
| `04_admin_unlock_modal.png` | 1440 × 900 | 94,511 bytes | Admin unlock modal prompting for `X-Admin-Key` authorization |
| `05_job_detail_unlocked.png` | 1440 × 900 | 72,036 bytes | Job detail view after administrative unlock revealing full JSON payload |
| `08_monitoring_metrics.png` | 1440 × 900 | 78,530 bytes | Operational metrics telemetry (queue latency distributions & throughput) |
| `09_mobile_responsive_view.png` | 390 × 844 | 30,544 bytes | Mobile viewport (iPhone 14/15 resolution) showing responsive drawer & cards |

---

## 3. Path Correction Notice (Phase 12I Remediation)

During previous reporting in Phase 12I, asset locations were informally noted as `docs/assets/`. 

**Formal Correction:**
- The verified on-disk screenshot directory is: `docs/screenshots/`
- The verified on-disk benchmark directory is: `docs/benchmark/`
- The presentation at `docs/portfolio/demo-video/QUEUEFORGE_WALKTHROUGH_PRESENTATION.html` references the correct on-disk paths via relative traversal (`../../screenshots/` and `../../benchmark/`).
- All relative paths have been verified through automated file existence tests.

---

## 4. Benchmark Provenance & Data Integrity

The benchmark data cited in Scene 4 is directly derived from:
- **Raw Data Source:** [`docs/benchmark/benchmark-results-fairshare.json`](../benchmark/benchmark-results-fairshare.json)
- **Harness Implementation:** [`backend/src/test/java/com/queueforge/scheduler/FairShareBenchmarkRunner.java`](../../backend/src/test/java/com/queueforge/scheduler/FairShareBenchmarkRunner.java)
- **Documented Evaluation:** [`docs/benchmark/FAIRSHARE_BENCHMARK_PRESENTATION.md`](../benchmark/FAIRSHARE_BENCHMARK_PRESENTATION.md)

### Verified Benchmark Arithmetic:
- **Profile 3 Noisy-Neighbor Parameters:** 1 flood tenant (1,000 jobs) + 4 quiet tenants (20 jobs each) = 1,080 jobs total.
- **Quiet Tenant p50 Queue Wait:** Baseline FIFO: 11,868 ms | FairShare DRR: 1,210 ms.
- **Latency Reduction:** $(1 - 1,210 / 11,868) \times 100\% = 89.804\% \approx \mathbf{89.8\%}$.
- **Aggregate Throughput Tradeoff:** Baseline FIFO: 89.65 jobs/s | FairShare DRR: 70.62 jobs/s. Overhead: $(1 - 70.62 / 89.65) \times 100\% = 21.227\% \approx \mathbf{21.2\%}$.
- **Jain's Fairness Index:** Under contention, baseline FIFO dropped to **0.2329** (flood monopolization); FairShare DRR achieved **1.0000** (perfect proportional service).
