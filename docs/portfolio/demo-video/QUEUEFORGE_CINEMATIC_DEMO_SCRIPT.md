# QueueForge V2 — Cinematic Technical Demonstration Script & Storyboard

**Document Identifier:** `QF-PORTFOLIO-CINEMATIC-DEMO-V2`  
**Target Video File:** `D:\Projects\QueueForge\video-output\QueueForge_V2_Cinematic_Product_Demo.mp4`  
**Subtitle Track:** `D:\Projects\QueueForge\video-output\QueueForge_V2_Cinematic_Product_Demo.srt`  
**Specifications:** 1080p (1920 × 1080), 25 FPS, H.264 (`libx264`, CRF 18), AAC Audio 192 kbps, High UI Clarity (85–95% Screen Occupancy)  
**Total Target Duration:** ~3 to 4 Minutes (8 Scenes)  

---

## Storyboard & Narration Breakdown

### Scene 1: Introduction & Titanium × Ember Control Plane
- **Target Duration:** ~28 seconds
- **Route:** `https://queueforge.pages.dev/` (Mission Control)
- **Visual Action:**
  - Full-screen QueueForge Command interface in dark mode.
  - Smooth camera pan / focus on operational status badges (`Cluster Status: Healthy / Active`, `Worker Nodes: 2 JVMs`).
  - Sleek top glassmorphism pill overlay: `QUEUEFORGE V2 • PRECISION COMMAND CONTROL PLANE`.
- **Narration:**
  > *"When engineering asynchronous job processing, teams frequently introduce external brokers like Kafka or RabbitMQ. But brokers introduce the dual-write hazard: if your database commits and broker publishing fails, tasks are lost. QueueForge solves this by turning PostgreSQL 16 into an ACID-durable distributed task platform with contention-free worker claiming, fair multi-tenant scheduling, and guaranteed transactional dispatch. This is QueueForge Command, an operational control plane featuring our Titanium by Ember precision command interface, accessible online at queueforge dot pages dot dev."*

---

### Scene 2: Decoupled 7-Service Architecture & PostgreSQL Isolation
- **Target Duration:** ~28 seconds
- **Route:** `https://queueforge.pages.dev/topology` (System Topology)
- **Visual Action:**
  - System Architecture topology workspace displaying the 7 containerized services.
  - Smooth zoom-in towards the PostgreSQL 16 persistence engine, API gateway, and dual worker JVMs.
  - Floating technical banner: `7-SERVICE MICRO-CLUSTER • DUAL DOCKER NETWORKS • ZERO HOST DB EXPOSURE • <2.4 GB RAM`.
- **Narration:**
  > *"QueueForge operates as a decoupled seven-service micro-cluster isolated across two private Docker bridge networks. The API server ingests and validates client requests, while independent Spring Boot worker JVMs execute distributed task leases. Primary persistence is isolated in sender database with zero host port exposure, while cross-service payment operations dispatch to an independent payment receiver and database. This architecture eliminates single points of failure while strictly constraining aggregate cluster memory to under two point four gigabytes."*

---

### Scene 3: Distributed Worker Fleet & Fenced Leases
- **Target Duration:** ~28 seconds
- **Route:** `https://queueforge.pages.dev/workers` (Worker Fleet)
- **Visual Action:**
  - Worker Fleet management table.
  - Live interaction: Click scenario selector dropdown and select `WORKER_FAILURE`.
  - Notice the simulated scenario warning banner activate.
  - Table highlights worker heartbeat loss, fencing token increment, and lease recovery reaper.
  - Floating overlay: `POSTGRESQL SKIP LOCKED • 30s TIME-BOUNDED LEASE • MONOTONIC FENCING TOKEN`.
- **Narration:**
  > *"Under the hood, QueueForge coordinates independent Spring Boot worker JVMs without centralized coordinators. Workers claim pending batches concurrently using PostgreSQL SELECT FOR UPDATE SKIP LOCKED inside atomic common table expressions, eliminating row-lock contention. Every claim issues a time-bounded thirty-second lease with a monotonic fencing token. If a worker stalls or experiences an untimely crash, a background recovery reaper reclaims the expired lease, while the stale zombie worker is permanently fenced out upon return to prevent split-brain writes."*

---

### Scene 4: FairShare Multi-Tenant DRR Scheduling & Benchmark
- **Target Duration:** ~30 seconds
- **Route:** `https://queueforge.pages.dev/fairshare` (FairShare DRR)
- **Visual Action:**
  - FairShare DRR scheduler studio with active tenant queue meters.
  - Interactive DRR stepper: stepping through tenant deficit counter increments and quantum allocations.
  - High-clarity benchmark overlay card:
    - `FIFO p50 WAIT: 11,868 ms ➔ FAIRSHARE p50 WAIT: 1,210 ms (89.8% REDUCTION)`
    - `JAIN'S FAIRNESS INDEX: 0.999 • AGGREGATE THROUGHPUT TRADEOFF: ~21% (89.6 ➔ 70.6 jobs/s)`
- **Narration:**
  > *"To prevent noisy-neighbor starvation, QueueForge implements Deficit Round Robin multi-tenant scheduling. In our controlled synthetic benchmark, one flood tenant submitted one thousand jobs alongside four quiet tenants submitting twenty jobs each. FairShare reduced quiet-tenant median queue wait by 89.8 percent—from 11.8 seconds down to 1.2 seconds—achieving perfect Jain's fairness under contention. This deterministic fairness is achieved at a measured 21 percent aggregate throughput tradeoff, moving from 89.65 to 70.62 jobs per second."*

---

### Scene 5: Transactional Outbox Event Pipeline & Deduplication
- **Target Duration:** ~28 seconds
- **Route:** `https://queueforge.pages.dev/pipeline` (Event Pipeline)
- **Visual Action:**
  - Transactional Outbox pipeline showing live event progression.
  - Live interaction: Select `OUTBOX_RETRY` scenario from the dropdown.
  - Display atomic dual-entity commit (`orders` + `outbox_events` in one database transaction), polling dispatcher, and payment receiver idempotency check.
  - Floating technical banner: `TRANSACTIONAL OUTBOX PATTERN • ATOMIC DB COMMIT • SHA-256 DEDUPLICATION`.
- **Narration:**
  > *"To guarantee cross-service reliability, QueueForge implements the Transactional Outbox pattern. When orders arrive, domain entities and outbox events commit atomically inside a single ACID database transaction. An asynchronous dispatcher polls unpublished events and dispatches HTTP requests to our simulated payment receiver. The receiver enforces durable inbox deduplication using SHA-256 payload fingerprinting and database primary keys, guaranteeing exactly-once side-effect fulfillment across network retries."*

---

### Scene 6: Dead-Letter Queue, Fault Recovery & Cryptographic Security
- **Target Duration:** ~28 seconds
- **Route:** `https://queueforge.pages.dev/dlq` (Dead-Letter Queue)
- **Visual Action:**
  - Dead-Letter Queue and Reliability console.
  - Select `DLQ_POISON_RECOVERY` scenario.
  - Inspect structured failure classification and error stack traces.
  - Click to open the Authenticated Replay modal, highlighting constant-time cryptographic token verification safeguards before state alteration.
  - Floating overlay: `EXPONENTIAL BACKOFF WITH JITTER • DLQ ROOT-CAUSE CAPTURE • CONSTANT-TIME SECURITY TOKEN`.
- **Narration:**
  > *"When downstream services fail, QueueForge distinguishes between transient network hiccups and permanent business errors. Transient failures trigger exponential backoff with jitter across three attempts. Permanently exhausted jobs route to the Dead-Letter Queue with captured error stack traces. Authorized operators inspect diagnostic failure causes and trigger manual replays. Administrative actions are safeguarded with dual-mode security, requiring constant-time cryptographic verification before modifying production state."*

---

### Scene 7: Production CI Baseline & 302-Test Verification
- **Target Duration:** ~28 seconds
- **Route:** GitHub Actions Run `45047672809` on `main`
- **Visual Action:**
  - High-clarity view of the official GitHub Actions workflow run `45047672809` on `main`.
  - Zoom into the 7 green jobs: Check Repository, Lint & Security, Backend Build & Test, Payment Receiver, Frontend Build & Test, Playwright E2E, Docker Smoke Verification.
  - Prominent verification badge overlay:
    - `302 AUTOMATED TESTS PASSING: 187 BACKEND • 13 RECEIVER • 82 FRONTEND • 20 PLAYWRIGHT`
    - `8 DOCKER CONTAINER SMOKE STAGES VERIFIED ACROSS 7 GREEN CI JOBS`
- **Narration:**
  > *"The complete QueueForge distributed system is backed by a rigorous automated engineering baseline. Every commit is validated by seven required GitHub Actions CI jobs executing 302 automated tests—comprising 187 backend unit and integration tests, 13 payment receiver tests, 82 Vitest frontend tests, and 20 end-to-end Playwright tests—followed by eight real Docker container smoke verification stages. The verified post-merge main pipeline stands at 100 percent green."*

---

### Scene 8: Public Showcase & Portfolio Handoff
- **Target Duration:** ~26 seconds
- **Route:** `https://queueforge.pages.dev/` (Mission Control Showcase)
- **Visual Action:**
  - Return to QueueForge Command desktop in high-resolution Titanium × Ember aesthetic.
  - Elegant full-screen closing card with prominent, readable typography:
    - `GitHub Repository: github.com/saipranav22-commits/queueforge`
    - `Live Interactive Demo: queueforge.pages.dev`
    - `Tech Stack: Java 21 • Spring Boot 3 • PostgreSQL 16 • React • TypeScript • Docker`
- **Narration:**
  > *"You can explore QueueForge Command today as a free interactive portfolio demo deployed on Cloudflare Pages at queueforge dot pages dot dev. The public interface provides clearly labeled deterministic scenario simulations demonstrating healthy clusters, worker failovers, and outbox retries without live backend infrastructure. The full source code, benchmark suites, and technical documentation are available on GitHub. Thank you for watching!"*

---

## Subtitle Sync Schedule

Synchronized subtitles are saved to `video-output/QueueForge_V2_Cinematic_Product_Demo.srt`.
