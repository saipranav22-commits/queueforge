# QueueForge – Reliable Job Queue with Dead-Letter Recovery

QueueForge is a high-reliability, asynchronous job processing platform engineered with Java 21, Spring Boot 3, and PostgreSQL. It delivers durable at-least-once job execution, priority-based claiming using PostgreSQL's row-level locking (`SELECT FOR UPDATE SKIP LOCKED`), heartbeat leases for crash recovery, exponential backoff retries, and an administrative Dead-Letter Queue (DLQ) with replay capabilities.

---

## Engineering Highlights

- **Durable Persistence Engine:** PostgreSQL acts as the ACID-compliant queue, eliminating the operational complexity of external brokers for moderate to high throughput workloads.
- **Idempotency Protection:** SHA-256 canonical request fingerprinting combined with database unique constraints prevents duplicate execution under retries or concurrent submissions. Conflicting payloads reuse of the same idempotency key are rejected with `409 Conflict`.
- **Contention-Free Concurrency (`SKIP LOCKED`):** Multiple workers claim batches of prioritized jobs using `SELECT FOR UPDATE SKIP LOCKED`, preventing locking bottlenecks across concurrent worker threads.
- **Claim Token & Fencing Protection:** Every claim transaction assigns a unique random `claim_token` UUID and increments `claim_version`. Stale workers whose lease expired can never overwrite the state of a newer worker.
- **Decoupled Claim & Execution:** Database locks are held strictly during the microsecond claim transaction and released immediately before business logic executes in a bounded thread pool.
- **Worker Crash Resilience:** Leases with periodic heartbeats detect worker node/thread failure and automatically requeue orphaned jobs.
- **Strict Drive Isolation:** Development environment runs with complete isolation on `D:` drive (JDK 21, Maven 3.9, Maven repository, temp directories, Docker volumes, and caches).

---

## Technology Stack

- **Runtime & Framework:** Java 21 LTS (Eclipse Temurin), Spring Boot 3.3.5
- **Persistence & Migrations:** Spring Data JPA, Hibernate 6.5, PostgreSQL 16, Flyway 10
- **Build & Quality:** Apache Maven 3.9.16, JUnit 5, Mockito, Testcontainers
- **Infrastructure:** Docker Compose (PostgreSQL 16 on port 5435 with volume on `D:\Projects\QueueForge\data\postgres`)

---

## Quickstart & Environment Activation

### 1. Activate Environment (PowerShell)
All tools, JVM temp files, and caches are pinned strictly to `D:` to avoid writing to system partitions.
```powershell
# Dot-source the environment configuration into your current PowerShell session
. .\env.ps1
```

### 2. Start PostgreSQL via Docker Compose
Starts PostgreSQL 16 on port `5435` with persistent data on `D:\Projects\QueueForge\data\postgres`.
```powershell
docker compose up -d
```

### 3. Build & Run Tests
```powershell
cd backend
mvn clean test
```

### 4. Start Spring Boot Application
```powershell
cd backend
mvn spring-boot:run
```
*(Application runs on port `8085` by default)*

---

## Worker Engine Architecture & Interview Guide

### 1. The Core Lifecycle
```
PENDING JOB
    ↓
1. Transactional Claim (SELECT FOR UPDATE SKIP LOCKED)
    ↓
2. RUNNING + Unique claim_token + lease_until
    ↓
3. Commit Claim Transaction (Database lock released!)
    ↓
4. Execute JobHandler outside DB transaction (bounded thread pool)
    ↓
5. Guarded Completion Update (WHERE id = ? AND claim_token = ? AND status = 'RUNNING')
    ↓
COMPLETED + Audit Log
```

### 2. Why `SELECT FOR UPDATE SKIP LOCKED`?
In standard `SELECT FOR UPDATE`, multiple concurrent workers competing for the highest-priority jobs block waiting for Worker 1's transaction to commit. This creates severe database lock contention and serialization deadlocks.
With `SKIP LOCKED`, PostgreSQL skips rows already locked by other transactions. Worker 1 locks jobs 1–5, Worker 2 simultaneously locks jobs 6–10 without blocking, achieving true non-blocking horizontal scaling across worker threads.

### 3. Why Release DB Locks Before Execution?
If a worker holds an open database transaction while executing long-running business logic (e.g. generating a 30-second report or calling an external API), it holds a database connection from the HikariCP pool and database locks for the entire 30 seconds. A handful of tasks would exhaust the database pool.
QueueForge holds the DB transaction for **< 2 milliseconds** to transition the row to `RUNNING` and assign a `claim_token`. The connection is immediately returned to the pool while the worker thread executes independently.

### 4. How Claim Tokens Protect Against Stale Workers (Fencing)
Suppose Worker A claims Job 1 with `claim_token = UUID_A` and a 30-second lease. Worker A experiences a massive GC pause or network stall lasting 45 seconds.
1. The lease expires (`lease_until < NOW()`).
2. The `LeaseRecoverySweeper` reclaims Job 1 back to `PENDING`.
3. Worker B claims Job 1 with a new `claim_token = UUID_B`.
4. Worker A wakes up and attempts to complete the job.
5. Worker A executes:
   ```sql
   UPDATE qf_jobs SET status = 'COMPLETED' WHERE id = 'Job1' AND claim_token = 'UUID_A' AND status = 'RUNNING';
   ```
6. The query matches 0 rows! Worker A is **fenced out** and cannot overwrite the work of Worker B.

### 5. What "At-Least-Once" Semantics Means
Because network partitions or JVM crashes can occur after business logic executes but before the completion query commits, a job may be re-executed by another worker. QueueForge guarantees that no job is silently lost (**at-least-once**), requiring job handlers to be designed **idempotently**.

---

## API Documentation

### 1. Submit Job (`POST /api/v1/jobs`)
Submits a job for durable asynchronous processing. Persisted to PostgreSQL before returning `202 Accepted`.

- **Headers:** `Idempotency-Key` (Optional, up to 128 characters)
- **Request Body:**
```json
{
  "jobType": "GENERATE_REPORT",
  "payload": {
    "reportName": "quarterly-sales",
    "format": "PDF"
  },
  "priority": 85,
  "maxRetries": 3,
  "delaySeconds": 0
}
```
- **Response (202 Accepted):**
```json
{
  "jobId": "8f2ec480-5045-4cd4-a803-2ad6a991e3cd",
  "status": "PENDING",
  "createdAt": "2026-11-16T10:59:15.711227300Z",
  "scheduledAt": "2026-11-16T10:59:15.711227300Z"
}
```

### 2. Retrieve Job Status (`GET /api/v1/jobs/{jobId}`)
- **Response (200 OK):**
```json
{
  "jobId": "8f2ec480-5045-4cd4-a803-2ad6a991e3cd",
  "jobType": "GENERATE_REPORT",
  "status": "COMPLETED",
  "priority": 90,
  "retryCount": 1,
  "maxRetries": 3,
  "scheduledAt": "2026-11-16T10:59:15.711227Z",
  "createdAt": "2026-11-16T10:59:15.711227Z",
  "completedAt": "2026-11-16T10:59:16.132207Z"
}
```

---

## Roadmap

- [x] **Phase 1A:** Safe Workspace Initialization & Environment Isolation
- [x] **Phase 1B:** Database Containerization & Backend Integration
- [x] **Phase 1C:** Job Submission, Idempotency & Status Retrieval API
- [x] **Phase 2A:** Concurrent Worker Engine, `SKIP LOCKED` Claiming & Fenced Leases
- [ ] **Phase 2B/3:** Exponential Backoff with Jitter, Dead-Letter Queue & Administrative Replay
- [ ] **Phase 4:** Observability, Metrics (Actuator/Prometheus) & React Admin Dashboard
