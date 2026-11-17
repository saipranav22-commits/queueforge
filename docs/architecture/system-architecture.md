# QueueForge Architecture & Technical Specification

## 1. Executive Summary & Design Rationale

QueueForge is an asynchronous, guaranteed-delivery background task execution engine built with Java 21, Spring Boot 3.3.5, PostgreSQL 16, and React 19. It solves the classic distributed systems challenge of reliable background processing without the operational overhead and operational complexity of external message brokers (such as RabbitMQ or Kafka) for workloads where transactional durability, auditability, and SQL-level inspection are paramount.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Clients ["Clients & External Ingress"]
        WebUser["Browser / Operator"]
        ApiClient["Microservice / API Client"]
    end

    subgraph Edge ["Edge & Reverse Proxy (127.0.0.1:8088)"]
        Nginx["Nginx 1.27 Reverse Proxy"]
        StaticAssets["React 19 SPA Static Bundle"]
    end

    subgraph AppServer ["Spring Boot Application Server (Port 8085)"]
        subgraph ApiLayer ["REST API Layer"]
            JobCtrl["JobController (/api/v1/jobs)"]
            AuthCtrl["AuthController (/api/v1/auth)"]
            AdminDlqCtrl["AdminDlqController (/api/v1/admin/dlq)"]
            SystemCtrl["SystemHealthController (/api/v1/system/health)"]
            Actuator["Spring Actuator / Prometheus (/actuator)"]
        end

        subgraph SecurityLayer ["Security & Session Interceptors"]
            AuthInterceptor["AdminAuthInterceptor (Session Cookie + CSRF)"]
            RateLimiter["IP-based RateLimiter"]
            PayloadMasker["Role-based Payload Sanitize Engine"]
        end

        subgraph CoreEngine ["Worker Engine Subsystem"]
            WorkerCoord["WorkerCoordinator (Fixed Pool)"]
            ClaimSvc["JobClaimService (SKIP LOCKED)"]
            HeartbeatMgr["LeaseHeartbeatScheduler"]
            Sweeper["LeaseRecoverySweeper"]
            HandlerRegistry["JobHandlerRegistry"]
        end

        subgraph Observability ["Metrics & Logging"]
            MicroMeter["Micrometer MeterRegistry"]
            MdcFilter["MDC Logging Context Filter"]
        end
    end

    subgraph Storage ["Persistent Storage Tier"]
        PG[("PostgreSQL 16.8 Engine")]
        JobsTable[("qf_jobs Table (Indexed Queue)")]
        ExecLogs[("qf_job_execution_logs Table")]
        FlywayHistory[("flyway_schema_history")]
    end

    subgraph Telemetry ["Observability Infrastructure"]
        Prometheus["Prometheus v2.51.0 (:9091)"]
        Grafana["Grafana 10.4.1 (:3001)"]
    end

    WebUser -->|"HTTPS/HTTP"| Nginx
    ApiClient -->|"POST /api/v1/jobs"| Nginx
    Nginx -->|"Proxy /"| StaticAssets
    Nginx -->|"Proxy /api/"| ApiLayer

    JobCtrl --> SecurityLayer
    AuthCtrl --> SecurityLayer
    AdminDlqCtrl --> SecurityLayer
    SecurityLayer --> CoreEngine

    ClaimSvc -->|"1. Microsecond Claim Transaction"| JobsTable
    WorkerCoord -->|"2. Dispatch to Thread Pool"| HandlerRegistry
    HandlerRegistry -->|"3. Execute Business Logic"| HandlerRegistry
    WorkerCoord -->|"4. Atomic Completion / Retry"| JobsTable
    WorkerCoord -->|"5. Audit Logging"| ExecLogs
    Sweeper -->|"Sweep Expired Leases"| JobsTable

    Prometheus -->|"Scrape /actuator/prometheus"| Actuator
    Grafana -->|"Query TSDB"| Prometheus
    MicroMeter --> Actuator
```

---

## 3. Job Processing Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: API Ingestion (POST /api/v1/jobs)
    
    PENDING --> RUNNING: Claimed by Worker (SKIP LOCKED)
    note right of RUNNING
      Atomic Claim assigns:
      - claim_token (UUID)
      - lease_until (NOW + 30s)
      - attempt_count++
    end note

    RUNNING --> COMPLETED: Handler Execution Succeeded
    note right of COMPLETED
      Guarded by active lease
      Fencing token validated
    end note

    RUNNING --> RETRY_SCHEDULED: Transient Error (retry_count < max_retries)
    note right of RETRY_SCHEDULED
      Exponential Backoff + Full Jitter
      scheduled_at = NOW + delay
      status resets to PENDING
    end note

    RETRY_SCHEDULED --> PENDING: Backoff Delay Elapsed (scheduled_at <= NOW)
    
    RUNNING --> DEAD_LETTER: Permanent Error OR max_retries Exhausted
    note right of DEAD_LETTER
      Classified into Taxonomy:
      - TRANSIENT_FAILURE (exhausted)
      - PERMANENT_FAILURE (immediate)
      - HANDLER_NOT_FOUND (immediate)
      - LEASE_EXPIRED (exhausted)
    end note

    RUNNING --> PENDING: Worker Crash (Sweeper detects lease_until < NOW)
    
    DEAD_LETTER --> PENDING: Administrative Replay Action (POST /replay)
    DEAD_LETTER --> ARCHIVED: Administrative Discard Action (POST /discard)
    
    COMPLETED --> [*]
    ARCHIVED --> [*]
```

---

## 4. Concurrent Worker Claiming & Lease Fencing

To ensure high concurrency without lock contention or thread blocking, QueueForge decouples job claiming from job execution.

```mermaid
sequenceDiagram
    autonumber
    participant W as Worker Thread (Worker-1)
    participant CS as JobClaimService
    participant DB as PostgreSQL 16 (qf_jobs)
    participant H as JobHandler (Business Logic)

    Note over W,DB: Step 1: Microsecond Claim Transaction
    W->>CS: Poll for available jobs (concurrency quota available)
    CS->>DB: BEGIN TRANSACTION
    CS->>DB: SELECT id FROM qf_jobs WHERE status='PENDING' AND scheduled_at <= NOW() ORDER BY priority DESC, scheduled_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    Note over DB: Locks ONLY the selected row. Skips rows locked by other workers immediately.
    CS->>DB: UPDATE qf_jobs SET status='RUNNING', locked_by='Worker-1', claim_token=UUID, lease_until=NOW()+30s, attempt_count=attempt_count+1 WHERE id = ?
    CS->>DB: COMMIT TRANSACTION
    Note over CS,DB: Database lock is released! Connection returned to HikariCP pool.

    Note over W,H: Step 2: Unbound Business Logic Execution
    W->>H: execute(jobPayload)
    Note over H: Business logic executes in JVM thread pool outside any database lock.

    alt Execution Successful
        W->>CS: completeJob(jobId, claimToken, attemptCount)
        CS->>DB: UPDATE qf_jobs SET status='COMPLETED', completed_at=NOW() WHERE id=? AND claim_token=? AND lease_until >= NOW()
        Note over DB: Verified: Token matches and lease has not expired.
    else Transient Exception Occurred
        W->>CS: failJob(jobId, claimToken, TRANSIENT_FAILURE)
        CS->>DB: Compute backoff: delay = initialDelay * (multiplier ^ retry) +/- jitter
        CS->>DB: UPDATE qf_jobs SET status='PENDING', scheduled_at=NOW()+delay WHERE id=? AND claim_token=? AND lease_until >= NOW()
    end
```

---

## 5. Active Lease Guard & Worker Crash Recovery

Distributed systems often suffer from "zombie workers": a worker experiences a long JVM stop-the-world garbage collection pause or network partition, loses its lease to another worker, and later wakes up attempting to write its outdated result.

QueueForge eliminates zombie writes using **Dual Fencing**:
1. **Cryptographic Claim Tokens:** Every claim assigns a new random UUID `claim_token`.
2. **Temporal Lease Guard:** Updates must satisfy `WHERE id = ? AND claim_token = ? AND (lease_until IS NULL OR lease_until >= CURRENT_TIMESTAMP)`.

```mermaid
flowchart TD
    StartSweeper["LeaseRecoverySweeper (Runs every 5s)"] --> FindExpired["Query: status = 'RUNNING' AND lease_until < CURRENT_TIMESTAMP"]
    FindExpired --> CheckRows{"Any Expired Leases Found?"}
    
    CheckRows -->|No| Sleep["Sleep until next poll interval"]
    CheckRows -->|Yes| EvaluateBudget{"Has Retries Remaining? (retry_count < max_retries)"}
    
    EvaluateBudget -->|Yes| ReclaimPending["Reset status = 'PENDING'<br/>Increment retry_count<br/>Clear locked_by & claim_token<br/>Set scheduled_at = NOW()"]
    EvaluateBudget -->|No| ReclaimDlq["Transition to 'DEAD_LETTER'<br/>Set failure_category = 'LEASE_EXPIRED'<br/>Record diagnostic error message"]
    
    ReclaimPending --> AuditLog["Insert audit record into qf_job_execution_logs"]
    ReclaimDlq --> AuditLog
    AuditLog --> Sleep
```

---

## 6. Technical Decisions & Tradeoffs

| Decision | Rationale | Trade-Off Considered |
| :--- | :--- | :--- |
| **PostgreSQL vs. RabbitMQ / Kafka** | Leverages ACID transactions, transactional outbox pattern readiness, and SQL-level inspection. Zero secondary broker operational complexity. | Throughput ceiling is bounded by PostgreSQL write IOPS (~500–2,000 jobs/sec on typical hardware) vs. Kafka's 100k+/sec log append. Ideal for transactional, high-value jobs. |
| **`SELECT FOR UPDATE SKIP LOCKED`** | Eliminates thread blocking, table locking, and deadlocks across concurrent workers. | Requires indexed queries (`status`, `scheduled_at`, `priority`) to maintain efficient index scans as table size grows. |
| **Decoupled Claim & Execution** | DB locks are held for milliseconds during status transition, then freed. Long-running handler tasks never exhaust database connection pools. | Requires heartbeat mechanism and lease timeout to reclaim orphaned jobs if workers crash mid-execution. |
| **In-Memory Rate Limiting & Session Store** | Ultra-fast authentication verification with zero database query overhead during API routing. | Sessions do not persist across backend container restarts and cannot be shared across multiple backend replicas without an external cache like Redis. |
| **Full Jitter Exponential Backoff** | Prevents synchronized retry spikes ("thundering herd") against recovering downstream microservices. | Introduces minor non-determinism in exact retry arrival times within the bounded $\pm 20\%$ jitter window. |
