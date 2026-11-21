# QueueForge V2 — Demonstration Data Strategy & Recruiter Experience Plan

**Author:** Principal Cloud Architect & Full-Stack Product Engineer  
**Date:** November 2026  
**Status:** APPROVED FOR STAGING  

---

## 1. Recruiter Demonstration Objectives

When engineering hiring managers, technical recruiters, and distributed systems interviewers visit the public QueueForge URL, they should immediately experience:
1. **Live High-Throughput Metrics:** Real-time charts showing job processing velocity, fair-share deficit counters, and worker fleet status.
2. **Multi-Tenant Scheduling Visualization:** Clear attribution showing jobs from `tenant-fintech` and `tenant-ecommerce` sharing cluster resources proportionally according to configured weights.
3. **Resilience & Fault Tolerance in Action:** Demonstrable Dead-Letter Queue (DLQ) entries showing categorized failures with automated exponential backoff history.
4. **Zero Authentication Friction:** Instant visual comprehension of the Obsidian Pulse dashboard without requiring credentials, registrations, or login modals.
5. **Clear Demonstration Attribution:** Obvious UI badging indicating demonstration mode, with owner-only administrative unlock capability.

---

## 2. Synthetic Data Generation Strategy

To ensure credibility without generating unconstrained load or spam, demonstration telemetry is seeded in controlled, repeatable batches:

### A. Synthetic Demonstration Tenants
- **NovaPay Global (`tenant-fintech`):**
  - Configured Weight: `3` (Consumes 75% of execution quanta under contention).
  - Max Concurrency: `4`.
  - Representative Workload: High-priority financial transactions (`PAYMENT_SETTLEMENT`).
- **Starlight Retail (`tenant-ecommerce`):**
  - Configured Weight: `1` (Consumes 25% of execution quanta under contention).
  - Max Concurrency: `2`.
  - Representative Workload: Batch order fulfillment and invoicing (`INVOICE_GENERATION`).

### B. Distributed Worker Fleet Heartbeats
- **`worker-prod-01` (Worker Node 1):**
  - Role: Primary partition claimant, outbox event dispatcher.
  - Active Heartbeat: Reporting healthy every 5 seconds to `qf_worker_heartbeats`.
- **`worker-prod-02` (Worker Node 2):**
  - Role: Secondary partition claimant, lease competition and failover node.
  - Active Heartbeat: Reporting healthy every 5 seconds to `qf_worker_heartbeats`.

### C. Transactional Outbox Events
- **Aggregate Types:** `ORDER_PLACED`, `PAYMENT_AUTHORIZED`.
- **Event Lifecycle:** Shows events transitioning from `PENDING` -> `DISPATCHING` -> `DELIVERED`, proving the dual-write transactional outbox pattern to the simulated payment receiver.

### D. Dead-Letter Queue (DLQ) Showcase Jobs
- **Categorized Failures:** Realistic failure categories (`DOWNSTREAM_TIMEOUT`, `RATE_LIMITED`, `PAYMENT_EXHAUSTION`).
- **Sanitized Presentation:** Demonstrates the 3-attempt backoff lifecycle while masking internal system stack traces in unauthenticated public responses.

---

## 3. Safe Seeding & Reset Procedures

- **Seeding Execution:** The project owner executes `deploy/vps/seed-demo-data.sh` via SSH or internal curl using the private `ADMIN_API_KEY`.
- **Bounded Retention:** Jobs are populated with finite batch sizes (e.g. 10–20 jobs). Workers process and complete them within seconds, transitioning metrics into the execution history.
- **Non-Destructive Reset Procedure:**
  To refresh demonstration metrics without dropping tables or re-running Flyway migrations:
  ```bash
  # Execute via psql on sender-db
  docker exec -i qf-prod-sender-db psql -U queueforge_app -d queueforge << 'EOF'
  UPDATE qf_jobs SET status = 'COMPLETED' WHERE status = 'RUNNING';
  DELETE FROM qf_outbox_events WHERE created_at < NOW() - INTERVAL '24 hours';
  EOF
  ```
