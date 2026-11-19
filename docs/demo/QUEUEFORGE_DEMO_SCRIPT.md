# QueueForge V2 Control Plane — Demonstration Script

**Document Target:** Engineering Hiring Managers, Technical Recruiters & Staff Engineers  
**Product:** QueueForge V2 Distributed Task Orchestration & Control Plane  
**UI Design System:** Obsidian Pulse  
**Revision:** Phase 8E Release Candidate (November 2026)

---

## 1. 60–90 Second Recruiter Elevator Pitch

> *"QueueForge is an enterprise-grade distributed background job orchestrator built in Spring Boot and React 19 that solves distributed systems correctness at scale.*
>
> *Unlike naive queues that suffer from zombie writes, lost tasks, or noisy-neighbor starvation, QueueForge implements:
> 1. **Durable Lease Fencing:** PostgreSQL conditional updates with monotonic claim tokens that mathematically fence out slow or partitioned workers.
> 2. **FairShare Weighted Deficit Round Robin:** Multi-tenant queue scheduling with hard cluster concurrency quotas that prevent high-volume tenants from starving peer tenants.
> 3. **Transactional Outbox & Durable Idempotency:** Atomic dual-write elimination between domain orders and integration events, combined with consumer-side idempotency at our simulated financial payment receiver.*
>
> *Everything you see in this Obsidian Pulse Control Plane is backed by real server-side APIs, database tables, and append-only audit logs. There is zero fabricated data."*

---

## 2. 3–5 Minute Comprehensive Technical Walkthrough

### Act I: Mission Control & System Telemetry (0:00 – 0:45)
1. **Screen:** Mission Control (`/`)
2. **Talking Points:**
   - Highlight the top KPI strip: Active Cluster Workers (2 multi-instance workers), Active Running Jobs, Pending Execution Queue, and instantaneous System Throughput.
   - Point out the cluster architecture pill in the header: `V2 CLUSTER`, with real-time Spring Boot Actuator database and coordinator health status.
   - Toggle between **Dark Mode (Signature Obsidian Pulse)** and **Light Mode** using the header toggle to showcase contrast and accessible tokens.

### Act II: Job Lifecycle, Fencing & Audit Timeline (0:45 – 1:45)
1. **Screen:** Job Explorer (`/jobs`) & Job Detail (`/jobs/{id}`)
2. **Talking Points:**
   - Demonstrate the server-side filtered table: search by UUID or Idempotency Key, filter by status (`RUNNING`, `COMPLETED`, `DEAD_LETTER`), and filter by priority range.
   - Click into a completed job to reveal the **Verified Execution Timeline**:
     - *Job Enqueued:* Recorded submission timestamp, tenant partition, and priority.
     - *Scheduled Delay:* Bounded delay if scheduled in the future.
     - *Execution Attempts:* Detailed breakdown displaying which worker claimed the lease (`worker-1` vs `worker-2`), attempt number, execution duration in milliseconds, and exit status.
     - *Terminal State:* Verified success or failure classification.
   - Open the **Job Payload Viewer**: Explain how unauthenticated sessions receive masked payloads (`_masked: true`) to satisfy enterprise data-governance standards, while unlocked administrative sessions can inspect full JSON payloads.

### Act III: Distributed Worker Fleet & Heartbeat Discovery (1:45 – 2:30)
1. **Screen:** Worker Fleet (`/workers`)
2. **Talking Points:**
   - Display the real-time node cards backed by Flyway migration `V8__create_worker_heartbeats_schema.sql`.
   - Point out the heartbeat freshness indicators: `Heartbeat 3s ago (fresh)` vs `Stale (>10s)` or `Unresponsive (>30s)`.
   - Open the worker slide-over drawer: Highlight the distinction between **Currently Held Active Leases** (transient PostgreSQL row locks with fencing tokens) and **Lifetime Completed Jobs** (historical attribution from `qf_job_execution_logs`).

### Act IV: FairShare Multi-Tenant Intelligence (2:30 – 3:15)
1. **Screen:** FairShare (`/fairshare`)
2. **Talking Points:**
   - Walk through the three registered enterprise tenants (`Alpha Corp` [5x weight], `Beta LLC` [2x weight], `Gamma Co` [1x weight]).
   - Explain the concurrency quota bars: Hard ceilings prevent any single tenant from monopolizing the shared worker pool.
   - Show the **Persisted Sweep Deficit ($D_i$)**: Explain that this counter reflects persisted state in `qf_tenants.deficit_counter` at the conclusion of each DRR sweep, resetting to zero upon queue drain to uphold the anti-hoarding invariant.
   - Step through one round of the **Interactive Educational Simulator** to demonstrate the mathematical formulation:
     $$Q_i = w_i \times Q_\text{base}, \quad K_i = \min(B, D_i, H_i)$$
   - Review the **Profile 3 Noisy Neighbor Benchmark Panel**: Cite the local benchmark measurements where quiet-tenant wait times plummeted from 11,868 ms under FIFO to 1,210 ms under FairShare DRR, with an honest ~21% throughput trade-off.

### Act V: Transactional Outbox & Exactly-Once Idempotency (3:15 – 4:00)
1. **Screen:** Event Pipeline (`/pipeline`)
2. **Talking Points:**
   - Trace the **7-Stage Business Flow Visualizer**: Clearly distinguish between `VERIFIED` database stages (Order in `qf_orders`, Outbox event in `outbox_events`, Claimed token, Delivery ack) and `ARCHITECTURAL / INFERRED` stages at the payment receiver.
   - Explain dual-write elimination: Orders and outbox events are inserted in the exact same ACID transaction commit.
   - Inspect an event in the slide-over drawer: Demonstrate the unique `Idempotency-Key` and explain how duplicate delivery replays to the payment receiver return identical cached charges without double-charging.
   - Demonstrate the manual outbox dispatch control: Protected by an administrative confirmation modal and bounded to safe batch limits (`[5, 10, 25, 50]`).

### Act VI: Reliability Lab, DLQ Operations & Administration (4:00 – 5:00)
1. **Screen:** Reliability Lab (`/reliability`) & Dead-Letter Queue (`/dlq`)
2. **Talking Points:**
   - In the Reliability Lab, review the **8 Core Resilience Mechanisms** and inspect the historical millisecond chronologies from **ChaosLab Experiments A, B, and C** (`docs/engineering/chaoslab.md`).
   - Highlight the **9 Formal Invariants Matrix** (`SAFETY-1`..`SAFETY-6`, `LIVENESS-1`..`LIVENESS-3`) verified by `InvariantVerifier.java`.
   - In Dead-Letter Queue Operations, inspect a poison job: View the categorized failure reason (`TRANSIENT_FAILURE`, `PERMANENT_FAILURE`, `LEASE_EXPIRED`) and expand the diagnostic stack trace.
   - Demonstrate the **Replay Workflow Modal**: Explain how replaying resets status to `PENDING` with a zeroed claim token for safe pickup.
   - Demonstrate the **Discard Workflow Modal**: Explain that discarding performs soft-deleted archival to preserve the immutable audit trail.
   - Conclude in **Administration (`/admin`)**: Showcase the live HikariCP connection pool parameters, worker coordinator interval configurations, anti-CSRF protection, and session lock controls.

---

## 3. Seed Data & Cleanup Instructions (For Live Environments)

When demonstrating against a running local or staging cluster:

### Step 1: Submit Test Jobs
```bash
# Submit a normal report generation job
curl -s -X POST http://127.0.0.1:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: test-tenant-key-alpha" \
  -d '{"jobType":"GENERATE_REPORT","payload":{"reportId":"DEMO-001","format":"PDF"},"priority":85}'

# Submit a deliberate DLQ poison job (permanent failure)
curl -s -X POST http://127.0.0.1:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: test-tenant-key-alpha" \
  -d '{"jobType":"POISON_TASK","payload":{"trigger":"PERMANENT_FAILURE"},"priority":50,"maxRetries":1}'
```

### Step 2: Trigger Outbox Order Event
```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: test-tenant-key-alpha" \
  -d '{"customerEmail":"recruiter@example.com","amount":149.99,"idempotencyKey":"demo-key-2026"}'
```

### Step 3: Cleanup Demo Artifacts
```bash
# Discard test poison job via Admin API
curl -s -X POST http://127.0.0.1:8080/api/v1/admin/dlq/{jobId}/discard \
  -H "X-Admin-Key: qf_admin_secret_key_2026"
```
