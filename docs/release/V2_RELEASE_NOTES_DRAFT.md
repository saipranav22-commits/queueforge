# QueueForge V2 — Release Notes (Draft)

**Version:** `v2.0.0-RC1`  
**Target Branch:** `main`  
**Previous Version:** `v1.0.0`  

---

## What is QueueForge?

QueueForge is a transactional, guaranteed-delivery asynchronous task execution platform and operations console engineered with **Java 21**, **Spring Boot 3**, **PostgreSQL 16**, and **React 19**. It leverages PostgreSQL's `SELECT FOR UPDATE SKIP LOCKED` and cryptographic lease fencing to achieve rock-solid message queue semantics without the operational burden or dual-write risks of external message brokers like RabbitMQ or Kafka.

---

## What's New in QueueForge V2

### 1. Multi-Instance Worker Coordination
- **Decoupled Node Topology:** Run instances in `API_ONLY`, `WORKER_ONLY`, or `COMBINED` modes. Scale worker nodes horizontally across multiple containers or machines without central coordinator bottlenecks.
- **Cryptographic Lease Fencing:** Every claimed job receives a unique UUID fencing token and timestamped lease. Slow or zombie workers are prevented from writing stale updates back to the queue.
- **Autonomous Crash Recovery:** Background reapers detect expired worker leases and safely requeue abandoned jobs with exponential backoff and decorrelated jitter.

### 2. FairShare Multi-Tenant DRR Scheduler
- **Deficit Round Robin (DRR):** Solves the "noisy-neighbor" problem where bulk batch jobs from one client monopolize worker threads.
- **Cluster-Wide Concurrency Quotas:** Each tenant has an enforced `max_concurrency` limit respected across all worker nodes simultaneously.
- **Measurable Latency Protection:** In local burst testing, low-volume interactive tenants experienced an **89.8% reduction in p50 queue wait latency** under active batch floods.

### 3. Transactional Outbox & Real Cross-Service Delivery
- **ACID Outbox Event Publishing:** Order entity creation and outbox event persistence occur within the exact same PostgreSQL transaction—zero dual-write vulnerability.
- **Independent Payment Receiver:** Dispatches events over HTTP to a separate microservice backed by an independent physical database.
- **Consumer-Side Durable Idempotency:** The receiver utilizes an inbox deduplication pattern with SHA-256 payload fingerprinting, guaranteeing exactly-one business outcome even under network retries and dropped ACKs.

### 4. Enterprise Credential & API Security Hardening
- **SHA-256 API Key Storage:** Tenant API keys are cryptographically hashed upon registration (Flyway V7). No cleartext keys are stored in the database.
- **Constant-Time Verification:** All authentication tokens and API keys are verified via constant-time comparison to protect against side-channel timing attacks.
- **Tenant Anti-Enumeration:** Requests for jobs belonging to other tenants return `HTTP 404 Not Found` rather than `403 Forbidden`, preventing attacker enumeration of valid job IDs.
- **Service-to-Service Authentication:** Internal microservice endpoints require verified `X-Service-Key` headers.
- **Production Safety Gate:** Startup validation refuses to boot with default development secrets when the `prod` profile is active.

### 5. ChaosLab Distributed Fault-Injection Harness
- Automated test framework simulating process crashes, dropped HTTP responses, database disconnects, and concurrent worker fencing races.

---

## Architectural Comparison: V1 vs. V2

| Capability | QueueForge V1 | QueueForge V2 |
| :--- | :--- | :--- |
| **Process Topology** | Single combined JVM process | Scalable multi-instance topology (`API_ONLY`, `WORKER_ONLY`) |
| **Scheduling Algorithm** | Global FIFO / static priority | **FairShare Deficit Round Robin (DRR)** |
| **Tenant Concurrency Limits** | Unbounded | **Cluster-wide `max_concurrency` quotas** |
| **Noisy-Neighbor Defense** | Vulnerable to batch starvation | **89.8% p50 latency improvement** for quiet tenants |
| **Cross-Service Consistency**| Single-database transactions only | **Transactional Outbox with HTTP dispatch & deduplication** |
| **Credential Storage** | Plaintext keys | **SHA-256 verifiers** (`api_key_hash`) + cleartext drop |
| **Testing Harness** | In-process integration tests | **ChaosLab automated distributed fault harness** |
| **Automated Tests** | 82 backend tests | **144 backend + 13 receiver + 7 frontend tests (100% Green)** |

---

## Deployment Topology

QueueForge V2 is packaged as a 7-service Docker Compose topology:

1. **`sender-db`**: PostgreSQL 16.8 (Stores Queue, Tenants, Orders, and Outbox Events)
2. **`receiver-db`**: PostgreSQL 16.8 (Independent database for Payment Receiver)
3. **`api-server`**: QueueForge API Gateway running in `API_ONLY` mode (Port 8085 internal)
4. **`worker-1`**: Worker node 1 running in `WORKER_ONLY` mode (FairShare + Outbox Dispatcher)
5. **`worker-2`**: Worker node 2 running in `WORKER_ONLY` mode (FairShare + Outbox Dispatcher)
6. **`payment-receiver`**: Simulated Payment Receiver running in independent JVM (Port 8098 internal)
7. **`frontend`**: Nginx 1.27 + React 19 single-page console (Published to `127.0.0.1:8088`)

---

## New Configuration Requirements

| Environment Variable | Description | Default (Dev) | Production Requirement |
| :--- | :--- | :--- | :--- |
| `ADMIN_API_KEY` | Secret for administrative and tenant management API | `qf_admin_dev_secret_2026` | **Must be 64+ char high-entropy secret** |
| `DB_PASSWORD` | PostgreSQL master password | `qf_dev_secret_d_isolated_2026` | High-entropy secret |
| `RECEIVER_SERVICE_KEY` | Service-to-service auth key for outbox dispatch | `qf_v2_internal_service_key_2026` | High-entropy secret |
| `QUEUEFORGE_MODE` | Operational mode (`API_ONLY`, `WORKER_ONLY`, `COMBINED`) | `COMBINED` | Set explicitly per container/node |
| `QUEUEFORGE_OUTBOX_DISPATCHER_ENABLED` | Enables outbox background polling | `false` | Set `true` on worker nodes |
| `QUEUEFORGE_OUTBOX_PAYMENT_URL` | URL of payment receiver endpoint | `http://127.0.0.1:8098/...` | `http://payment-receiver:8098/...` in Docker |

---

## Migration Instructions (From V1 to V2)

1. **Flyway Migrations:** Migrations execute automatically on startup.
   - V5 creates the outbox and orders tables.
   - V6 creates `qf_tenants` and migrates existing jobs to the `'default'` tenant.
   - V7 hashes existing tenant API keys and clears plaintext secrets.
2. **Backward Compatibility:** Existing client code submitting jobs without specifying a tenant will continue functioning against the default tenant.
3. **Rollback Plan:** Standard database backup before applying V6/V7 is recommended. Schema changes are strictly additive, allowing phased rollback if needed.

---

## Performance Tradeoffs & Reliability Behaviors

- **Fairness vs. Peak Throughput:** FairShare DRR prioritizes multi-tenant fairness and SLA predictability over raw single-tenant queue draining speed. In burst benchmarks, raw throughput was ~35-40% lower than unconstrained FIFO, in exchange for protecting quiet tenants from starvation.
- **At-Least-Once Delivery Semantics:** The Transactional Outbox guarantees at-least-once HTTP delivery across service boundaries. Downstream consumers must utilize idempotency keys to ensure exactly-once business processing.

---

## Tested Verification Summary

- **Automated Backend Tests:** 144 / 144 Passed
- **Payment Receiver Tests:** 13 / 13 Passed
- **Frontend Unit Tests & Linter:** 7 / 7 Passed, 0 Lint Errors
- **Live Stack Smoke Test:** 6 / 6 Verification Stages Passed
- **Docker Compose Topology:** 7 / 7 Services Healthy
