# QueueForge – Reliable Job Queue with Dead-Letter Recovery

QueueForge is a high-reliability, asynchronous job processing platform engineered with Java 21, Spring Boot 3, and PostgreSQL. It delivers durable at-least-once job execution, priority-based claiming using PostgreSQL's row-level locking (`SELECT FOR UPDATE SKIP LOCKED`), heartbeat leases for crash recovery, exponential backoff retries with full jitter, error classification, and a secure administrative Dead-Letter Queue (DLQ) with atomic replay and discard capabilities.

---

## Engineering Highlights

- **Durable Persistence Engine:** PostgreSQL acts as the ACID-compliant queue, eliminating the operational complexity of external brokers for moderate to high throughput workloads.
- **Idempotency Protection:** SHA-256 canonical request fingerprinting combined with database unique constraints prevents duplicate execution under retries or concurrent submissions. Conflicting payloads reusing the same idempotency key are rejected with `409 Conflict`.
- **Contention-Free Concurrency (`SKIP LOCKED`):** Multiple workers claim batches of prioritized jobs using `SELECT FOR UPDATE SKIP LOCKED`, preventing locking bottlenecks across concurrent worker threads.
- **Claim Token & Fencing Protection:** Every claim transaction assigns a unique random `claim_token` UUID and increments `claim_version`. Stale workers whose lease expired can never overwrite the state of a newer worker or alter rows (`lease_until >= CURRENT_TIMESTAMP`).
- **Decoupled Claim & Execution:** Database locks are held strictly during the microsecond claim transaction and released immediately before business logic executes in a bounded thread pool.
- **Worker Crash Resilience:** Leases with periodic heartbeats detect worker node/thread failure and automatically requeue orphaned jobs.
- **Exponential Backoff with Full Jitter:** Retry delays scale exponentially ($\text{initialDelay} \times \text{multiplier}^{r-1}$) with randomized jitter to prevent the "thundering herd" problem on downstream resources.
- **Strict Error Classification:** Differentiates between `TRANSIENT_FAILURE` (retried with backoff), `PERMANENT_FAILURE` (immediate DLQ), `HANDLER_NOT_FOUND` (immediate DLQ), and `LEASE_EXPIRED`.
- **Secure Administrative DLQ Management:** Protected with `X-Admin-Key` header authentication. Provides paginated inspection, single-job diagnostic drilldown, atomic safe replay (returning jobs to `PENDING`), and audit-compliant discard (archiving without hard delete).
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

## Architecture & Interview Guide

### 1. The Core Lifecycle
```
PENDING JOB
    ↓
1. Transactional Claim (SELECT FOR UPDATE SKIP LOCKED)
   - Increments attempt_count (initial = 1, 1st retry = 2)
   - Computes retry_count (initial = 0, 1st retry = 1)
   - Assigns claim_token UUID and sets lease_until
    ↓
2. Commit Claim Transaction (Database lock released!)
    ↓
3. Execute JobHandler outside DB transaction (bounded thread pool)
    ↓
   ├── Success ──> Guarded Completion Update (status = 'COMPLETED')
   │
   ├── Transient Exception ──> Has retries left?
   │                            ├── Yes ──> Exponential Backoff (status = 'PENDING', scheduled_at = NOW() + delay)
   │                            └── No  ──> Exhausted ──> DEAD_LETTER (category = 'TRANSIENT_FAILURE')
   │
   └── Permanent Exception / Missing Handler ──> Immediate DEAD_LETTER (category = 'PERMANENT_FAILURE' / 'HANDLER_NOT_FOUND')
```

### 2. Attempt vs. Retry Accounting
QueueForge distinguishes explicitly between attempts started and retries executed:
- **`attempt_count`**: Total execution attempts initiated. Initial claim is attempt 1.
- **`retry_count`**: Retries attempted *after* the initial execution. Initial claim has retry count 0.
- **`max_retries`**: Maximum additional retries allowed. A job with `max_retries = 3` allows up to $3 + 1 = 4$ total execution attempts.

On atomic claim:
```sql
UPDATE qf_jobs
SET status = 'RUNNING',
    attempt_count = attempt_count + 1,
    retry_count = CASE WHEN attempt_count = 0 THEN 0 ELSE retry_count + 1 END,
    ...
```

### 3. Exponential Backoff Formula
$$\text{Nominal Delay}(r) = \min\left(\text{maxDelay},\ \text{initialDelay} \times \text{multiplier}^{r-1}\right)$$
$$\text{Jitter} = \text{Nominal Delay} \times \text{jitterFactor} \times \text{random}(-1.0,\ +1.0)$$
$$\text{Final Delay} = \max(1,\ \text{round}(\text{Nominal Delay} + \text{Jitter}))$$

Default configuration:
- `initialDelay`: 5 seconds
- `multiplier`: 3.0
- `maxDelay`: 3600 seconds (1 hour)
- `jitterFactor`: 0.20 ($\pm 20\%$)

Progression:
- Retry 1: $5 \times 3^0 = 5\text{s} \pm 20\% \implies [4\text{s}, 6\text{s}]$
- Retry 2: $5 \times 3^1 = 15\text{s} \pm 20\% \implies [12\text{s}, 18\text{s}]$
- Retry 3: $5 \times 3^2 = 45\text{s} \pm 20\% \implies [36\text{s}, 54\text{s}]$
- Retry 4: $5 \times 3^3 = 135\text{s} \pm 20\% \implies [108\text{s}, 162\text{s}]$

### 4. Fencing & Active Lease Guard
To eliminate race conditions when a worker experiences long GC pauses or network delays:
1. `completeJob`, `failJob`, and `extendLease` are guarded by:
   ```sql
   WHERE id = ?
     AND status = 'RUNNING'
     AND claim_token = ?
     AND (lease_until IS NULL OR lease_until >= CURRENT_TIMESTAMP)
   ```
2. If a worker's lease expired before it attempts to write, the update matches 0 rows and fails safely.

### 5. Error Classification Taxonomy
| Category | Cause | Action |
|---|---|---|
| `TRANSIENT_FAILURE` | Network blip, database lock timeout, 503 Service Unavailable | Retried with exponential backoff until `retry_count >= max_retries`, then `DEAD_LETTER` |
| `PERMANENT_FAILURE` | Unparseable schema, invalid business domain rule, 4xx Bad Request | Immediately routes to `DEAD_LETTER` without wasting retry quota |
| `HANDLER_NOT_FOUND` | No registered handler for job type | Immediately routes to `DEAD_LETTER` |
| `LEASE_EXPIRED` | Worker crashed or abandoned execution | Sweeper reclaims to `PENDING` (or `DEAD_LETTER` if retries exhausted) |

---

## API Documentation

### Public Job APIs

#### 1. Submit Job (`POST /api/v1/jobs`)
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
  "createdAt": "2026-11-16T10:59:15.711227Z",
  "scheduledAt": "2026-11-16T10:59:15.711227Z"
}
```

#### 2. Retrieve Job Status (`GET /api/v1/jobs/{jobId}`)
- **Response (200 OK):**
```json
{
  "jobId": "8f2ec480-5045-4cd4-a803-2ad6a991e3cd",
  "jobType": "GENERATE_REPORT",
  "status": "COMPLETED",
  "priority": 85,
  "attemptCount": 1,
  "retryCount": 0,
  "maxRetries": 3,
  "scheduledAt": "2026-11-16T10:59:15.711227Z",
  "createdAt": "2026-11-16T10:59:15.711227Z",
  "completedAt": "2026-11-16T10:59:16.132207Z"
}
```

---

### Admin Dead-Letter Queue (DLQ) APIs
*All `/api/v1/admin/**` endpoints require the `X-Admin-Key` header.*

#### 3. List DLQ Jobs (`GET /api/v1/admin/dlq`)
- **Headers:** `X-Admin-Key: <ADMIN_API_KEY>`
- **Query Parameters:** `page=0`, `size=20`, `jobType` (optional), `failureCategory` (optional)
- **Response (200 OK):**
```json
{
  "content": [
    {
      "jobId": "f4a716f4-8224-4409-839c-70736d2e8b4a",
      "jobType": "SEND_EMAIL",
      "status": "DEAD_LETTER",
      "attemptCount": 1,
      "retryCount": 0,
      "maxRetries": 2,
      "failureCategory": "HANDLER_NOT_FOUND",
      "lastErrorMessage": "No registered handler found for job type: 'SEND_EMAIL'",
      "createdAt": "2026-11-16T16:06:17.112Z",
      "scheduledAt": "2026-11-16T16:06:17.112Z",
      "updatedAt": "2026-11-16T16:06:17.135Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

#### 4. Get DLQ Job Diagnostics (`GET /api/v1/admin/dlq/{jobId}`)
- **Headers:** `X-Admin-Key: <ADMIN_API_KEY>`
- **Response (200 OK):** Returns complete payload, error message, stack trace, and execution metrics.

#### 5. Replay DLQ Job (`POST /api/v1/admin/dlq/{jobId}/replay`)
- **Headers:** `X-Admin-Key: <ADMIN_API_KEY>`
- Atomically resets status to `PENDING`, sets `scheduled_at = NOW()`, clears failure diagnostics, and resets attempt/retry counters.
- **Response (200 OK):**
```json
{
  "jobId": "f4a716f4-8224-4409-839c-70736d2e8b4a",
  "status": "PENDING",
  "message": "Job successfully returned to PENDING queue for replay"
}
```

#### 6. Discard DLQ Job (`POST /api/v1/admin/dlq/{jobId}/discard`)
- **Headers:** `X-Admin-Key: <ADMIN_API_KEY>`
- Atomically transitions job to `ARCHIVED`. Never hard-deletes, retaining full historical audit records.
- **Response (200 OK):**
```json
{
  "jobId": "f4a716f4-8224-4409-839c-70736d2e8b4a",
  "status": "ARCHIVED",
  "message": "Job successfully discarded and archived"
}
```

---

## Observability, Metrics & Telemetry (Phase 3)

QueueForge is instrumented for production-grade operational visibility with Spring Boot Actuator, Micrometer, Prometheus, and Grafana.

### 1. Actuator Health Probes

QueueForge strictly distinguishes between container **Liveness** and **Readiness**:

| Endpoint | Purpose | Included Components | Production Recovery Action |
|---|---|---|---|
| `GET /actuator/health/liveness` | Determines if the JVM process is alive or deadlocked | `livenessState` | If `DOWN`, orchestrator (Kubernetes/Docker) **restarts** the container. |
| `GET /actuator/health/readiness` | Determines if the instance is healthy enough to accept traffic | `readinessState`, `db`, `queueForgeWorker` | If `DOWN`, ingress/load balancer **stops routing traffic** to this instance without restarting the process. |
| `GET /actuator/health` | Comprehensive health report | All system indicators and components | General monitoring and diagnostics. |

### 2. Custom Metrics Dictionary

All metrics are exposed under standard Prometheus naming conventions at `GET /actuator/prometheus`:

#### A. Durable Queue Gauges
*Performance Safeguard: Queue gauges do NOT query PostgreSQL on every Prometheus scrape. A single aggregated `GROUP BY status` query refreshes counts at most once per second in the background.*

- `queueforge_jobs_pending`: Current count of pending jobs in PostgreSQL awaiting worker claim.
- `queueforge_jobs_running`: Current count of jobs under active worker leases.
- `queueforge_jobs_completed`: Total count of successfully completed jobs in persistent store.
- `queueforge_jobs_dead_letter`: Current count of jobs in Dead-Letter Queue requiring administrative review.
- `queueforge_workers_active`: Number of worker threads currently executing jobs in the worker pool.

#### B. Throughput & Error Counters
*Tag Cardinality Safeguard: All tags have strictly bounded cardinality (`job_type`, `failure_category`, `recovery_type`, `status`). High-cardinality identifiers like job UUIDs or payloads are never tagged.*

- `queueforge_jobs_submitted_total{job_type}`: Monotonically increasing count of submitted jobs.
- `queueforge_jobs_completed_total{job_type}`: Count of successfully processed jobs.
- `queueforge_jobs_failed_total{job_type, failure_category}`: Count of failed executions categorized by failure type.
- `queueforge_jobs_retried_total{job_type}`: Count of retries scheduled with exponential backoff.
- `queueforge_jobs_recovered_total{recovery_type}`: Count of recovered jobs (`admin_replay` or `lease_sweeper`).

#### C. Latency & Wait Timers
- `queueforge_job_execution_duration_seconds{job_type, status}`: Timer measuring execution duration of job handlers with percentiles (p50, p95, p99).
- `queueforge_job_queue_wait_duration_seconds{job_type}`: Timer measuring duration a job spent waiting in `PENDING` before being claimed by a worker.

### 3. Structured Logging with MDC Correlation

Every log statement emitted during job processing includes SLF4J Mapped Diagnostic Context (MDC) fields:
- `jobId`: The UUID of the job being processed (or `NONE`).
- `workerId`: The name of the worker thread executing the job (e.g. `qf-worker-1`).
- `attempt`: Current attempt number (1, 2, ...).

Log Format Pattern:
```
%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} [jobId=%X{jobId:-NONE} worker=%X{workerId:-NONE} attempt=%X{attempt:-0}] - %msg%n
```

Log File Destination:
`D:\Projects\QueueForge\logs\queueforge.log` (persisted strictly to D: drive).

### 4. Local Monitoring Stack (Prometheus & Grafana)

The monitoring stack runs in isolated Docker containers with persistent data on `D:`:
- **Prometheus:** `http://127.0.0.1:9090` (persistent data on `D:\Projects\QueueForge\data\prometheus`)
- **Grafana:** `http://127.0.0.1:3000` (persistent data on `D:\Projects\QueueForge\data\grafana`)
  - Hardened access: Anonymous access disabled (`GF_AUTH_ANONYMOUS_ENABLED=false`)
  - Admin credentials configured via git-ignored `.env` (`GRAFANA_ADMIN_USER=qf_admin`)
  - Auto-provisioned Datasource: Prometheus (`http://prometheus:9090`)
  - Auto-provisioned Dashboard: **QueueForge Engine Overview** (`queueforge-overview`) with 10 panels:
    1. *Pending Jobs* (Stat / Gauge)
    2. *Running Jobs (Active Leases)* (Stat / Gauge)
    3. *Active Worker Threads* (Stat / Gauge)
    4. *Dead-Letter Jobs (DLQ)* (Stat / Gauge)
    5. *Total Completed Jobs* (Stat / Gauge)
    6. *Job Throughput (Submissions vs Completions)* (Time series)
    7. *Job Failure Rate by Category* (Time series)
    8. *Retried vs Recovered Rate* (Time series)
    9. *Execution Latency Percentiles (p50, p95, p99)* (Time series)
    10. *Queue Wait Duration (p50, p95)* (Time series)

---

## Phase 4A: Production React Administration Dashboard

QueueForge features a dark-mode developer console engineered for backend operations, queue inspection, and dead-letter recovery.

### 1. Frontend Technology Stack
- **Framework & Tooling:** React 19, TypeScript, Vite, React Router 7
- **Styling:** Tailwind CSS v4, Lucide React icons
- **Server State & Real-time Sync:** TanStack React Query v5 (polling every 2–3s)
- **Data Visualization:** Recharts (queue state distribution pie chart)
- **Testing & Quality:** Vitest, React Testing Library, JSDOM

### 2. Dual-Mode Authentication & Security Architecture
- **Zero Secrets in Client Bundle:** The administrative API key is never bundled in JavaScript, written to `.env`, exposed in `VITE_` variables, or persisted in `localStorage`/`sessionStorage`.
- **Server-Side Session Authentication:** Operators unlock admin mode via `POST /api/v1/auth/login`. On successful authentication, the server sets a `SameSite=Lax; HttpOnly; Path=/api/v1` session cookie (`QF_SESSION`) with a sliding 2-hour TTL.
- **CSRF Defense:** The server generates a cryptographic CSRF token returned in the login payload. The frontend client stores this token strictly in memory and automatically attaches it via `X-CSRF-Token` to state-changing requests (`POST`, `PUT`, `DELETE`).
- **Timing Attack Mitigation:** Secret key comparison in `AuthSessionService` uses constant-time `MessageDigest.isEqual`.
- **Brute-Force Rate Limiting:** In-memory rate limiting restricts failed login attempts to a maximum of 5 attempts per client IP per 60 seconds (HTTP 429 Too Many Requests).
- **Automated CLI & Test Compatibility:** Automated testing scripts and curl clients remain supported using the existing `X-Admin-Key` header.

### 3. Console Operations Views
1. **Overview Dashboard (`/`):** Live KPI cards (Pending Queue, Active Processing, Completed, DLQ), lifetime submissions, worker thread utilization bar, state distribution chart, and quick "Submit Test Job" action.
2. **Job Explorer (`/jobs`):** Bounded paginated table with multi-criteria filtering by lifecycle status (`PENDING`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`), job type search, payload excerpt search, and sorting.
3. **Job Details & Execution Timeline (`/jobs/:jobId`):** Deep diagnostics view including execution metadata, claim tokens, idempotency fingerprints, sanitized payload JSON viewer, collapsible stack traces, and complete attempt history from `qf_job_execution_logs`.
4. **Dead-Letter Queue (`/dlq`):** Exhausted job inspection with error taxonomy snippets and administrative action controls (Replay & Discard) backed by the Admin Unlock modal.
5. **Workers & System Health (`/workers`):** Real-time coordinator health, concurrency pool metrics, database connection pool statistics, and architecture documentation on `SELECT FOR UPDATE SKIP LOCKED` and lease fencing tokens.
6. **Monitoring & Latency Percentiles (`/monitoring`):** Execution latency percentiles (p50, p95, p99), queue wait latency, failure category breakdown, and deep-links to Grafana and Prometheus.

### 4. Running the Frontend (Strict D: Drive Isolation)
```powershell
# Dot-source the environment configuration
. .\env.ps1

# Navigate to frontend directory
cd frontend

# Run development server with backend proxy to http://127.0.0.1:8085
npm run dev

# Run frontend tests
npm run test

# Build production bundle
npm run build
```

---

## Roadmap

- [x] **Phase 1A:** Safe Workspace Initialization & Environment Isolation
- [x] **Phase 1B:** Database Containerization & Backend Integration
- [x] **Phase 1C:** Job Submission, Idempotency & Status Retrieval API
- [x] **Phase 2A:** Concurrent Worker Engine, `SKIP LOCKED` Claiming & Fenced Leases
- [x] **Phase 2B:** Retry Engine, Exponential Backoff with Jitter, Dead-Letter Queue & Admin Recovery
- [x] **Phase 3:** Observability, Metrics (Micrometer / Actuator / Prometheus), Grafana Dashboards & Queue Health Telemetry
- [x] **Phase 4A:** Production React Admin Dashboard, Browser Security Boundaries & Execution Timeline
