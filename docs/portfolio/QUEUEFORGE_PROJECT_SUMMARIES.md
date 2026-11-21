# QueueForge V2 — Portfolio Project Summaries & Positioning Copy

**Document Identifier:** `QF-PORTFOLIO-SUMMARIES`  
**Classification:** Professional Portfolio & Recruiter Collateral  
**Verified Git Baseline:** `95884060c7ce2493369f1cd6b47b00b7afacaae0`  

---

## 1. One-Line Technical Summary
> **QueueForge is an ACID-compliant distributed task queue and multi-tenant operational control plane built with Java 21, Spring Boot, PostgreSQL 16 (SKIP LOCKED), and React 19, featuring Deficit Round Robin fair scheduling and a transactional outbox.**

---

## 2. 50-Word Project Description (Portfolio Card / Brief Bio)
> QueueForge eliminates external message broker complexity by turning PostgreSQL into a high-throughput, contention-free distributed task queue. Engineered with Java 21, Spring Boot 3, and PostgreSQL 16 `SKIP LOCKED`, it features multi-worker lease fencing, a Deficit Round Robin scheduler cutting quiet-tenant latency by 89.8%, and a transactional outbox with idempotent delivery.

*(Word Count: 49 words)*

---

## 3. 100-Word Project Description (Featured Project / Application Cover)
> QueueForge is a resilient distributed task execution platform and operations console engineered with Java 21, Spring Boot 3, PostgreSQL 16, and React 19. Designed to avoid the operational overhead and dual-write inconsistencies of external message brokers, it leverages PostgreSQL row-level lock skipping (`SELECT FOR UPDATE SKIP LOCKED`) for contention-free worker claiming. 
> 
> The platform implements Deficit Round Robin (DRR) fair scheduling—reducing quiet-tenant starvation latency by 89.8% under noisy-neighbor bursts—alongside time-bounded lease fencing, dead-letter recovery, and a transactional outbox delivering idempotent payment processing. Backed by 264 automated tests, 8 Docker smoke stages, and published GHCR container images.

*(Word Count: 100 words)*

---

## 4. LinkedIn Featured Project Post Copy

```markdown
🚀 Excited to share QueueForge V2 — a resilient distributed task queue and operational control plane built with Java 21, Spring Boot 3, PostgreSQL 16, and React 19!

When building background job systems, teams often default to external message brokers like RabbitMQ or Kafka. But this introduces the "dual-write problem": if your database transaction commits and the network write to the broker fails, your task is permanently lost.

In QueueForge, I turned PostgreSQL 16 into an ACID-compliant, contention-free task queue:
🔹 Contention-Free Worker Claiming: Uses PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` inside atomic CTEs to eliminate row lock waiting across concurrent worker JVMs.
🔹 Deficit Round Robin (DRR) Scheduling: Solves the noisy-neighbor problem; benchmarked to slash quiet-tenant starvation latency by 89.8% under synthetic flood bursts.
🔹 Lease Fencing & Crash Recovery: Two-variable fencing tokens (`claim_token` UUID and `claim_version`) prevent zombie worker split-brain writes during failover.
🔹 Transactional Outbox Pattern: Atomic dual-write business persistence with an independent payment receiver enforcing durable idempotency.
🔹 Modern Control Plane: Obsidian Pulse dark-mode dashboard built with React 19, TypeScript, Tailwind 4, and TanStack Query.

Verified with 264 automated tests across backend integration, frontend Vitest, and Playwright browser E2E, containerized into a 7-service topology published to GitHub Container Registry.

Inspect the architecture and benchmarks on GitHub:
👉 https://github.com/saipranav22-commits/queueforge
```

---

## 5. Suggested GitHub Repository Settings

### Repository Description:
```
Resilient distributed task queue & multi-tenant operations console in Java 21, Spring Boot 3, PostgreSQL 16 (SKIP LOCKED), and React 19. Features DRR fair scheduling, lease fencing, and transactional outbox.
```

### Recommended Repository Topics:
```
java
spring-boot
postgresql
distributed-systems
task-queue
job-scheduler
react
typescript
docker
docker-compose
transactional-outbox
idempotency
deficit-round-robin
playwright
tailwind-css
```
