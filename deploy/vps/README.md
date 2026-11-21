# QueueForge V2 — VPS Production Deployment Scripts

This directory contains production-grade, idempotent operational scripts designed to deploy and operate QueueForge V2 on a low-cost Linux VPS (e.g., Hetzner Cloud CX23, DigitalOcean Droplet, 2 vCPUs, 4 GB RAM).

## Operational Workflow

| Step | Script | Purpose |
| :--- | :--- | :--- |
| **1. Host Prep** | `prepare-host.sh` | Configures UFW firewall, installs Docker Engine, creates a 2 GB swapfile, sets kernel parameters. |
| **2. Preflight** | `preflight.sh` | Validates environment variables, secret entropy, available memory/disk, and port availability. |
| **3. Deploy** | `deploy.sh` | Builds or pulls container images, validates compose configuration, and starts the 7-service topology. |
| **4. Healthcheck** | `healthcheck.sh` | Validates container states, Spring Boot actuator readiness probes, database connectivity, and worker heartbeats. |
| **5. Seed Data** | `seed-demo-data.sh` | (Optional) Populates safe synthetic demonstration data for recruiter portfolio presentation. |
| **6. Daily Backup** | `backup.sh` | Performs atomic `pg_dump` backups for both PostgreSQL instances, verifies SHA-256 checksums, enforces 7-day retention. |
| **7. Restore Test** | `restore-test.sh` | Verifies backup integrity by executing test restorations in ephemeral containers without touching production data. |

## Target Architecture

```text
Internet (Port 80 / 443)
       │
   [Host TLS] (Caddy / Let's Encrypt)
       │
127.0.0.1:8088
       ▼
 [qf-prod-frontend] (Nginx Reverse Proxy & Static UI)
       │
   [Internal Docker Networks]
       ├── api-server (Spring Boot Ingestion API & Control Plane)
       ├── worker-1 (Independent JVM: Queue Execution & Outbox Dispatcher)
       ├── worker-2 (Independent JVM: Queue Execution & Outbox Dispatcher)
       ├── sender-db (PostgreSQL 16: Primary Queue & Outbox Storage)
       ├── receiver-db (PostgreSQL 16: Idempotent Payment Inbox)
       └── payment-receiver (Independent JVM: Webhook Target)
```

## Security Invariants

1. **Zero Database Exposure:** Database ports are never mapped to host interfaces.
2. **Loopback Only:** Frontend binds exclusively to `127.0.0.1:8088`. Public TLS must terminate at the host level.
3. **Fail-Fast Secrets:** Missing or default passwords abort startup immediately.
4. **Least-Privilege Containers:** All Java and Nginx services run as unprivileged non-root users (`queueforge`, `receiver`).
