# QueueForge V2 — 180-Second Recruiter-Ready Narration Script

**Document Identifier:** `QF-DEMO-NARRATION-V2`  
**Target Duration:** Exactly 180 Seconds (3 Minutes)  
**Speaking Pace:** ~132 words per minute (Comfortable conversational pace with natural pauses)  
**Total Word Count:** 396 Words  
**Format:** Evidence-Based Technical Walkthrough (Discloses recorded UI telemetry, benchmark data, and verified CI)  
**No Live Claims:** Accurately represents authentic captured screenshots, reproducible benchmarks, and passing automated test suites.  

---

## Scene-by-Scene Delivery Table

| Scene # | Time Window | Scene Title | Visual Displayed | Word Count |
| :---: | :---: | :--- | :--- | :---: |
| **1** | **0:00 – 0:25** (25s) | Problem & 7-Service Architecture | 7-Service Architecture Topology Diagram | 56 words |
| **2** | **0:25 – 0:50** (25s) | Obsidian Pulse Dashboard | `docs/screenshots/01_overview_dashboard.png` | 54 words |
| **3** | **0:50 – 1:20** (30s) | Distributed Workers & Fenced Execution | `07_workers_health.png` + `02_job_explorer.png` | 66 words |
| **4** | **1:20 – 1:50** (30s) | FairShare Multi-Tenant DRR Scheduling | `docs/benchmark/fairshare_benchmark_chart.svg` | 62 words |
| **5** | **1:50 – 2:15** (25s) | Transactional Outbox & Idempotency | Transactional Outbox Flow Diagram | 55 words |
| **6** | **2:15 – 2:40** (25s) | Dead-Letter Queue & Fault Recovery | `docs/screenshots/06_dead_letter_queue.png` | 54 words |
| **7** | **2:40 – 3:00** (20s) | Automated Verification & Open-Source Closing | GitHub Actions CI Run & GitHub Repository | 49 words |
| **Total** | **180 Seconds** | **Complete Walkthrough** | **All Verified Artifacts** | **396 words** |

---

## Exact Word-for-Word Spoken Narration

### Scene 1 — Problem and Project Introduction (0:00 – 0:25)
*Target Duration: 25 seconds | Word Count: 56 words*

**Visual:** 7-Service Architecture Topology Diagram (Ingress Proxy, API Server, Worker-1, Worker-2, Sender DB, Payment Receiver, Receiver DB).

**Spoken Narration:**
> "When engineering asynchronous job processing, teams frequently introduce external brokers like Kafka or RabbitMQ. But brokers create the dual-write hazard: if your database commits and broker publishing fails, tasks are lost.
> 
> QueueForge solves this by turning PostgreSQL 16 into an ACID-durable task platform with contention-free worker claiming, fair multi-tenant scheduling, and guaranteed transactional dispatch."

---

### Scene 2 — Obsidian Pulse Dashboard (0:25 – 0:50)
*Target Duration: 25 seconds | Word Count: 54 words*

**Visual:** Authentic Screenshot `docs/screenshots/01_overview_dashboard.png` (1440 × 900 resolution).

**Spoken Narration:**
> "This is Obsidian Pulse, our operational control plane built with React 19, TypeScript, and Tailwind CSS.
> 
> The console synchronizes with our Spring Boot API gateway using TanStack Query three-second REST polling.
> 
> In public demo mode, visitors inspect cluster throughput, queue depth, and worker health, while sensitive job payloads receive response-level field redaction."

---

### Scene 3 — Distributed Workers and Job Processing (0:50 – 1:20)
*Target Duration: 30 seconds | Word Count: 66 words*

**Visual:** Authentic Screenshots `docs/screenshots/07_workers_health.png` and `docs/screenshots/02_job_explorer.png` (1440 × 900 resolution).

**Spoken Narration:**
> "Under the hood, QueueForge coordinates independent Spring Boot worker JVMs.
> 
> Workers claim pending batches concurrently using PostgreSQL `SELECT FOR UPDATE SKIP LOCKED`, eliminating row-lock contention.
> 
> Every claim issues a time-bounded thirty-second lease with a monotonic fencing token.
> 
> If a worker crashes or stalls, a background recovery reaper reclaims the expired lease, while the stale worker is fenced out upon return to prevent split-brain writes."

---

### Scene 4 — FairShare Scheduling (1:20 – 1:50)
*Target Duration: 30 seconds | Word Count: 62 words*

**Visual:** Vector Benchmark Chart `docs/benchmark/fairshare_benchmark_chart.svg`.

**Spoken Narration:**
> "To prevent noisy-neighbor starvation, QueueForge implements Deficit Round Robin multi-tenant scheduling.
> 
> In our controlled benchmark, one flood tenant submitted one thousand jobs alongside four quiet tenants submitting twenty jobs each.
> 
> FairShare reduced quiet-tenant median queue wait by 89.8%—from 11.8 seconds down to 1.2 seconds—achieving perfect Jain's fairness under contention at a planned 21% aggregate throughput tradeoff."

---

### Scene 5 — Transactional Outbox and Idempotency (1:50 – 2:15)
*Target Duration: 25 seconds | Word Count: 55 words*

**Visual:** Transactional Outbox Flow Diagram (`docs/architecture/TRANSACTIONAL_OUTBOX_FLOW.md`).

**Spoken Narration:**
> "To demonstrate cross-service reliability, QueueForge implements the Transactional Outbox pattern.
> 
> When orders arrive, domain entities and outbox events commit atomically inside a single ACID database transaction.
> 
> An asynchronous dispatcher polls events and dispatches HTTP requests to a simulated payment receiver.
> 
> The receiver enforces durable inbox deduplication using SHA-256 keys, ensuring exactly-once processing across network retries."

---

### Scene 6 — Dead-Letter Queue and Recovery (2:15 – 2:40)
*Target Duration: 25 seconds | Word Count: 54 words*

**Visual:** Authentic Screenshot `docs/screenshots/06_dead_letter_queue.png` (1440 × 900 resolution).

**Spoken Narration:**
> "When downstream services fail, QueueForge distinguishes between transient network hiccups and permanent business errors.
> 
> Transient failures trigger exponential backoff with jitter across three attempts.
> 
> Exhausted jobs route to the Dead-Letter Queue with captured error stack traces.
> 
> From Obsidian Pulse, authorized operators review diagnostic failure reasons, inspect sanitized payloads, and trigger manual authenticated replays."

---

### Scene 7 — Automated Verification and Closing (2:40 – 3:00)
*Target Duration: 20 seconds | Word Count: 49 words*

**Visual:** GitHub Actions CI Run `44935616424` (7 Jobs Green) and GitHub Repository `saipranav22-commits/queueforge`.

**Spoken Narration:**
> "Every capability in QueueForge is backed by 264 automated tests—including 187 backend tests, 13 payment receiver tests, 44 frontend tests, and 20 Playwright browser tests—plus eight Docker smoke stages across seven green GitHub Actions jobs.
> 
> The full source code, architecture specifications, and benchmark methodology are available on GitHub. Thank you!"

---

## Presenter Rehearsal Tips
1. **Pacing:** Aim for a steady, relaxed conversational cadence. 396 words over 180 seconds leaves 20–25 seconds of total breathing room for scene transitions and slide comprehension.
2. **Emphasis:** Give clear, confident emphasis to key technical terms: `SKIP LOCKED`, `fencing token`, `Deficit Round Robin`, `89.8%`, `Transactional Outbox`, and `264 tests`.
3. **Tone:** Professional, objective, and engineering-focused. Let the authentic metrics, architectural diagrams, and verified test counts speak for themselves.
