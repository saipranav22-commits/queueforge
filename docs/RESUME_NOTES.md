# QueueForge — Resume & Interview Portfolio Content

---

## 1. Project Title & One-Line Description

- **Project Title:** **QueueForge — Resilient Distributed Task Queue & Operations Console**
- **One-Line Description:** *Engineered an ACID-compliant, concurrent background job processing engine with PostgreSQL row-level lock skipping, lease-fencing crash recovery, and an administrative React operations console.*

---

## 2. Technology Stack Tags

`Java 21 LTS` `Spring Boot 3.3.5` `PostgreSQL 16` `Spring Data JPA` `Hibernate 6.5` `Flyway` `React 19` `TypeScript` `Tailwind CSS` `Vite` `Docker` `Nginx` `Prometheus` `Grafana` `Micrometer` `JUnit 5` `Testcontainers` `Playwright` `Vitest`

---

## 3. ATS-Friendly Resume Bullets

### Option A (Backend / Distributed Systems Focus):
> - **Engineered an ACID-compliant distributed task queue** in Java 21 / Spring Boot 3 using PostgreSQL `SELECT FOR UPDATE SKIP LOCKED`, achieving contention-free concurrent job claiming across multi-threaded workers with zero deadlock overhead.
> - **Designed dual-fencing crash recovery** incorporating cryptographic claim tokens, heartbeat-extended leases, and automated background sweepers, preventing split-brain zombie writes and eliminating orphaned jobs during worker process crashes.
> - **Implemented an exponential backoff engine with full randomized jitter** ($\pm 20\%$) and error classification taxonomy (`TRANSIENT`, `PERMANENT`, `HANDLER_NOT_FOUND`), integrating an authenticated Dead-Letter Queue (DLQ) with atomic administrative replay and audit-compliant discard APIs.

### Option B (Full-Stack / Systems Engineering Focus):
> - **Architected a production-ready asynchronous job engine & developer console** with Spring Boot 3 and React 19, containerized via multi-stage Dockerfiles and Nginx reverse proxy with Content Security Policy, X-Frame-Options, and automated CI pipelines.
> - **Secured administrative queue operations** with `HttpOnly, SameSite=Lax` session cookies, constant-time API key verification, and double-submit cryptographic CSRF token validation, enforcing role-based sensitive field masking for anonymous viewers.
> - **Instrumented comprehensive observability** using Micrometer, Prometheus, and Grafana, developing an aggregated 1-second background queue gauge cache that eliminated metric scrape database contention while tracking p50/p95/p99 execution percentiles.

---

## 4. Key Technical Achievements

1. **Decoupled Claim & Execution Architecture:** Database transactions are isolated to the atomic row claim phase ($< 5\text{ ms}$ duration), liberating HikariCP connections while task handlers execute in an unbound JVM thread pool.
2. **Deterministic Idempotency:** SHA-256 canonical payload hashing coupled with unique database constraints prevents duplicate execution under network retries and concurrent submissions (HTTP 409 Conflict on payload mismatch).
3. **Rigorous Test Coverage:** **73 backend integration tests** (100% pass rate) validating concurrency, lock skipping, lease fencing, and retry backoff, alongside **7 frontend component tests** and **16 browser E2E Playwright verification scenarios**.
4. **Local Controlled Benchmark:** Validated 40-job concurrent burst processing on a 4-thread worker pool, sustaining 25.33 submissions/sec and 19.43 completions/sec with median execution latency of 4.43 ms and zero connection pool exhaustion.
   *(Note: Local benchmark was measured on a single-node Windows/WSL2 Docker container runtime and serves to verify concurrency algorithms, distinct from distributed horizontal cloud benchmarks).*

---

## 5. High-Impact Interview Talking Points

### Talking Point 1: Why PostgreSQL SKIP LOCKED over Redis or RabbitMQ?
- *"In e-commerce and financial systems, background jobs often mutate database state alongside business transactions. Using an external broker requires the 2-Phase Commit (2PC) or an Outbox pattern. By using PostgreSQL as the durable queue, job creation is 100% atomic with the business entity insert in the same ACID transaction. `SKIP LOCKED` removes the historical bottleneck of row contention by allowing concurrent workers to skip already-locked rows without waiting."*

### Talking Point 2: The "Zombie Worker" Problem & Lease Fencing
- *"If Worker A claims a job with a 30-second lease but experiences a 45-second GC pause, the sweeper reclaims the job and Worker B begins processing it. If Worker A wakes up and blindly updates the row, it could overwrite Worker B's progress. We prevent this by issuing a unique `claim_token` UUID on each claim and enforcing `WHERE claim_token = ? AND lease_until >= NOW()`. Worker A's write affects 0 rows, throwing a fencing exception and aborting safely."*

### Talking Point 3: Protecting Downstream Resources with Full Jitter
- *"If a downstream microservice recovers after an outage, standard exponential backoff causes all retrying workers to strike the service in synchronized waves. We implement Full Jitter, multiplying nominal exponential delay by $\text{random}(-0.20, +0.20)$. This uniformly distributes retry traffic over time, flattening traffic spikes and allowing the downstream system to recover."*
