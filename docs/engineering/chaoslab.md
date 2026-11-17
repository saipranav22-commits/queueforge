# QueueForge ChaosLab: Distributed Fault Injection & Correctness Verification

## 1. Why Fault Injection Is Essential

In distributed task execution systems, sunny-day happy-path tests (submitting a task, waiting for completion, asserting 200 OK) test application logic, but fail to test distributed systems safety. 

Real production environments experience:
- Sudden SIGKILL, OOM kills, and container crashes mid-execution.
- Stop-The-World (STW) JVM Garbage Collection pauses lasting tens of seconds.
- Transient network partitions between worker nodes and the database.
- Slow I/O causing worker lease expiration while the worker is still actively executing.

Without automated fault injection, catastrophic failure modes remain hidden:
- **Zombie Writes**: A slow worker wakes up from a network pause and commits its stale result, corrupting or overwriting work completed by a newer worker.
- **Split-Brain Ownership**: Two worker processes concurrently believe they own the same task.
- **Task Loss**: An unhandled worker crash permanently leaves a task in `RUNNING` status without automated recovery.
- **Cascading Starvation**: A localized fault in one worker node locks shared tables or halts healthy neighbor nodes.

**QueueForge ChaosLab** is a reproducible fault-injection and correctness-verification harness designed to systematically inject real faults against running distributed worker containers and prove safety and liveness invariants.

---

## 2. ChaosLab Architecture

```
                               +-----------------------------+
                               |     ChaosLab Orchestrator   |
                               | (ScenarioRunner / PS script)|
                               +--------------+--------------+
                                              |
                   +--------------------------+--------------------------+
                   |                          |                          |
                   v                          v                          v
        +--------------------+      +--------------------+      +--------------------+
        |   FaultInjector    |      |   EventRecorder    |      | InvariantVerifier  |
        | - docker kill      |      | - Append-only log  |      | - 6 Safety Checks  |
        | - net disconnect   |      | - Millisecond time |      | - 3 Liveness Checks|
        | - barrier control  |      | - JSON export      |      | - Audit cross-ref  |
        +--------------------+      +--------------------+      +--------------------+
                   |                          |                          |
                   +--------------------------+--------------------------+
                                              |
                                              v
                               +-----------------------------+
                               |     ExperimentReporter      |
                               | - Machine-readable JSON     |
                               | - Recruiter-facing Markdown |
                               +-----------------------------+
```

### Component Roles

1. **`ScenarioRunner`**: Orchestrates deterministic multi-stage experiments with strict timeouts and state assertions.
2. **`FaultInjector`**: Targets verified test worker containers (`qf-chaos-worker-*`). Includes safety boundary checks that strictly forbid operations on any containers outside the disposable `queueforge-chaos` compose project.
3. **`EventRecorder`**: Thread-safe append-only chronology of execution events (`JOB_SUBMITTED`, `JOB_CLAIMED`, `FAULT_INJECTED`, `LEASE_EXPIRED`, `JOB_RECOVERED`, `STALE_COMMIT_REJECTED`, `JOB_COMPLETED`, `JOB_DEAD_LETTERED`).
4. **`InvariantVerifier`**: Evaluates execution traces, database row states, and audit log entries against 9 correctness invariants.
5. **`ExperimentReporter`**: Emits timestamped, machine-readable JSON and human-readable Markdown reports detailing event timelines, recovery durations, and invariant verification outcomes.

---

## 3. Correctness Invariants: Specifications & Empirical Verification

QueueForge verifies 6 Safety invariants and 3 Liveness invariants through automated trace and state inspection:

| Invariant | Category | Description | Verification Logic |
| :--- | :--- | :--- | :--- |
| **SAFETY-1** | Safety | **Single Valid Owner** | In PostgreSQL state, at most one active lease (`locked_by`, `claim_token`) exists per job at any point in time. |
| **SAFETY-2** | Safety | **Stale Worker Fencing** | A stale/zombie worker whose lease expired or was reassigned cannot successfully commit completion (`UPDATE ... WHERE claim_token = :token AND lease_until >= NOW()` yields 0 rows). |
| **SAFETY-3** | Safety | **Durable Storage Survival** | No acknowledged job submission is lost or silently deleted during worker crash or network failure. |
| **SAFETY-4** | Safety | **Bounded Retries** | `attempt_count` and `retry_count` strictly respect `max_retries` configuration boundaries. |
| **SAFETY-5** | Safety | **No Terminal Reversal** | Once a job reaches terminal state `COMPLETED`, no subsequent lifecycle event can regress it to `RUNNING` or `PENDING`. |
| **SAFETY-6** | Safety | **Consistent Audit Evidence** | Every terminal transition has a corresponding queryable record in `qf_job_execution_logs` with matching attempt and status. |
| **LIVENESS-1** | Liveness | **Abandoned Job Recovery** | A job whose owning worker crashed or abandoned its lease is detected by `LeaseRecoverySweeper` upon lease expiry and returned to `PENDING` (or `DEAD_LETTER`). |
| **LIVENESS-2** | Liveness | **Eventual Terminal State** | Under bounded test conditions, eligible recoverable jobs eventually reach `COMPLETED` or `DEAD_LETTER`. |
| **LIVENESS-3** | Liveness | **Healthy Worker Continuity** | A crash or network partition affecting Worker 1 does not starve, halt, or block Worker 2 from processing queue jobs. |

---

## 4. The Three Fault Scenarios

### Experiment A: Hard Worker Crash Mid-Execution

- **Fault Mechanism**: Submits a CPU/IO-intensive job (`delayMs: 8000`). Once the worker emits a verified running signal on disk and the database confirms `status = 'RUNNING'`, `docker kill` delivers an uncatchable `SIGKILL` to the container process.
- **Significance**: Unlike a graceful shutdown (which allows Spring Boot to finish in-flight tasks and trigger `@PreDestroy`), a hard crash tests the worst-case scenario: threads die abruptly, HikariCP connections terminate without TCP FIN, and in-memory locks disappear.
- **Expected Outcome**:
  1. The row remains preserved in PostgreSQL.
  2. The 6-second worker lease expires without heartbeats.
  3. Worker 2's background sweeper reclaims the job back to `PENDING`.
  4. Worker 2 claims the job, incrementing `attempt_count` to 2 and assigning a fresh `claim_token`.
  5. Worker 2 completes execution successfully.

### Experiment B: Zombie Worker & Fencing Token Protection

- **Fault Mechanism**: Worker 1 claims a job. We simulate an extreme GC pause or thread starvation by instructing the test handler to pause at a synchronization barrier while disabling lease heartbeat renewal (`disableHeartbeat: true`). The lease (6s) expires. Worker 2 detects the expired lease, reclaims it, and finishes the job (`status = 'COMPLETED'`). Then, the barrier is released: Worker 1 resumes and attempts to commit completion with its stale token.
- **Significance**: Proves that distributed consensus/correctness is maintained without split-brain anomalies even when an old worker comes back to life.
- **Expected Outcome**:
  1. Worker 1's conditional `UPDATE` matches 0 rows:
     ```sql
     UPDATE qf_jobs SET status = 'COMPLETED' ...
     WHERE id = :id AND claim_token = :staleToken AND lease_until >= NOW();
     ```
  2. Worker 1 logs `Fenced out! Token mismatch or lease expired`.
  3. Database remains in `COMPLETED` state under Worker 2; zero data corruption.

### Experiment C: Database Connection Interruption (Network Partition)

- **Fault Mechanism**: Worker 1 is isolated from the PostgreSQL database container via `docker network disconnect qf-chaos-net qf-chaos-worker-1`.
- **Significance**: Simulates a network switch failure or cloud availability zone partition affecting only one node.
- **Expected Outcome**:
  1. Worker 1 detects broken JDBC socket and transitions HikariCP connections to broken.
  2. Ingress API and Worker 2 (on healthy network) continue accepting and completing jobs (LIVENESS-3).
  3. Reconnecting the network (`docker network connect`) allows Worker 1 to restore its connection pool and resume normal claiming without requiring container restarts.

---

## 5. What the Invariant Checker Can and Cannot Prove

### What It Proves (Strong Guarantees)
- **Database State Correctness**: At no point can two workers commit concurrent completions for the same job.
- **Fenced Database Writes**: Stale workers cannot overwrite newer job records or reverse terminal statuses.
- **At-Least-Once Database Persistence**: Jobs surviving container kills are guaranteed to be retried.

### What It Cannot Prove (Known Distributed Systems Limits)
- **Exactly-Once External Side Effects**: If a job handler makes an external network call (e.g., Stripe API, SMTP email send) *before* the crash or fencing event, that external system will have executed the action. If the job is subsequently retried by Worker 2, the external call will occur a second time.
  - *Engineering Reality*: In distributed systems, **at-least-once delivery + idempotent handlers** is the only physically achievable guarantee under arbitrary network partitions (FLM/CAP theorem). Downstream services must support deduplication keys or idempotency tokens.

---

## 6. How to Run ChaosLab

### Prerequisites
- Docker Engine running with Docker Desktop.
- Available memory: minimum 1.5 GB free RAM.
- Ports 5440, 8094, 8095, 8096 available.

### Execution
Run the automated PowerShell harness from the repository root:
```powershell
powershell -ExecutionPolicy Bypass -File .\chaoslab\scenarios\Run-All-ChaosLab.ps1
```

Reports are emitted automatically in:
- `chaoslab/reports/CHAOS-EXP-A-HARD-CRASH.json`
- `chaoslab/reports/CHAOS-EXP-B-ZOMBIE-WORKER.json`
- `chaoslab/reports/CHAOS-EXP-C-DB-DISCONNECT.json`
