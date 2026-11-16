# QueueForge – Reliable Job Queue with Dead-Letter Recovery

QueueForge is a high-reliability, asynchronous job processing platform engineered with Java 21, Spring Boot 3, and PostgreSQL. It delivers durable at-least-once job execution, priority-based claiming using PostgreSQL's row-level locking (`SELECT FOR UPDATE SKIP LOCKED`), heartbeat leases for crash recovery, exponential backoff retries, and an administrative Dead-Letter Queue (DLQ) with replay capabilities.

---

## Engineering Highlights

- **Durable Persistence Engine:** PostgreSQL acts as the ACID-compliant queue, eliminating the operational complexity of external brokers for moderate to high throughput workloads.
- **Idempotency Protection:** SHA-256 canonical request fingerprinting combined with database unique constraints prevents duplicate execution under retries or concurrent submissions. Conflicting payloads reuse of the same idempotency key are rejected with `409 Conflict`.
- **Contention-Free Concurrency:** Workers claim batches of prioritized jobs using `SELECT FOR UPDATE SKIP LOCKED`, preventing locking bottlenecks across concurrent worker threads.
- **Worker Crash Resilience:** Leases with heartbeats detect worker node/thread failure and automatically requeue orphaned jobs.
- **Exponential Backoff with Full Jitter:** Prevents thundering-herd retry storms against downstream dependencies.
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
  "jobId": "e37db3e7-7358-476a-80ec-29977687ad11",
  "status": "PENDING",
  "createdAt": "2026-11-16T07:09:17.173231400Z",
  "scheduledAt": "2026-11-16T07:09:17.173231400Z"
}
```

### 2. Retrieve Job Status (`GET /api/v1/jobs/{jobId}`)
- **Response (200 OK):**
```json
{
  "jobId": "e37db3e7-7358-476a-80ec-29977687ad11",
  "jobType": "GENERATE_REPORT",
  "status": "PENDING",
  "priority": 85,
  "retryCount": 0,
  "maxRetries": 3,
  "scheduledAt": "2026-11-16T07:09:17.173231Z",
  "createdAt": "2026-11-16T07:09:17.173231Z"
}
```
- **Response for Unknown ID (404 Not Found):**
```json
{
  "timestamp": "2026-11-16T07:09:17.766618600Z",
  "status": 404,
  "error": "Not Found",
  "message": "Job with ID '00000000-0000-0000-0000-000000000000' was not found",
  "path": "/api/v1/jobs/00000000-0000-0000-0000-000000000000"
}
```

---

## Idempotency Design & Technical Tradeoffs

1. **Fingerprint Calculation:**
   QueueForge computes a deterministic SHA-256 hash across canonical request parameters:
   $$\text{Fingerprint} = \text{SHA-256}\left(\text{TYPE} \parallel \text{PRIORITY} \parallel \text{RETRIES} \parallel \text{DELAY} \parallel \text{CANONICAL\_PAYLOAD}\right)$$
2. **Behavior on Repeat Submissions:**
   - **Identical Request + Same Key:** Returns HTTP `202 Accepted` with the original job's ID and timestamps. Zero duplicate database rows are created.
   - **Different Request + Same Key:** Returns HTTP `409 Conflict` preventing dangerous payload mutation under an existing idempotency key.
3. **Concurrency Protection:**
   The `idempotency_key` column is protected by a PostgreSQL `UNIQUE` constraint. When concurrent identical requests race to insert:
   - One wins and commits.
   - The concurrent transactions catch the database `DataIntegrityViolationException`, query the committed row, verify the fingerprint, and safely return HTTP `202 Accepted` with the existing job ID.
   - This eliminates race conditions without distributed locks.

---

## Roadmap

- [x] **Phase 1A:** Safe Workspace Initialization & Environment Isolation
- [x] **Phase 1B:** Database Containerization & Backend Integration
- [x] **Phase 1C:** Job Submission, Idempotency & Status Retrieval API
- [ ] **Phase 2:** Concurrent Worker Engine, `SKIP LOCKED` Claiming & Lease Recovery
- [ ] **Phase 3:** Exponential Backoff, Dead-Letter Queue & Administrative Replay
- [ ] **Phase 4:** Observability, Metrics (Actuator/Prometheus) & React Admin Dashboard
