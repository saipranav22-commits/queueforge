# QUEUEFORGE V2 — PHASE 13D: SCENARIO PROVENANCE & SAFETY PROTOCOL

**Document ID:** `QF-DOC-13D-SAFETY`  
**Classification:** Runtime Safety & Data Integrity Specification  
**Status:** Approved & Implemented  
**Branch:** `feature/v2-ultimate-control-plane`  

---

## 1. Core Principles of Data Integrity

A persistent issue in distributed systems developer tools is the deceptive practice of showing "silent mock fixtures" when a local backend is disconnected. Such behavior confuses operators, obscures network partitions, and destroys technical credibility during portfolio evaluation.

QueueForge V2 enforces **Four Inviolable Data Integrity Rules**:

1. **Explicit Data Provenance:** Every datum presented in the control plane must carry an unmistakable provenance tag:
   - `LIVE_CONNECTED`: Data retrieved from a live, responding Spring Boot API and PostgreSQL cluster.
   - `LIVE_OFFLINE`: Live mode active, but local backend containers are stopped. Displays honest disconnected indicators (`—` dashes, `OFFLINE` status, `Backend Daemons Disconnected`).
   - `SIMULATED_SCENARIO`: Deterministic simulation fixture loaded via opt-in user request. Accompanied by a persistent top banner.
   - `HISTORICAL_BENCHMARK`: Formally documented performance benchmark results recorded during verified empirical runs.
2. **Zero Live Mocking:** Live TanStack queries must **never** return fake zero counts or mock data when an API request fails.
3. **Sandbox Safety (Zero Network I/O):** Actions taken while in Scenario Mode (submitting jobs, replaying DLQ tasks, advancing DRR sweeps) mutate exclusively client-side state in memory. Zero HTTP mutations are dispatched to localhost ports or network gateways.
4. **Immediate Exit Path:** The operator must always have a 1-click mechanism (`Exit to Live Mode` or selecting `Live Mode`) to return immediately to honest live query mode.

---

## 2. Deterministic Scenario Catalog

QueueForge Command provides 5 purpose-built architectural scenarios designed to demonstrate the platform's distributed systems capabilities without requiring container infrastructure:

```
+-----------------------------------------------------------------------------------------------+
| SCENARIO 1: HEALTHY_CLUSTER — Nominal Multi-Node Cluster                                      |
| Primary Subsystem: Coordination & Throughput                                                  |
| Architectural Invariant: Lock-free partition claiming prevents database lock contention.      |
| Simulated Conditions:                                                                         |
| - Worker-1: 8/10 active slots (heartbeat 1.2s ago)                                            |
| - Worker-2: 7/10 active slots (heartbeat 2.1s ago)                                            |
| - Primary PostgreSQL Pool: 4 active / 20 total connections                                     |
| - Outbox Delivery Rate: 45 events/min with confirmed receipts                                 |
+-----------------------------------------------------------------------------------------------+
| SCENARIO 2: WORKER_FAILURE — Worker Heartbeat Loss & Orphan Recovery                          |
| Primary Subsystem: Fault Tolerance & Lease Recovery                                           |
| Architectural Invariant: Time-bounded leases (30s TTL) prevent split-brain on crash.          |
| Simulated Conditions:                                                                         |
| - Worker-2 heartbeat age: 28.4s (>15s stale threshold, flagged OFFLINE)                       |
| - Orphaned leases detected: 6 tasks                                                           |
| - Sweeper reclamation latency: 980ms                                                          |
| - Worker-1 safely absorbs orphaned tasks without double execution                             |
+-----------------------------------------------------------------------------------------------+
| SCENARIO 3: NOISY_NEIGHBOR — Multi-Tenant Contention & FairShare Throttling                   |
| Primary Subsystem: Deficit Round Robin (DRR) Scheduler                                        |
| Architectural Invariant: Head-of-line blocking eliminated; quiet tenants guaranteed turns.    |
| Simulated Conditions:                                                                         |
| - Noisy batch tenant (`tenant-fintech`): 50 queued batch jobs                                 |
| - Interactive quiet tenant (`tenant-enterprise`): 2 latency-sensitive jobs                    |
| - Empirical Benchmark: FIFO p50 wait 11,868ms vs FairShare p50 wait 1,210ms (89.8% cut)       |
| - Throughput trade-off: 21.2% aggregate throughput reduction disclosed                        |
+-----------------------------------------------------------------------------------------------+
| SCENARIO 4: OUTBOX_RETRY — Transactional Outbox 503 Retry & Idempotency                       |
| Primary Subsystem: At-Least-Once Delivery & Deduplication                                     |
| Architectural Invariant: Atomic order + outbox persistence guarantees zero lost events.       |
| Simulated Conditions:                                                                         |
| - Downstream Simulated Payment Receiver returning HTTP 503 Service Unavailable                 |
| - Outbox dispatcher entering Attempt #3 with Exponential Backoff + Jitter                     |
| - SHA-256 Idempotency Key deduplication prevents duplicate bank charges                      |
+-----------------------------------------------------------------------------------------------+
| SCENARIO 5: DLQ_POISON_RECOVERY — Poison Payload Quarantine & Forensic Replay                 |
| Primary Subsystem: Dead-Letter Queue & Reliability Lab                                        |
| Architectural Invariant: Permanent poison jobs quarantined without blocking queue worker.     |
| Simulated Conditions:                                                                         |
| - Poison payload: JSON corrupted malformed payload                                            |
| - Failure Classification: PERMANENT_FAILURE (`DataCorruptionException`)                       |
| - 3 failed retry attempts exhausted -> quarantined in `qf_dead_letter_jobs`                   |
| - Authenticated operator forensic inspector with full stack trace viewer                      |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Implementation & Hook Architecture

### 3.1 Context & Hook Hierarchy

```
       [ App.tsx ]
            │
            ▼
   <ScenarioProvider>  (Manages activeScenarioId, catalog, client-side mutations)
            │
            ├────────► useScenario() ───► ScenarioBanner, ScenarioSelectorMenu
            │
            └────────► useScenarioAwareCluster()
                            │
                            ├─► If Scenario Mode: Returns deterministic fixtures
                            │
                            └─► If Live Mode: Calls TanStack useDashboardStats, etc.
                                (Strictly passes honest live data; no mocks)
```

### 3.2 Automated Test Proof

The scenario safety protocol is formally verified by automated Vitest tests in `src/__tests__/ScenarioExplorer.test.tsx`:
- `initializes in Live Mode with zero active scenario` — **PASS**
- `activates WORKER_FAILURE scenario and renders correct metadata and banner` — **PASS**
- `cycles across all 5 deterministic scenarios cleanly` — **PASS**
- `executes safe client-side simulated mutations without network I/O` — **PASS**
- `exits scenario mode back to Live Mode upon exitScenario call` — **PASS**
- `renders CompactTelemetryRail with honest provenance tags in simulated vs live offline` — **PASS**

---

*Authored by Distributed Systems Reliability Lead — Phase 13D.*
