# QueueForge V2: Recruiter & Engineering Interview Demo Guide (3-5 Minutes)

This script provides a structured, live terminal and architectural demonstration of **QueueForge V2**. It demonstrates the distributed systems engineering, transactional consistency, and multi-tenant scheduling mechanisms built across Phases 1 through 5.

---

## Demo Overview (3-5 Minute Narration Arc)

| Time | Demo Step | Distributed Systems Concept Demonstrated | Command / Action |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:45** | **1. The Problem Statement** | Single-point of failure, noisy-neighbor starvation, dual-write consistency | Architecture slides / README diagrams |
| **0:45 - 1:30** | **2. Independent Multi-Instance Workers** | SKIP LOCKED concurrency, zero duplicate claims across processes | `.\scripts\test-cross-process-quota.ps1` |
| **1:30 - 2:15** | **3. Worker Crash & Fenced Lease Recovery** | Process death, zombie prevention, lease reclamation without quota leaks | Automated crash injection in Step 2 |
| **2:15 - 3:00** | **4. Transactional Outbox & Lost ACK Recovery** | Atomic local outbox, real HTTP dispatch, durable idempotent receiver | `mvn test -Dtest=TransactionalOutboxIntegrationTest` |
| **3:00 - 4:00** | **5. FairShare DRR & Noisy-Neighbor Mitigation** | Deficit Round Robin, 89.8% p50 latency reduction under flood | `.\scripts\benchmark-fairshare.ps1 -SkipRun` |
| **4:00 - 4:45** | **6. Multi-Tenant Concurrency Quotas** | Cluster-wide concurrency ceilings, index-only scans, zero quota leaks | `.\scripts\test-cross-process-quota.ps1` |
| **4:45 - 5:00** | **7. Production Security Release Gate** | SHA-256 credential hashing, timing attack resistance, production gating | `mvn test -Dtest=TenantSecurityIntegrationTest` |

---

## Step-by-Step Demonstration Walkthrough

### Step 1: The Engineering Problem (0:00 - 0:45)
**Narration:**
> *"In modern microservices, background job queues and event dispatchers face three classic distributed systems failure modes:*
> 1. *Queue monopolization by noisy tenants under global FIFO queues.*
> 2. *Zombie worker updates and duplicate job execution when worker processes crash or freeze.*
> 3. *Dual-write data corruption when database operations and external message publishing are not atomic.*
> *QueueForge V2 solves all three using pure PostgreSQL transactional primitives: `SELECT FOR UPDATE SKIP LOCKED`, Deficit Round Robin fair scheduling, cryptographic lease fencing, and a Transactional Outbox."*

---

### Step 2 & 3: Two Independent Worker Processes with Crash & Lease Recovery (0:45 - 2:15)

**Command:**
```powershell
powershell -ExecutionPolicy Bypass -File D:\Projects\QueueForge\scripts\test-cross-process-quota.ps1
```

**What Happens Behind the Scenes:**
1. Two real, independent operating system Java 21 processes launch against an isolated PostgreSQL database:
   - Worker 1: PID on port 8095 (`instance=worker-jvm-1`)
   - Worker 2: PID on port 8096 (`instance=worker-jvm-2`)
2. Workload is submitted: 8 jobs for Tenant Alpha (`max_concurrency = 2`) and 4 jobs for Tenant Beta (`max_concurrency = 1`).
3. Both JVMs concurrently claim jobs using PostgreSQL `SKIP LOCKED` without blocking each other.
4. **Fault Injection**: Worker 1 is abruptly terminated mid-flight via process SIGKILL (`Stop-Process -Force`).
5. Worker 2 detects the expired leases, reclaims the orphaned jobs back to `PENDING`, and completes them safely.

**Expected Terminal Output:**
```text
[OK] Worker 1 (PID=18260) is UP and healthy on port 8095 after 9s.
[OK] Worker 2 (PID=4112) is UP and healthy on port 8096 after 4s.
Seeding tenants with strict concurrency quotas:
  -> Tenant Alpha: max_concurrency = 2, weight = 1
  -> Tenant Beta:  max_concurrency = 1, weight = 1
>>> [FAULT INJECTION] Crashing Worker JVM 1 (PID=18260) to test lease recovery and quota preservation! <<<
Final Verification State:
  - Total Jobs Completed: 12 / 12
  - Active RUNNING Jobs (Quota Leak Check): 0 (Expected: 0)
  - Max Alpha Running Concurrency Observed: 2 (Ceiling: 2)
  - Max Beta Running Concurrency Observed:  1 (Ceiling: 1)
[SUCCESS] Cross-process quota enforcement verified across independent JVM processes with zero quota leaks!
```

**Narration:**
> *"Here, two independent OS processes are actively processing jobs. When Worker 1 is abruptly killed, its in-flight jobs are safely abandoned. Worker 2's background lease sweeper detects the expired heartbeat lease, transitions the jobs back to PENDING, and completes them. Notice that neither tenant's concurrency ceiling was ever violated, and the final quota leak count is exactly zero."*

---

### Step 4: Transactional Outbox with Lost HTTP Acknowledgement (2:15 - 3:00)

**Command:**
```powershell
cd D:\Projects\QueueForge\backend
mvn test -Dtest=TransactionalOutboxIntegrationTest -DargLine="-XX:+UseSerialGC -Xmx256m" -B
```

**What Happens Behind the Scenes:**
1. An order is created and an outbox event is inserted atomically within the exact same database transaction.
2. The `OutboxDispatcherService` claims the event and dispatches a real HTTP POST request to the simulated payment receiver.
3. The payment receiver commits the charge to its independent PostgreSQL database and writes an inbox deduplication record.
4. **Fault Injection**: The network connection is severed immediately after commit, dropping the HTTP ACK back to the dispatcher.
5. The dispatcher lease expires, a second dispatcher retries the delivery, and the receiver's inbox detects the duplicate idempotency key, returning HTTP 200 OK without double-charging.

**Expected Terminal Output:**
```text
[INFO] Running com.queueforge.outbox.TransactionalOutboxIntegrationTest
...
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**Narration:**
> *"Across an unreliable network, exactly-once network delivery is mathematically impossible. We demonstrate at-least-once HTTP transport paired with consumer-side idempotency. Even when the network ACK drops after the database commit, re-dispatching the event produces an idempotent replay with exactly one committed charge in the receiver's database."*

---

### Step 5: Noisy-Neighbor Mitigation under FairShare DRR (3:00 - 4:00)

**Command:**
```powershell
powershell -ExecutionPolicy Bypass -File D:\Projects\QueueForge\scripts\benchmark-fairshare.ps1 -SkipRun
```

**Expected Terminal Output:**
```text
DETAILED NOISY-NEIGHBOR IMPACT ANALYSIS (Profile 3):
Workload: 1 Noisy Tenant (1,000 jobs) + 4 Quiet Tenants (20 jobs each = 80 jobs)

METRIC (QUIET TENANTS)     |  BASELINE (FIFO) |  FAIRSHARE (DRR) |    IMPROVEMENT
--------------------------------------------------------------------------------
Median Wait (p50)          |         11868 ms |          1210 ms |        -89.8 %
Tail Wait (p95)            |         12219 ms |          1990 ms |        -83.7 %
Max Wait (Max Starvation)  |         12219 ms |          1990 ms |        -83.7 %
Jain's Contention Fairness |            0.233 |            1.000 |       +329.4 %
--------------------------------------------------------------------------------
```

**Narration:**
> *"Under standard FIFO, when a batch tenant floods the queue with 1,000 jobs, quiet tenants waiting for interactive operations wait nearly 12 seconds. FairShare implements Deficit Round Robin across tenants with PostgreSQL CTE optimization fences. Quiet tenants are serviced immediately in round-robin sweeps, slashing p50 queue wait latency by 89.8% and improving active contention fairness from 0.233 to 1.000."*

---

### Step 6: Security Release Gate & Credential Verification (4:00 - 5:00)

**Command:**
```powershell
mvn test -Dtest=TenantSecurityIntegrationTest -DargLine="-XX:+UseSerialGC -Xmx256m" -B
```

**Expected Terminal Output:**
```text
[INFO] Running com.queueforge.api.security.TenantSecurityIntegrationTest
[INFO] Tests run: 15, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**Narration:**
> *"QueueForge V2 enforces strict enterprise multi-tenant security boundaries:*
> - *Tenant API keys are never stored in plaintext: Flyway V7 migrated all credentials to SHA-256 hashes with constant-time verification.*
> - *Known default development secrets (`qf_tenant_default_key`, `qf_admin_dev_secret_2026`) are rejected at startup in production profile.*
> - *Tenant A attempting to inspect Tenant B's jobs or execution logs receives HTTP 404 Not Found to prevent ID enumeration.*
> - *All 15 negative security tests pass 100% green."*
