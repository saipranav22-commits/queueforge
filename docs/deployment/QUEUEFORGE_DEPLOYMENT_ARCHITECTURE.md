# QueueForge V2 — Deployment Architecture & Infrastructure Specification

**Author**: Principal Cloud Architect & Staff DevOps Engineer  
**Date**: November 2026  
**Status**: APPROVED ARCHITECTURE  
**Target Platform**: Linux VPS / Container Topology  

---

## 1. Executive Summary

QueueForge V2 is a resilient distributed task execution and operations platform engineered in **Java 21 (Spring Boot 3.3.5)**, **PostgreSQL 16.8**, and **React 19 (Obsidian Pulse)**. Unlike simple web applications, QueueForge V2 is a multi-process distributed system consisting of:
1. An **API Server node** handling authenticated tenant ingestion and operational REST requests.
2. Two or more **independent Worker JVM nodes** claiming jobs concurrently via `SKIP LOCKED` row-level database locks, tracking dynamic heartbeats, and relaying transactional outbox events.
3. An **independent Simulated Payment Receiver service** with its own isolated database, verifying cross-service transactional outbox delivery and idempotent charge processing.
4. An **Nginx reverse proxy** serving the Obsidian Pulse frontend SPA and securely routing `/api/` traffic.

This document specifies the exact runtime requirements, resource allocations, network isolation topologies, and hosting options tailored for an individual developer portfolio.

---

## 2. Complete Runtime Service Architecture

The full QueueForge V2 production topology comprises seven distinct container services across three isolated bridge networks:

```mermaid
flowchart TD
    subgraph Public["Public Internet (Encrypted)"]
        Client["Browser Client / Recruiter / API Consumer"]
    end

    subgraph Edge["Edge Layer (Port 80/443)"]
        Nginx["Nginx Reverse Proxy & Static Asset Server<br/>(Port 8088 / 443)<br/>[Memory Limit: 192 MB]"]
    end

    subgraph FrontendNet["Internal Network: qf-v2-frontend-net"]
        APIServer["API Server Node (Spring Boot 3)<br/>QUEUEFORGE_MODE: API_ONLY<br/>(Port 8085 internal)<br/>[Memory Limit: 384 MB]"]
    end

    subgraph BackendNet["Internal Network: qf-v2-backend-net"]
        SenderDB[("Primary Sender DB<br/>PostgreSQL 16.8-alpine<br/>(Port 5432 internal)<br/>[Memory Limit: 256 MB]")]
        Worker1["Worker Node 1 (Spring Boot 3)<br/>QUEUEFORGE_MODE: WORKER_ONLY<br/>(Port 8086 internal)<br/>[Memory Limit: 384 MB]"]
        Worker2["Worker Node 2 (Spring Boot 3)<br/>QUEUEFORGE_MODE: WORKER_ONLY<br/>(Port 8087 internal)<br/>[Memory Limit: 384 MB]"]
    end

    subgraph ReceiverNet["Internal Network: qf-v2-receiver-net"]
        ReceiverDB[("Receiver DB<br/>PostgreSQL 16.8-alpine<br/>(Port 5432 internal)<br/>[Memory Limit: 256 MB]")]
        PaymentReceiver["Payment Receiver Service (Spring Boot 3)<br/>(Port 8098 internal)<br/>[Memory Limit: 256 MB]"]
    end

    Client -->|HTTPS / Port 443| Nginx
    Nginx -->|Static Assets| Nginx
    Nginx -->|/api/* Proxy| APIServer
    APIServer -->|HikariCP / JDBC| SenderDB
    Worker1 -->|SKIP LOCKED Claims & Heartbeats| SenderDB
    Worker2 -->|SKIP LOCKED Claims & Heartbeats| SenderDB
    Worker1 -.->|Outbox HTTP Relay (Pre-Shared Key Auth)| PaymentReceiver
    Worker2 -.->|Outbox HTTP Relay (Pre-Shared Key Auth)| PaymentReceiver
    PaymentReceiver -->|Idempotent Inbox Charges| ReceiverDB
```

### 2.1 Service Specifications

| Service | Container Image | Base Image | Role / Responsibilities | Ports Exposed | Memory Limit | JVM Tuning |
|---|---|---|---|---|---|---|
| **frontend** | `queueforge-frontend:v2` | `nginx:1.27-alpine` | Serves Obsidian Pulse SPA, enforces CSP/security headers, proxies `/api/` | `80/443` (Host) | `192 MB` | N/A |
| **api-server** | `queueforge-backend:v2` | `eclipse-temurin:21-jre-alpine` | Ingests jobs, serves dashboard/admin queries, manages tenant auth (`API_ONLY`) | None (Internal) | `384 MB` | `-XX:+UseSerialGC -Xmx220m -Xms64m -XX:TieredStopAtLevel=1` |
| **worker-1** | `queueforge-backend:v2` | `eclipse-temurin:21-jre-alpine` | Claims jobs, updates fencing tokens, heartbeats to `qf_worker_heartbeats`, outbox dispatch (`WORKER_ONLY`) | None (Internal) | `384 MB` | `-XX:+UseSerialGC -Xmx220m -Xms64m -XX:TieredStopAtLevel=1` |
| **worker-2** | `queueforge-backend:v2` | `eclipse-temurin:21-jre-alpine` | Concurrent lease contention, crash recovery, dual-fenced execution (`WORKER_ONLY`) | None (Internal) | `384 MB` | `-XX:+UseSerialGC -Xmx220m -Xms64m -XX:TieredStopAtLevel=1` |
| **sender-db** | `postgres:16.8-alpine` | `postgres:16.8-alpine` | Primary ACID queue, tenant quotas, outbox events, worker heartbeats | None (Internal) | `256 MB` | `shared_buffers=64MB, work_mem=4MB` |
| **payment-receiver** | `queueforge-payment-receiver:v2` | `eclipse-temurin:21-jre-alpine` | Independent payments microservice; verifies pre-shared key, ensures idempotent charge writes | None (Internal) | `256 MB` | `-XX:+UseSerialGC -Xmx160m -Xms32m -XX:TieredStopAtLevel=1` |
| **receiver-db** | `postgres:16.8-alpine` | `postgres:16.8-alpine` | Dedicated database for payment receiver (strict 2-database microservice boundary) | None (Internal) | `256 MB` | `shared_buffers=64MB, work_mem=4MB` |
| **Total** | | | | **1 Host Port** | **2,112 MB (~2.1 GB)** | |

---

## 3. Network Isolation & Security Boundaries

QueueForge enforces strict network segmentation to ensure database security and cross-service isolation:

1. **`qf-v2-frontend-net`**: Shared only between `frontend` (Nginx) and `api-server`. The external client can only reach Nginx; `api-server` is not directly addressable from the internet.
2. **`qf-v2-backend-net`**: Shared between `api-server`, `worker-1`, `worker-2`, and `sender-db`. PostgreSQL port `5432` is strictly unmapped to the host, preventing external database exposure.
3. **`qf-v2-receiver-net`**: Shared between `worker-1`, `worker-2`, `payment-receiver`, and `receiver-db`. Neither the payment receiver nor its database can be reached from the internet or the public frontend network. Outbox relays communicate strictly over this internal subnet.

---

## 4. Hosting Options Evaluation (Cost & Suitability for Portfolio)

To choose an optimal deployment platform for an individual developer or student portfolio, we evaluated four distinct hosting models based on verified 2026 pricing and technical constraints:

### Option A: Single Linux VPS Running Docker Compose (RECOMMENDED)
- **Providers Evaluated**:
  - **Hetzner Cloud CX23** (Verified 2026 Pricing: ~€4.49 to €5.49 / month, ~$5.00–$6.00 / month): 2 vCPUs (Intel/AMD), 4 GB RAM, 40 GB NVMe SSD, 20 TB traffic, 1 IPv4 included.
  - **DigitalOcean Basic Droplet** (Verified 2026 Pricing: $24.00 / month): 2 vCPUs, 4 GB RAM, 80 GB SSD, 4 TB transfer.
- **Suitability**: **EXCELLENT**. All 7 services run simultaneously within 2.1 GB RAM, leaving ~1.9 GB of headroom for OS buffers and caching. Complete control over networking, zero cold starts, single-command lifecycle (`docker compose -f docker-compose.v2.yml up -d`), and predictable monthly cap.

### Option B: Managed Container Platforms + Managed Databases (Render / Railway / Fly.io)
- **Pricing Breakdown (Render verified 2026)**:
  - 2 Managed Postgres instances (Basic 256MB): $6 × 2 = $12/month
  - 1 API Web Service (2 GB RAM Starter/Standard): $25/month
  - 2 Background Worker services (2 GB RAM each): $25 × 2 = $50/month
  - 1 Receiver Web Service (512MB Starter): $7/month
  - Total Monthly Cost: **~$94.00 to $110.00 / month**!
- **Suitability**: **POOR**. Unjustifiably expensive for a portfolio showcase. Free tiers sleep after 15 minutes of inactivity, breaking background worker heartbeat tracking and lease recovery.

### Option C: Hybrid Architecture (Static Frontend on Cloudflare/Vercel + Backend on VPS)
- **Pricing**: Cloudflare Pages (Free) + Small VPS ($5–$6/month).
- **Suitability**: **FAIR**. Complicates deployment by requiring separate DNS domains, CORS configuration across origins, and exposes the backend API directly to the public web rather than keeping it safely shielded behind an internal Nginx container.

### Option D: Controlled On-Demand Demo (Cloud VM with Automated Scheduled Sleep)
- **Pricing**: Hetzner hourly billing (~€0.008/hour). Running 40 hours during active recruiter review costs **< €0.50 / month**.
- **Suitability**: **STRONG ALTERNATIVE**. Provides a production-grade live environment with near-zero idle cost when using automated shutdown scripts.

---

## 5. Architectural Recommendation

| Criteria | Recommendation | Justification |
|---|---|---|
| **Platform** | **Single Linux VPS (Hetzner Cloud CX23 or DigitalOcean 4GB)** | Capable of hosting all 7 services within 2.1 GB budget at predictable €4.50–$6/month cost. |
| **Orchestration** | **Docker Compose V2** | Mirrors exact local and CI verification architecture; 100% reproducible. |
| **TLS / SSL** | **Caddy or Certbot + Nginx** | Automatic free Let's Encrypt certificates with HTTP/2 and modern cipher suites. |
| **Database Storage** | **Named Docker Volumes on Host NVMe** | High-performance ACID writes with simple directory-level snapshot backups. |
| **Worker Concurrency**| **2 Workers × 2 Concurrency (4 Total Slots)** | Proves multi-instance distributed coordination without starving VM CPU/RAM. |

---

## 6. Storage & Backup Strategy

1. **Named Volumes**:
   - `qf-v2-sender-data`: Stores all job records, execution history, outbox events, and worker heartbeats.
   - `qf-v2-receiver-data`: Stores payment receiver charge records and idempotency tables.
2. **Automated Backup Runbook**:
   - Daily automated `pg_dump` execution via cron:
     ```bash
     docker exec qf-v2-sender-db pg_dump -U queueforge_app queueforge | gzip > /var/backups/queueforge/sender_$(date +%F).sql.gz
     ```
   - 7-day retention policy with automatic log rotation.
