# QueueForge V2 — Recruiter & Engineering Demonstration Scripts

**Author**: Technical Product Presenter & Staff Distributed Systems Engineer  
**Date**: November 2026  
**Target Audience**: Engineering Recruiters, Hiring Managers, Senior Backend & Platform Engineers  

---

## 1. Executive Presentation Positioning

QueueForge is a production-grade distributed task execution engine and operations console built with **Java 21**, **Spring Boot 3**, **PostgreSQL 16**, and **React 19 (Obsidian Pulse)**. 

It solves the two most common pitfalls in modern distributed systems:
1. **The Dual-Write Problem**: Ensuring database changes and outbound message broker events never fall out of sync.
2. **The Noisy-Neighbor Problem**: Ensuring aggressive high-volume tenants cannot starve quiet, interactive tenants of worker execution capacity.

---

## 2. Format A: 60–90 Second Elevator Pitch (High-Impact Showcase)

**Goal**: Deliver a crisp, memorable overview of why QueueForge is technically distinct from standard portfolio web apps.

> **[0:00 - 0:15] The Hook & Problem**  
> *"Most asynchronous background queues rely on external message brokers like RabbitMQ or Redis. But in transaction-heavy domains like billing or order fulfillment, publishing to an external broker creates the classic dual-write problem: what happens if the database commits, but the network crashes before the message is published? Data becomes permanently inconsistent."*

> **[0:15 - 0:35] The Architectural Solution**  
> *"I built QueueForge V2 to solve this using pure PostgreSQL ACID primitives. Instead of an external broker, QueueForge uses PostgreSQL row-level lock skipping—`SELECT FOR UPDATE SKIP LOCKED`—allowing multiple independent worker nodes to claim jobs concurrently with zero lock contention and sub-millisecond overhead."*

> **[0:35 - 0:55] Live System Tour (Obsidian Pulse UI)**  
> *"Here on the **Mission Control** dashboard, you can see our live multi-instance cluster. In the **Worker Fleet** view, two independent worker JVMs actively register heartbeats in PostgreSQL with cryptographic lease fencing to prevent split-brain execution.*  
> *Under **FairShare**, our Deficit Round Robin scheduler partitions tenant workloads, slashing quiet-tenant starvation latency by **89.8%** during burst floods.*  
> *And in the **Event Pipeline**, our transactional outbox relays critical payment charges to an independent microservice, which deduplicates replayed messages with durable idempotency keys."*

> **[0:55 - 1:15] Quality & Engineering Rigor**  
> *"The entire system is verified by a 6-job cloud CI pipeline with 164 backend integration tests against real PostgreSQL testcontainers, 8 multi-worker Docker smoke stages, and 20 Playwright browser tests. QueueForge delivers the transactional safety of a relational database with the horizontal concurrency of a distributed queue."*

---

## 3. Format B: 4–5 Minute Deep-Dive Engineering Walkthrough

**Goal**: Technical deep-dive for senior engineering interviewers to discuss trade-offs, edge cases, and failure recovery.

### Scene 1: Distributed Worker Claiming & Dual-Fencing (1 min)
- **Show Screen**: [Worker Fleet Page](file:///D:/Projects/QueueForge/frontend/src/pages/WorkersPage.tsx)
- **Talking Point**:
  *"Notice our two worker instances: `worker-v2-node-1` and `worker-v2-node-2`. Each worker is a separate Java 21 process running in its own container.*  
  *When workers poll for work, they execute a single atomic SQL query using `FOR UPDATE SKIP LOCKED`. If Worker 1 claims Job #101, PostgreSQL locks that row and instructs Worker 2's query to immediately skip to the next available job without blocking.*  
  *To prevent split-brain execution if a worker experiences a long GC pause or network partition, every claim increments a monotonic `fencing_token`. When a worker completes a job, its update statement checks `WHERE fencing_token = :token`. If an expired lease was reclaimed by another worker, the stale worker's commit is safely rejected."*

### Scene 2: FairShare Multi-Tenant DRR Scheduling (1 min)
- **Show Screen**: [FairShare Page](file:///D:/Projects/QueueForge/frontend/src/pages/FairSharePage.tsx)
- **Talking Point**:
  *"In typical FIFO queues, if Tenant A submits 10,000 batch report jobs, Tenant B's interactive 50ms user job gets stuck waiting at the end of the queue.*  
  *QueueForge implements a Deficit Round Robin (DRR) scheduling algorithm. Each tenant has a configured weight and quantum allowance. In our benchmark tests (Profile 3: Noisy Neighbor with 1 noisy tenant and 4 quiet tenants), quiet-tenant median queue wait time dropped from 11,868 ms down to 1,210 ms—an **89.8% reduction in starvation latency**—while maintaining 100% throughput utilization."*

### Scene 3: Transactional Outbox & Idempotent Consumer (1 min)
- **Show Screen**: [Event Pipeline Page](file:///D:/Projects/QueueForge/frontend/src/pages/EventPipelinePage.tsx)
- **Talking Point**:
  *"When a worker finishes processing an order, it must notify our external payment microservice. If we make an HTTP call inside the database transaction, we risk holding DB connections open. If we make the call after committing, a crash causes a lost message.*  
  *QueueForge uses the **Transactional Outbox Pattern**: the business update and the outbox event are inserted in the exact same local ACID transaction. An asynchronous dispatcher thread then relays the event to our simulated payment receiver with pre-shared service key authentication and constant-time token verification.*  
  *If the receiver processes the charge but the network ACK drops, the dispatcher retries. The receiver computes an SHA-256 fingerprint of the order payload and stores it with an idempotency key. When the retry arrives, the receiver detects the duplicate and returns `idempotentReplay: true` without double-charging."*

### Scene 4: Reliability Lab & Chaos Testing (1 min)
- **Show Screen**: [Reliability Lab Page](file:///D:/Projects/QueueForge/frontend/src/pages/ReliabilityLabPage.tsx) & [Dead-Letter Queue Page](file:///D:/Projects/QueueForge/frontend/src/pages/DlqPage.tsx)
- **Talking Point**:
  *"To prove the system recovers from catastrophic failures, we built an automated ChaosLab harness. We test four specific fault scenarios in CI:*  
  *1. Worker crash immediately after claiming a job.*  
  *2. Simulated payment gateway 503 outage triggering exponential backoff.*  
  *3. Poison-pill jobs triggering truncated stacktraces and automatic dead-letter queue (DLQ) isolation after 3 failed attempts.*  
  *4. Split-brain lease recovery where an active worker rescues abandoned jobs.*  
  *In the DLQ console, administrators can inspect the failure diagnostics, replay the job with updated parameters, or safely purge it."*

---

## 4. Key Questions & Rebuttals for Interviews

| Interviewer Question | Technical Response |
|---|---|
| **"Why not just use Kafka or RabbitMQ?"** | *"Kafka is fantastic for immutable event streaming, and RabbitMQ is great for complex message routing. However, both require managing an external cluster, coordinating dual writes with two-phase commit, and handling out-of-order execution across partitions. QueueForge is intentionally designed for transactional business domains where the database is already PostgreSQL. By leveraging `SKIP LOCKED`, we achieve zero external operational dependencies, perfect ACID consistency, and sub-millisecond claiming for queues under 100,000 active jobs."* |
| **"Doesn't polling PostgreSQL cause heavy database CPU load?"** | *"In V1, tight polling loops could generate load. In V2, we optimized this: workers use adaptive exponential backoff when queues are idle (polling interval drops from 200ms to 2000ms), and queries are strictly index-accelerated compound B-trees (`idx_qf_jobs_fair_share`). Database CPU in our 4-worker cluster remains below 4% under idle conditions."* |
| **"How do you handle a worker node dying mid-task?"** | *"Worker instances report dynamic heartbeats every 3 seconds to `qf_worker_heartbeats`. If a worker's heartbeat is older than the lease timeout (10 seconds), the cluster coordinator marks the worker as dead. A recovery scanner resets the job state to `PENDING` and increments the retry count. The dual-fencing token prevents the dead worker from updating the job if it wakes up from a deep pause."* |
