# QueueForge Multi-Instance Worker Architecture

## 1. Overview & System Motivation

QueueForge is a transactional, database-backed distributed task queue built on PostgreSQL and Java 21 / Spring Boot 3.3.5. While QueueForge initially proved transactional correctness within a single JVM process utilizing concurrent executor threads, real-world high-throughput distributed architectures require independent horizontal scaling.

In this architecture, multiple decoupled worker processes run across separate JVMs, containers, or bare-metal machines, coordinating safely and concurrently over a shared PostgreSQL cluster without requiring external coordination brokers like Apache ZooKeeper, etcd, or Redis locks.

---

## 2. Node Roles and Topology

QueueForge supports three operational deployment topologies controlled by configuration (`queueforge.mode`):

```
                                    +--------------------+
                                    |    Client / LB     |
                                    +---------+----------+
                                              |
                       +----------------------+----------------------+
                       | HTTP Ingress                                | HTTP Ingress
                       v                                             v
              +------------------+                          +------------------+
              |   API Instance   |                          |   API Instance   |
              |    (API_ONLY)    |                          |    (API_ONLY)    |
              +--------+---------+                          +--------+---------+
                       |                                             |
                       +----------------------+----------------------+
                                              |
                                              v  JDBC Pool (HikariCP)
                       +---------------------------------------------+
                       |             PostgreSQL Cluster              |
                       |       (Row-Level Locks + SKIP LOCKED)       |
                       +---------------------------------------------+
                                              ^
                                              |  JDBC Poll (100ms)
                       +----------------------+----------------------+
                       |                                             |
              +--------+---------+                          +--------+---------+
              | Worker Node 1    |                          | Worker Node 2    |
              |  (WORKER_ONLY)   |                          |  (WORKER_ONLY)   |
              | pool: 2 threads  |                          | pool: 2 threads  |
              +------------------+                          +------------------+
```

### Application Modes (`AppMode`)

1. **`COMBINED` (Default / Development / Edge)**:
   - Both HTTP REST API controllers and background worker coordinator threads run within the single JVM.
   - Ideal for single-node deployments, local development, and end-to-end integration testing.
2. **`API_ONLY` (Web / Ingress Tier)**:
   - HTTP REST API endpoints are fully active (`/api/v1/jobs`, `/api/v1/dashboard`, `/actuator/*`).
   - Background worker coordinator threads are **completely disabled** (`WorkerCoordinator` does not start thread pools or polling loops).
   - Health indicator reports `UP` with `workerStatus: DISABLED, mode: API_ONLY`.
   - Dashboard service reports worker pool status as `EXTERNAL_WORKERS`.
3. **`WORKER_ONLY` (Worker Tier)**:
   - Background worker coordinator and sweeper threads are **active**.
   - Mutating HTTP API endpoints (`POST /api/v1/jobs/**`, `PUT /api/v1/jobs/**`, `DELETE /api/v1/jobs/**`) are rejected with **HTTP 503 Service Unavailable** via `AppModeGuardInterceptor`.
   - Actuator health endpoints (`/actuator/health/liveness`, `/actuator/health/readiness`) remain available for container orchestrator probes.

### Node Identity & Tracing

Each JVM process possesses a unique instance identity configured via `queueforge.instance-id` (or the `QUEUEFORGE_INSTANCE_ID` environment variable). If omitted, it defaults to `qf-worker-${PID}`.

When a thread within an instance processes a job:
- `qf_jobs.locked_by` records `${instanceId}` (e.g., `worker-instance-1`).
- `qf_job_execution_logs.worker_id` records `${instanceId}:${threadName}` (e.g., `worker-instance-1:qf-worker-1`).

This guarantees end-to-end auditability across physical machines and thread pools.

---

## 3. Distributed Coordination Protocol: `SELECT FOR UPDATE SKIP LOCKED`

Rather than relying on distributed locks (which suffer from split-brain scenarios, consensus timeouts, and TTL desynchronization), QueueForge delegates mutual exclusion directly to PostgreSQL's multi-version concurrency control (MVCC) row-level locks.

### The Atomic Claim Query

When a worker poll cycle triggers, it executes an atomic claim query inside a `READ COMMITTED` transaction:

```sql
WITH claimable AS (
    SELECT id
    FROM qf_jobs
    WHERE status = 'QUEUED'
      AND scheduled_at <= NOW()
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT :limit
    FOR UPDATE SKIP LOCKED
)
UPDATE qf_jobs j
SET status = 'PROCESSING',
    claim_token = :newToken,
    locked_by = :lockedBy,
    lease_until = NOW() + CAST(:leaseDuration AS interval),
    attempt_count = j.attempt_count + 1,
    updated_at = NOW()
FROM claimable
WHERE j.id = claimable.id
RETURNING j.*;
```

### Why `SKIP LOCKED` Is Superior for Queues

- **Zero Blocking**: `FOR UPDATE` normally blocks concurrent transactions attempting to acquire the same row. `SKIP LOCKED` instructs PostgreSQL to immediately skip any locked rows and inspect the next eligible rows in the index.
- **Fair Load Distribution**: When Node 1 locks Job 1 and Job 2, Node 2 concurrently inspecting the table skips Job 1 and Job 2 without delay, locking Job 3 and Job 4.
- **Lock Lifetime Bound to Transaction**: The row lock exists *only* for the duration of the short claim transaction (typically < 3 milliseconds). Once the claim transaction commits, the lock is released, and ownership is maintained through the durable lease fields (`claim_token`, `lease_until`, `locked_by`).

---

## 4. Concurrency Invariants & Proofs

QueueForge guarantees six strict invariants across arbitrary numbers of concurrent JVM worker instances:

| Invariant | Description | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Invariant A** | **Mutual Exclusion** — No two workers can claim or execute the same job simultaneously. | PostgreSQL row-level locks in `SELECT FOR UPDATE SKIP LOCKED` inside an atomic claim transaction. |
| **Invariant B** | **Stale Token Fencing** — A slow or zombie worker cannot complete a job whose lease has expired or been reassigned. | Fenced `UPDATE ... WHERE id = :id AND claim_token = :token AND lease_until >= NOW()` matching exact claim token and valid lease. |
| **Invariant C** | **Bounded Retries** — A failing job is retried up to `max_retries` before dead-letter routing. | Atomic retry counter increments (`attempt_count = attempt_count + 1`) during claim; transitions to `DEAD_LETTER` once `attempt_count >= max_retries`. |
| **Invariant D** | **At-Least-Once Delivery** — Crashed workers do not lose jobs; unacknowledged jobs are safely re-queued. | `SweeperCoordinator` identifies orphaned jobs where `status = 'PROCESSING' AND lease_until < NOW()` and atomically resets them to `QUEUED`. |
| **Invariant E** | **Lock Non-Blocking** — Worker threads never block on other workers' lock acquisition. | `SKIP LOCKED` skips held row locks, eliminating lock contention and thread starvation across nodes. |
| **Invariant F** | **Idempotent Ingress** — Duplicate client submissions do not produce duplicate jobs. | Unique constraint on `qf_jobs.idempotency_key` ensures identical submissions return the existing job. |

### Deep-Dive: Invariant B (Stale Token Fencing)

Consider a scenario where Worker A (Instance 1) claims Job 42 with `claim_token = T1` and a lease of 30 seconds.
1. Worker A experiences an unexpected 45-second Stop-The-World (STW) JVM Garbage Collection pause or severe network partition.
2. At second 31, the lease expires. The Sweeper background task detects `lease_until < NOW()`, reclaims Job 42, and resets it to `QUEUED`.
3. Worker B (Instance 2) polls and claims Job 42 with `claim_token = T2`.
4. At second 46, Worker A wakes up and attempts to report successful execution:
   ```sql
   UPDATE qf_jobs
   SET status = 'COMPLETED', completed_at = NOW()
   WHERE id = 42
     AND claim_token = 'T1'
     AND lease_until >= NOW();
   ```
5. **Outcome**: The `UPDATE` matches **0 rows** because `claim_token` is now `T2` and `lease_until` had expired. Worker A's stale write is completely fenced out. Worker A throws an `OptimisticLockException` or detects `rowsUpdated == 0`, and Worker B executes to completion without data corruption.

---

## 5. Single JVM Multi-Threading vs. Distributed Multi-JVM Architecture

| Dimension | Single JVM (Concurrent Worker) | Multi-Instance (Distributed Workers) |
| :--- | :--- | :--- |
| **Process Boundaries** | Single OS process, shared heap, single JVM runtime. | Multiple independent OS processes, isolated heaps, separate JVM runtimes. |
| **Failure Domain** | If the JVM encounters an OutOfMemoryError, SIGKILL, or panic, all workers die. | If Node 1 crashes or is killed, Node 2 continues processing without interruption. |
| **Scalability** | Vertical only (bounded by CPU cores and RAM of a single host). | Horizontal (scale to tens or hundreds of worker containers dynamically). |
| **Coordination** | In-memory constructs (`Semaphore`, `AtomicInteger`) can coordinate threads. | In-memory constructs cannot cross process boundaries; coordination must be database-backed. |
| **Metrics Scope** | Gauges represent the total cluster capacity. | Local pool gauges (`queueforge.workers.capacity`) must be tagged with `instance_id` to avoid cluster metrics confusion. |
| **Network Partitions** | None (all in-process). | Real network delays, dropped connections, and TCP timeouts must be handled gracefully. |

---

## 6. Docker Multi-Worker Topology & Verification Harness

To validate cross-process multi-instance behavior locally, QueueForge includes `docker-compose.multi-worker.yml` and the automated verification harness `scripts/verify-multi-instance.ps1`.

### Topology

```yaml
services:
  qf-multi-db:
    image: postgres:16.8-alpine
    ports: ["127.0.0.1:5439:5432"]
    volumes: [./data/multi-worker-db:/var/lib/postgresql/data]

  qf-multi-api:
    image: queueforge-backend:multi
    environment:
      QUEUEFORGE_MODE: API_ONLY
      QUEUEFORGE_INSTANCE_ID: api-node-1
    ports: ["127.0.0.1:8091:8085"]

  qf-multi-worker-1:
    image: queueforge-backend:multi
    environment:
      QUEUEFORGE_MODE: WORKER_ONLY
      QUEUEFORGE_INSTANCE_ID: worker-instance-1
      QUEUEFORGE_WORKER_CONCURRENCY: 2
    ports: ["127.0.0.1:8092:8085"]

  qf-multi-worker-2:
    image: queueforge-backend:multi
    environment:
      QUEUEFORGE_MODE: WORKER_ONLY
      QUEUEFORGE_INSTANCE_ID: worker-instance-2
      QUEUEFORGE_WORKER_CONCURRENCY: 2
    ports: ["127.0.0.1:8093:8085"]
```

### Empirical Verification Results

The automated harness (`verify-multi-instance.ps1`) executes the following test flow against isolated containers:
1. **Container Health & Mode Validation**:
   - `api-node-1` (`:8091`): Reports UP, mode `API_ONLY`, worker threads `0`.
   - `worker-instance-1` (`:8092`): Reports UP, mode `WORKER_ONLY`, worker pool `2`.
   - `worker-instance-2` (`:8093`): Reports UP, mode `WORKER_ONLY`, worker pool `2`.
2. **Security & Ingress Guard**:
   - `POST http://127.0.0.1:8092/api/v1/jobs` rejected with **HTTP 503 Service Unavailable** (confirming `AppModeGuardInterceptor` prevents worker node pollution).
3. **Concurrent Distributed Processing**:
   - 12 batch jobs submitted through `api-node-1` (`:8091`).
   - Execution logs show simultaneous, balanced processing across both worker instances:
     - `worker-instance-1:qf-worker-1`
     - `worker-instance-1:qf-worker-2`
     - `worker-instance-2:qf-worker-1`
     - `worker-instance-2:qf-worker-2`
4. **Crash Resilience & Failover**:
   - `worker-instance-1` is forcibly stopped (`docker stop`).
   - 6 additional jobs submitted to `api-node-1`.
   - `worker-instance-2` seamlessly claims and completes all 6 jobs without starvation or error.
5. **Data Integrity & Invariant Validation**:
   - Total completed jobs: 18 / 18.
   - Distinct claim tokens: 18 (zero token collisions).
   - Zero locked jobs remaining.

---

## 7. Known Limitations & Production Evolution

While the current multi-instance architecture is robust and verified, high-scale production deployments should consider the following evolutions:

1. **PostgreSQL Connection Pool Exhaustion**:
   - Each worker instance maintains a HikariCP pool of JDBC connections. Scaling to hundreds of worker nodes can saturate PostgreSQL's `max_connections`.
   - *Mitigation*: Introduce **PgBouncer** or **AWS RDS Proxy** in transaction pooling mode between worker nodes and PostgreSQL.
2. **Database Polling Overhead**:
   - Workers poll every 100ms for claimable jobs. Under low traffic, this incurs idle CPU and query overhead.
   - *Mitigation*: Utilize PostgreSQL `LISTEN / NOTIFY` to wake sleeping worker threads immediately upon job insertion, falling back to a 1000ms poll interval as a safety net.
3. **Partitioned Queuing**:
   - For ultra-high volume (> 50,000 jobs/sec), a single `qf_jobs` table can experience B-tree index bloat and page-level write contention.
   - *Mitigation*: Implement PostgreSQL declarative range/hash partitioning by status or tenant ID.

---

## 8. Distributed Systems Interview Talking Points

- **Why PostgreSQL `SKIP LOCKED` instead of Redis / Celery?**
  Transactional durability. In PostgreSQL, business data changes and queue events happen within the exact same database transaction. With Redis or Kafka, dual-write anomalies (e.g., job queued in Redis, but PostgreSQL transaction rolled back) require complex Outbox patterns.
- **How do you prevent split-brain without Paxos or Raft?**
  PostgreSQL acts as the single source of truth and serializes row locks using its write-ahead log (WAL) and page locking mechanisms. Workers do not elect a leader among themselves; each claim operation is an atomic consensus event mediated by PostgreSQL MVCC.
- **How is lease expiration handled if a worker hangs?**
  QueueForge utilizes fencing tokens (`UUID claim_token`). Even if an expired worker recovers, its completion write fails because the claim token has changed or the lease has elapsed. Orphaned jobs are safely re-queued by background sweepers.
