# QueueForge V2 — 3-Minute Technical Video Demo Script

**Document Identifier:** `QF-PORTFOLIO-DEMO-SCRIPT`  
**Classification:** Video Walkthrough & Screen Recording Guide  
**Target Duration:** Exactly 3 Minutes (180 Seconds)  
**Execution Environment:** Localhost (`http://127.0.0.1:8088` via Docker Compose)  

---

## Technical Recording Checklist Prior to Action:
1. Terminal 1: Run `docker compose -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml up -d` (or `docker-compose.v2.yml`).
2. Terminal 2: Run `./scripts/seed-demo-data.ps1` (or bash equivalent) to populate jobs, tenants, outbox events, and DLQ entries.
3. Browser: Open Chrome to `http://127.0.0.1:8088` in 1920x1080 resolution, dark mode enabled, bookmarks bar hidden.

---

## Detailed Timestamped Walkthrough

### 0:00 – 0:20: Problem Statement & System Architecture
- **Screen:** Show root `README.md` architecture diagram or animated Mermaid diagram.
- **Narrator Audio:**
  > *"When engineering background task processing, teams typically reach for external message brokers like RabbitMQ or Kafka. But brokers introduce the dual-write hazard—if your database commits and the broker write fails, tasks are lost. QueueForge solves this by turning PostgreSQL 16 into an ACID-durable, contention-free task queue using `SELECT FOR UPDATE SKIP LOCKED`, pairing it with a multi-tenant FairShare scheduler and a transactional outbox. Let's look at the live control plane."*

---

### 0:20 – 0:50: The Obsidian Pulse Control Plane
- **Screen:** Switch to `http://127.0.0.1:8088` (Overview Dashboard).
- **Visual Action:** Mouse hovers over Metric Cards (Throughput: 85 jobs/s, Active Workers: 2, Queue Depth, DLQ count).
- **Narrator Audio:**
  > *"This is Obsidian Pulse, built with React 19, TypeScript, and Tailwind CSS. The console synchronizes with our backend via TanStack Query periodic polling. Across the top, we see real-time cluster health, queue depth, active throughput, and tenant quota utilization. The interface runs in Public Demo mode: anonymous viewers can observe high-level telemetry, but sensitive customer payloads and tenant API keys are cryptographically masked."*

---

### 0:50 – 1:20: Distributed Workers & Fenced Execution
- **Screen:** Click **Workers** in sidebar navigation, then navigate to **Job Explorer**.
- **Visual Action:**
  - Show `worker-1` and `worker-2` heartbeats and active job counters.
  - In Job Explorer, click a running/completed job to open the **Detail Drawer**. Expand the **Execution Timeline**.
- **Narrator Audio:**
  > *"Under the hood, QueueForge runs independent worker JVMs. Here we see `worker-1` and `worker-2` sending heartbeats every 5 seconds. When workers query the queue, PostgreSQL's `SKIP LOCKED` ensures they claim batches of jobs with zero lock waiting. Each claim assigns a time-bounded lease and a cryptographic fencing token. If a worker hangs past its lease, a sweeper reclaims the job, and the zombie worker is fenced out upon attempted completion, preventing split-brain writes."*

---

### 1:20 – 1:50: FairShare Multi-Tenant DRR Scheduler
- **Screen:** Click **FairShare** in sidebar navigation.
- **Visual Action:** Point to tenant progress bars showing weights, current concurrency vs `max_concurrency`, and deficit counters.
- **Narrator Audio:**
  > *"In multi-tenant SaaS, one client submitting 10,000 batch jobs can starve all other tenants. QueueForge implements Deficit Round Robin fair scheduling. Each tenant is allocated execution quantum proportional to its weight, guarded by cluster-wide concurrency quotas. In our synthetic benchmarks under a 1,000-job flood, this reduced median wait latency for quiet tenants by 89.8%—dropping wait times from 11.8 seconds down to 1.2 seconds, with perfect Jain's fairness."*

---

### 1:50 – 2:20: Transactional Outbox & Durable Idempotency
- **Screen:** Click **Event Pipeline** in sidebar navigation.
- **Visual Action:** Show Outbox Events table with `ORDER_PAYMENT_REQUESTED`, delivery timestamps, and payment charge references.
- **Narrator Audio:**
  > *"To coordinate cross-service effects safely, QueueForge implements the Transactional Outbox. When an order is placed, the order and an outbox event containing an idempotency key and SHA-256 fingerprint commit in the exact same database transaction. A dispatcher polls pending events and delivers them via HTTP to an independent payment receiver service. The receiver enforces primary-key deduplication in PostgreSQL—if network acknowledgments drop, retried requests replay the cached outcome with zero duplicate charges."*

---

### 2:20 – 2:40: Retries, Backoff & Dead-Letter Queue (DLQ)
- **Screen:** Click **Dead-Letter Queue (DLQ)** in sidebar navigation.
- **Visual Action:**
  - Click on a failed job. Show error category (`TRANSIENT_FAILURE` vs `PERMANENT_FAILURE`) and stack trace.
  - Click the **Unlock Admin** button in header, enter admin key, and click **Replay Job**.
- **Narrator Audio:**
  > *"When jobs fail transiently, QueueForge calculates exponential backoff with full jitter to prevent retry thundering herds. Once maximum retries are exhausted, jobs route to the Dead-Letter Queue with full error categorization and attempt histories. Authorized operators can inspect sanitized stacks and trigger atomic replays directly from the console."*

---

### 2:40 – 3:00: Test Verification, CI & Summary
- **Screen:** Show GitHub Actions CI pipeline page ([Run 44918650943](https://github.com/saipranav22-commits/queueforge/actions/runs/44918650943)) showing all 7 green jobs.
- **Narrator Audio:**
  > *"QueueForge V2 is verified by 264 automated tests—including 187 backend integration tests against real PostgreSQL instances, 44 Vitest component tests, and 20 Playwright browser tests. The entire 7-service topology is packaged and published to GitHub Container Registry, ready for reproducible deployment on any 4GB VPS. The complete source, benchmarks, and architecture runbooks are available on GitHub. Thanks for watching!"*
