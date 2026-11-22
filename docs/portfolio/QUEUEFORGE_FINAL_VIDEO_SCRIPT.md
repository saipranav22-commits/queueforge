# QueueForge V2 — Final Technical Walkthrough Video Script & Storyboard

**Document Identifier:** `QF-PORTFOLIO-VIDEO-SCRIPT-V2`  
**Target Video File:** `D:\Projects\QueueForge\video-output\QueueForge_V2_Final_Technical_Walkthrough.mp4`  
**Subtitle Track:** `D:\Projects\QueueForge\video-output\QueueForge_V2_Final_Technical_Walkthrough.srt`  
**Target Specifications:** 1080p (1920 × 1080), 25 FPS, H.264, AAC Audio, ~3–4 Minutes Duration  

---

## Storyboard & Narration Breakdown

### Scene 1: Product Introduction & Titanium × Ember Interface
- **Timeline:** 0:00 – 0:35 (35.7s)
- **Visual:** Mission Control Desktop (`docs/screenshots/portfolio/01_mission_control_desktop.png`) showing Titanium × Ember palette, `Live Cluster (Offline)` status badge, and Cloudflare Pages public showcase link.
- **Narration:**
  > *"When engineering asynchronous job processing, teams frequently introduce external brokers like Kafka or RabbitMQ. But brokers create the dual-write hazard: if your database commits and broker publishing fails, tasks are lost. QueueForge solves this by turning PostgreSQL 16 into an ACID-durable task platform with contention-free worker claiming, fair multi-tenant scheduling, and guaranteed transactional dispatch. This is QueueForge Command, an operational control plane featuring our Titanium by Ember precision command interface, accessible online at queueforge dot pages dot dev."*

### Scene 2: Decoupled 7-Service Topology & PostgreSQL Isolation
- **Timeline:** 0:36 – 1:07 (32.3s)
- **Visual:** Architecture Topology Workspace (`docs/screenshots/portfolio/02_architecture_topology.png`) showing 7 containerized services partitioned across two private Docker bridge networks (`qf-prod-backend-net` and `qf-prod-receiver-net`).
- **Narration:**
  > *"QueueForge operates as a decoupled seven-service micro-cluster isolated across two private Docker bridge networks. The API server ingests and validates client requests, while independent Spring Boot worker JVMs execute distributed task leases. Primary persistence is isolated in sender database with zero host port exposure, while cross-service payment operations dispatch to an independent payment receiver and database. This architecture eliminates single points of failure while strictly constraining aggregate cluster memory to under two point four gigabytes."*

### Scene 3: Distributed Worker Coordination & Fenced Leases
- **Timeline:** 1:08 – 1:40 (32.8s)
- **Visual:** Worker Fleet (`docs/screenshots/portfolio/03_worker_fleet.png`) and Job Explorer (`docs/screenshots/portfolio/06_job_explorer.png`) with `SIMULATED SCENARIO` banner active.
- **Narration:**
  > *"Under the hood, QueueForge coordinates independent Spring Boot worker JVMs without centralized coordinators. Workers claim pending batches concurrently using PostgreSQL SELECT FOR UPDATE SKIP LOCKED inside atomic common table expressions, eliminating row-lock contention. Every claim issues a time-bounded thirty-second lease with a monotonic fencing token. If a worker stalls or experiences an untimely crash, a background recovery reaper reclaims the expired lease, while the stale zombie worker is permanently fenced out upon return to prevent split-brain writes."*

### Scene 4: FairShare Multi-Tenant DRR Scheduling Benchmark
- **Timeline:** 1:41 – 2:14 (33.9s)
- **Visual:** FairShare DRR Scheduler Studio (`docs/screenshots/portfolio/04_fairshare_drr_scheduler.png`) and vector benchmark chart (`fairshare_benchmark_chart.svg`).
- **Narration:**
  > *"To prevent noisy-neighbor starvation, QueueForge implements Deficit Round Robin multi-tenant scheduling. In our controlled synthetic benchmark, one flood tenant submitted one thousand jobs alongside four quiet tenants submitting twenty jobs each. FairShare reduced quiet-tenant median queue wait by 89.8 percent—from 11.8 seconds down to 1.2 seconds—achieving perfect Jain's fairness under contention. This deterministic fairness is achieved at a measured 21 percent aggregate throughput tradeoff, moving from 89.65 to 70.62 jobs per second."*

### Scene 5: Atomic Transactional Outbox & Idempotent Delivery
- **Timeline:** 2:15 – 2:45 (31.0s)
- **Visual:** Transactional Outbox Event Pipeline (`docs/screenshots/portfolio/05_transactional_outbox_pipeline.png`) showing atomic order persistence and HTTP dispatch stream.
- **Narration:**
  > *"To guarantee cross-service reliability, QueueForge implements the Transactional Outbox pattern. When orders arrive, domain entities and outbox events commit atomically inside a single ACID database transaction. An asynchronous dispatcher polls unpublished events and dispatches HTTP requests to our simulated payment receiver. The receiver enforces durable inbox deduplication using SHA-256 payload fingerprinting and database primary keys, guaranteeing exactly-once side-effect fulfillment across network retries."*

### Scene 6: Dead-Letter Queue, Fault Recovery & Cryptographic Security
- **Timeline:** 2:46 – 3:15 (29.7s)
- **Visual:** Dead-Letter Queue (`docs/screenshots/portfolio/07_dead_letter_queue.png`) and Reliability Lab (`docs/screenshots/portfolio/08_reliability_lab.png`) showing failure classification, error stack traces, and constant-time unlock authentication.
- **Narration:**
  > *"When downstream services fail, QueueForge distinguishes between transient network hiccups and permanent business errors. Transient failures trigger exponential backoff with jitter across three attempts. Permanently exhausted jobs route to the Dead-Letter Queue with captured error stack traces. Authorized operators inspect diagnostic failure causes and trigger manual replays. Administrative actions are safeguarded with dual-mode security, requiring constant-time cryptographic verification before modifying production state."*

### Scene 7: Public Interactive Demo & 302-Test CI Baseline
- **Timeline:** 3:15 – 3:57 (42.5s)
- **Visual:** Monitoring Telemetry (`docs/screenshots/portfolio/09_monitoring_telemetry.png`), Mobile Viewport (`docs/screenshots/portfolio/10_mobile_dashboard.png`), and GitHub Actions 7-job post-merge green badge.
- **Narration:**
  > *"You can explore QueueForge Command today as a free interactive portfolio demo deployed on Cloudflare Pages at queueforge dot pages dot dev. The public interface provides clearly labeled deterministic scenario simulations demonstrating healthy clusters, worker failovers, and outbox retries without live backend infrastructure. The full distributed engine is validated by 302 automated tests—including 187 backend tests, 13 payment receiver tests, 82 Vitest unit tests, and 20 Playwright browser tests—plus eight Docker smoke stages across seven green GitHub Actions jobs. The entire open-source repository and documentation are available on GitHub. Thank you!"*
