# QueueForge — Resume & Interview Portfolio Content

---

## 1. Project Title & One-Line Description

- **Project Title:** **QueueForge — Resilient Distributed Task Queue & Operations Console**
- **One-Line Description:** *Engineered an ACID-compliant, concurrent background job processing engine with PostgreSQL row-level lock skipping, lease-fencing crash recovery, and an administrative React operations console.*

---

## 2. Technology Stack Tags

`Java 21 LTS` `Spring Boot 3.3.5` `PostgreSQL 16` `Deficit Round Robin (DRR)` `Multi-Tenant Scheduling` `Concurrency Quotas` `Spring Data JPA` `Hibernate 6.5` `Flyway` `React 19` `TypeScript` `Tailwind CSS` `Vite` `Docker` `Nginx` `Prometheus` `Grafana` `Micrometer` `JUnit 5` `Testcontainers` `Playwright` `Vitest`

---

## 3. ATS-Friendly Resume Bullets

### Option A (Backend / Distributed Systems Focus):
> - **Engineered an ACID-compliant distributed task queue** in Java 21 / Spring Boot 3 using PostgreSQL `SELECT FOR UPDATE SKIP LOCKED`, mitigating row-level contention and deadlock bottlenecks across multi-threaded workers via non-blocking lock skipping.
> - **Architected FairShare: a multi-tenant Deficit Round Robin (DRR) scheduler** with cluster-wide tenant concurrency quotas, reducing quiet-tenant starvation wait times by **89.8%** (p50) during noisy-neighbor flood workloads while maintaining work-conserving throughput.
> - **Designed dual-fencing crash recovery** incorporating cryptographic claim tokens, heartbeat-extended leases, and automated background sweepers, mitigating split-brain zombie writes and reclaiming orphaned jobs during worker process crashes with zero concurrency quota leaks.
> - **Implemented an exponential backoff engine with full randomized jitter** ($\pm 20\%$) and error classification taxonomy (`TRANSIENT`, `PERMANENT`, `HANDLER_NOT_FOUND`), integrating an authenticated Dead-Letter Queue (DLQ) with atomic administrative replay and audit-compliant discard APIs.

### Option B (Full-Stack / Systems Engineering Focus):
> - **Architected a containerized asynchronous job engine & developer console** with Spring Boot 3 and React 19, containerized via multi-stage Dockerfiles and Nginx reverse proxy with Content Security Policy, X-Frame-Options, and automated CI pipelines.
> - **Secured multi-tenant operations** with SHA-256 API key hashing, constant-time token verification resistant to timing side-channels, `HttpOnly, SameSite=Lax` session cookies, and double-submit cryptographic CSRF token validation.
> - **Instrumented comprehensive observability** using Micrometer, Prometheus, and Grafana, developing an aggregated 1-second background queue gauge cache that eliminated metric scrape database contention while tracking p50/p95/p99 execution percentiles.

---

## 4. Key Technical Achievements

1. **Decoupled Claim & Execution Architecture:** Database transactions are isolated to the atomic row claim phase ($< 5\text{ ms}$ duration), liberating HikariCP connections while task handlers execute in a bounded JVM thread pool.
2. **Deficit Round Robin Multi-Tenant Fair Scheduling:** Engineered $O(1)$ round-robin deficit allocation combined with PostgreSQL CTE optimization fences and index-only running count scans (`idx_qf_jobs_tenant_running`), achieving perfect contention fairness ($J_{\text{contention}} = 1.000$) and 70.6 jobs/sec throughput.
3. **Deterministic Idempotency:** SHA-256 canonical payload hashing coupled with unique database constraints prevents duplicate execution under network retries and concurrent submissions (HTTP 409 Conflict on payload mismatch).
4. **Rigorous Test Coverage:** **142 backend integration tests** and **10 receiver tests** (100% pass rate) validating concurrency, lock skipping, lease fencing, tenant security, FairShare scheduling, retry backoff, outbox delivery, alongside **7 frontend component tests** and **8 cross-process distributed failure experiments**.
5. **Cross-Process Verification & Concurrency Quotas:** Validated multi-tenant concurrency quotas across two independent JVM worker processes under fault-injection crash conditions with zero quota leaks.
   *(Note: Local benchmark was measured on a single-node Windows/WSL2 Docker container runtime and serves to verify concurrency algorithms, distinct from distributed horizontal cloud benchmarks).*

---

## 5. High-Impact Interview Talking Points

### Talking Point 1: Why PostgreSQL SKIP LOCKED over Redis or RabbitMQ?
- *"In e-commerce and financial systems, background jobs often mutate database state alongside business transactions. Using an external broker requires the 2-Phase Commit (2PC) or an Outbox pattern. By using PostgreSQL as the durable queue, job creation is 100% atomic with the business entity insert in the same ACID transaction. `SKIP LOCKED` removes the historical bottleneck of row contention by allowing concurrent workers to skip already-locked rows without waiting."*

### Talking Point 2: The "Zombie Worker" Problem & Lease Fencing
- *"If Worker A claims a job with a 30-second lease but experiences a 45-second GC pause, the sweeper reclaims the job and Worker B begins processing it. If Worker A wakes up and blindly updates the row, it could overwrite Worker B's progress. We prevent this by issuing a unique `claim_token` UUID on each claim and enforcing `WHERE claim_token = ? AND lease_until >= NOW()`. Worker A's write affects 0 rows, throwing a fencing exception and aborting safely."*

### Talking Point 3: Deficit Round Robin (DRR) vs Weighted Fair Queueing (WFQ) in Relational Databases
- *"WFQ requires computing virtual finish times on every packet or job, which in a relational database demands maintaining monotonically increasing global virtual timestamps across concurrent transactions, causing severe serialization bottlenecks and table bloat. DRR achieves $O(1)$ fair scheduling by distributing discrete quanta to tenant deficit counters in round-robin sweeps. We combine this with CTE optimization fences and tenant row locks to achieve starvation-free multi-tenant execution with negligible database overhead."*

### Talking Point 4: The Closed Drained-Run Trap in Fairness Benchmarks
- *"When benchmarking schedulers under finite workloads (e.g. 1000 jobs vs 20 jobs), measuring Jain's Fairness Index on total completed jobs once the queue is fully drained is a mathematical tautology ($J = 0.233$ for any work-conserving scheduler). True scheduling fairness must be measured across the active contention window while quiet tenants are actively queued. Under DRR, contention fairness is a perfect 1.000 vs 0.233 for FIFO, reducing quiet tenant median queue latency by 89.8%."*

### Talking Point 5: Protecting Downstream Resources with Full Jitter
- *"If a downstream microservice recovers after an outage, standard exponential backoff causes all retrying workers to strike the service in synchronized waves. We implement Full Jitter, multiplying nominal exponential delay by $\text{random}(-0.20, +0.20)$. This uniformly distributes retry traffic over time, flattening traffic spikes and allowing the downstream system to recover."*

### Talking Point 6: The Transactional Outbox & The Two Generals' Fallacy
- *"A common misconception is that a Transactional Outbox provides 'exactly-once delivery'. Across an unreliable network, exactly-once network transport is physically impossible. The outbox guarantees at-least-once delivery; if an HTTP ACK drops after the receiver commits, the sender must retry. To achieve an exactly-once business outcome, consumer-side idempotency with deduplication records and canonical payload fingerprinting is strictly mandatory."*
