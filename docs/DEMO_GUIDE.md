# QueueForge — Recruiter & Technical Demo Guide (3-Minute Walkthrough)

This guide provides a structured, approximately 3-minute live demonstration script designed for technical interviews, portfolio presentations, and recruiter evaluations.

---

## Demo Preparation Checklist

1. Ensure the production container stack is running:
   ```bash
   docker compose -p queueforge-prod -f docker-compose.prod.yml up -d
   ```
2. Open two browser tabs:
   - **Tab 1 — Operations Console:** `http://127.0.0.1:8088/`
   - **Tab 2 — Grafana Telemetry:** `http://127.0.0.1:3001/` (Login: `qf_admin`)

---

## 3-Minute Demonstration Script

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TIMELINE BREAKDOWN                                                        │
│ 00:00 - 00:30 | Problem Statement & Architecture                          │
│ 00:30 - 01:15 | Core Flow: Job Ingestion & Concurrent SKIP LOCKED Worker  │
│ 01:15 - 02:00 | Failure Classification, Exponential Backoff & DLQ         │
│ 02:00 - 02:30 | Administrative Replay & Security Boundaries               │
│ 02:30 - 03:00 | Observability (Prometheus/Grafana) & Wrap-Up              │
└───────────────────────────────────────────────────────────────────────────┘
```

### Segment 1: The Engineering Problem & Architecture (0:00 – 0:30)

**[Action: Display the Overview Dashboard at `http://127.0.0.1:8088/`]**

> **Narration Script:**
> *"Hi, I'm excited to walk you through QueueForge. 
> 
> Most distributed systems rely on external message brokers like RabbitMQ or Kafka for background processing. While great for high throughput, they introduce dual-write race conditions, lack transactional guarantees with database state, and require dedicated operational maintenance.
> 
> I engineered QueueForge as a transactional, PostgreSQL-backed asynchronous task engine using Java 21, Spring Boot 3, and React 19. It guarantees at-least-once durable execution using PostgreSQL's row-level `SELECT FOR UPDATE SKIP LOCKED`, cryptographic fencing tokens, and automated lease recovery."*

---

### Segment 2: Job Ingestion, Idempotency & Worker Execution (0:30 – 1:15)

**[Action: Click "Submit Test Job" or trigger a POST request from the terminal; navigate to Job Explorer at `/jobs`]**

> **Narration Script:**
> *"Let's submit a job. When a client submits a payload, QueueForge computes a canonical SHA-256 fingerprint combined with an optional idempotency key. If a client retries or double-submits, our unique index enforces idempotency and returns the existing job status with HTTP 200 rather than creating duplicates.
> 
> Once ingested as `PENDING`, our background `WorkerCoordinator` claims it. Instead of locking the whole table, each worker uses `SELECT FOR UPDATE SKIP LOCKED` to atomically claim a batch of prioritized jobs in a single microsecond transaction.
> 
> The database lock is released immediately. The actual handler logic executes outside the transaction in a bounded thread pool, so long-running tasks never exhaust database connections."*

---

### Segment 3: Error Classification & Dead-Letter Queue (1:15 – 2:00)

**[Action: Click on the Dead-Letter Queue page at `/dlq`]**

> **Narration Script:**
> *"Now let's examine resilience. In distributed systems, naive retries against permanent errors waste CPU and risk crashing downstream systems.
> 
> QueueForge implements an explicit Error Classification Taxonomy:
> - Transient exceptions are retried using Exponential Backoff with Full Jitter ($\pm 20\%$) to prevent thundering herds.
> - Permanent errors or unhandled job types bypass retries entirely and route immediately to the Dead-Letter Queue.
> 
> In this DLQ view, operators can inspect failed jobs, review the exact failure category—such as `HANDLER_NOT_FOUND` or `LEASE_EXPIRED`—and analyze the full diagnostic error message."*

---

### Segment 4: Admin Unlock, CSRF Protection & Atomic Replay (2:00 – 2:30)

**[Action: Click 'Replay' on a DLQ item, triggering the 'Unlock Admin Actions' modal; enter `ADMIN_API_KEY` and click 'Authenticate & Unlock']**

> **Narration Script:**
> *"Notice that privileged operations like Replaying or Discarding DLQ items are locked by default.
> 
> To demonstrate security engineering: unauthenticated callers only receive sanitized, masked payloads. When an administrator unlocks the console, the server sets an `HttpOnly, SameSite=Lax` cookie and issues a cryptographic CSRF token.
> 
> Every mutating request requires this token via `X-CSRF-Token`, verified against timing attacks using constant-time comparison.
> 
> Once unlocked, clicking 'Replay' atomically resets the dead-letter job back to `PENDING`, clearing the failure state and allowing a worker to pick it up immediately."*

---

### Segment 5: Observability, Metrics & Telemetry (2:30 – 3:00)

**[Action: Switch to Tab 2 — Grafana Dashboard at `http://127.0.0.1:3001/` or the Monitoring page at `/monitoring`]**

> **Narration Script:**
> *"Finally, operational visibility. QueueForge exports Micrometer metrics to Prometheus and Grafana.
> 
> Rather than hammering PostgreSQL with `COUNT(*)` queries on every scrape, a dedicated background refresher computes queue gauges once per second.
> 
> We track active leases, thread saturation, p50 and p99 execution latencies, and queue wait times with strict tag cardinality bounds to prevent memory leaks in time-series databases.
> 
> The entire stack is containerized with non-root Docker images, tested with 73 backend integration tests and Playwright E2E automation, and packaged for reproducible deployment. Thank you!"*

---

## Common Technical Q&A Preparation

| Question | Recommended Answer |
| :--- | :--- |
| **Why not just use RabbitMQ or Celery?** | *"RabbitMQ doesn't natively solve the Transactional Outbox problem. If your business transaction commits but the broker publish fails, you lose the event. With PostgreSQL as the queue, job ingestion participates in the exact same ACID transaction as the business entity update."* |
| **How do you handle a worker that crashes while holding a job?** | *"Every claim sets a `lease_until` timestamp. Long-running jobs heartbeat to extend it. If a worker dies, a `LeaseRecoverySweeper` detects expired leases, evaluates the retry budget, and either requeues the job to `PENDING` or transitions it to `DEAD_LETTER` with `failureCategory = LEASE_EXPIRED`."* |
| **What happens if a slow worker wakes up after its lease expired?** | *"We use dual fencing: every completion or failure update requires `claim_token = ? AND lease_until >= NOW()`. If the lease expired and another worker took over, the slow worker's update matches 0 rows and is safely rejected without corrupting state."* |
