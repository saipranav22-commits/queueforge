# QueueForge V2 — VPS Deployment Architecture & Execution Plan

**Author:** Principal Cloud Infrastructure Architect & Senior DevOps Engineer  
**Date:** November 2026  
**Status:** COMPLETE & READY FOR OPERATOR SELECTION  

---

## 1. End-to-End System Architecture

```text
                        [Internet / Public Recruiter Traffic]
                                       │
                                       ▼ HTTPS (Port 443)
                    ┌─────────────────────────────────────┐
                    │  Host Edge Proxy (Caddy Server)     │
                    │  - Let's Encrypt TLS Termination    │
                    │  - Strips Client Forwarding Headers │
                    │  - Sets X-Forwarded-Proto: https    │
                    └──────────────────┬──────────────────┘
                                       │ HTTP (Loopback 127.0.0.1:8088)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Docker Host: 2 vCPUs, 4 GB RAM, 40+ GB NVMe (e.g. Hetzner CX23 / Ubuntu LTS)│
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ qf-prod-frontend (Nginx Reverse Proxy & Static React Console)         │  │
│  │ - Serves Obsidian Pulse SPA (Vite Production Assets)                  │  │
│  │ - Forwards /api/ to api-server:8085                                   │  │
│  │ - Preserves Forwarded Protocol Map                                    │  │
│  └───────────────────┬───────────────────────────────────────────────────┘  │
│                      │                                                      │
│                      ▼ (qf-prod-frontend-net)                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ qf-prod-api-server (Spring Boot JVM, Ingestion & Admin API)           │  │
│  │ - Mode: API_ONLY                                                      │  │
│  │ - Dual-Mode Auth (X-Admin-Key / QF_SESSION HttpOnly Cookie)          │  │
│  │ - Demo Mode: Read-Only Allowlist (5 endpoints)                        │  │
│  └───────┬───────────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          ▼ (qf-prod-backend-net)                                            │
│  ┌───────────────────────────────┐     ┌─────────────────────────────────┐  │
│  │ qf-prod-sender-db (PG 16)     │     │ qf-prod-worker-1 (Spring Boot)  │  │
│  │ - Durable Queue Tables        │◄────┤ - Worker Node 1 Heartbeat       │  │
│  │ - Transactional Outbox Events │     │ - FairShare Scheduling          │  │
│  │ - Bounded Connection Pool     │     │ - Outbox Dispatcher             │  │
│  └───────────────────────────────┘     └───────────────┬─────────────────┘  │
│                                                        │                    │
│                                        ┌───────────────┴─────────────────┐  │
│                                        │ qf-prod-worker-2 (Spring Boot)  │  │
│                                        │ - Worker Node 2 Heartbeat       │  │
│                                        │ - Distributed Lease Competition │  │
│                                        │ - Failover & Fencing            │  │
│                                        └───────────────┬─────────────────┘  │
│                                                        │                    │
│                                                        ▼                    │
│  ┌───────────────────────────────┐     ┌─────────────────────────────────┐  │
│  │ qf-prod-receiver-db (PG 16)   │     │ qf-prod-payment-receiver (JVM)  │  │
│  │ - Ledger / Charges Table      │◄────┤ - Validates RECEIVER_SERVICE_KEY│  │
│  │ - Idempotency Records         │     │ - Signature Verification        │  │
│  └───────────────────────────────┘     └─────────────────────────────────┘  │
│                     ▲ (qf-prod-receiver-net)                                │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 2. Resource Allocation & Hardware Footprint

| Service | Base Image | Limits (CPU / RAM) | Java Memory Flag | Internal Port | Host Port |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **sender-db** | `postgres:16.8-alpine` | 1.0 CPU / 384 MB | N/A | 5432 | None |
| **receiver-db** | `postgres:16.8-alpine` | 0.5 CPU / 256 MB | N/A | 5432 | None |
| **payment-receiver**| `eclipse-temurin:21-jre-alpine`| 0.5 CPU / 256 MB | `-Xmx160m -Xms32m -Xss256k` | 8098 | None |
| **api-server** | `eclipse-temurin:21-jre-alpine`| 1.0 CPU / 512 MB | `-Xmx280m -Xms64m -Xss256k` | 8085 | None |
| **worker-1** | `eclipse-temurin:21-jre-alpine`| 0.8 CPU / 384 MB | `-Xmx220m -Xms64m -Xss256k` | 8086 | None |
| **worker-2** | `eclipse-temurin:21-jre-alpine`| 0.8 CPU / 384 MB | `-Xmx220m -Xms64m -Xss256k` | 8087 | None |
| **frontend** | `nginx:1.27-alpine` | 0.5 CPU / 128 MB | N/A | 80 | `127.0.0.1:8088` |
| **TOTALS** | — | **5.1 vCPU (burst) / 2.3 GB RAM** | — | — | **1 loopback** |

- **Host Memory Balance:** On a 4.0 GB RAM server, 2.3 GB allocated to containers leaves **1.7 GB available** for the host Linux kernel, Caddy reverse proxy, file cache, and Docker daemon.
- **Safety Margin:** An active **2 GB swapfile** (`/swapfile`) prevents OOM kills during transient spikes.

---

## 3. Host Filesystem Layout

```text
/opt/queueforge/
├── .env                       # 0600 root:root (High-entropy production secrets)
├── docker-compose.prod.v2.yml # 0644 root:root (Hardened compose topology)
├── backups/                   # 0700 root:root (Nightly coordinated pg_dump archives)
│   ├── sender_db_YYYYMMDD.sql.gz
│   └── receiver_db_YYYYMMDD.sql.gz
├── logs/                      # 0755 root:root (JSON-file logs rotated at 10MB)
└── deploy/
    └── vps/                   # Operational management scripts
        ├── prepare-host.sh
        ├── preflight.sh
        ├── deploy.sh
        ├── healthcheck.sh
        ├── backup.sh
        ├── restore-test.sh
        └── seed-demo-data.sh
```

---

## 4. Operational Execution Runbook

### Step 1: Host Preparation (One-time setup)
```bash
ssh root@<server_ip>
git clone https://github.com/saipranav22-commits/queueforge.git /opt/queueforge
cd /opt/queueforge
bash deploy/vps/prepare-host.sh
```

### Step 2: Configure Production Secrets
```bash
cp .env.production.example .env
chmod 600 .env

# Generate high-entropy production secrets
sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -base64 24 \| tr -d '/+=')|" .env
sed -i "s|ADMIN_API_KEY=.*|ADMIN_API_KEY=$(openssl rand -hex 32)|" .env
sed -i "s|RECEIVER_SERVICE_KEY=.*|RECEIVER_SERVICE_KEY=$(openssl rand -hex 32)|" .env
sed -i "s|QUEUEFORGE_PUBLIC_DEMO_MODE=.*|QUEUEFORGE_PUBLIC_DEMO_MODE=true|" .env
```

### Step 3: Run Preflight & Deploy
```bash
bash deploy/vps/preflight.sh
bash deploy/vps/deploy.sh
```

### Step 4: Configure Edge TLS (Caddyfile)
Add to `/etc/caddy/Caddyfile`:
```caddy
queueforge.yourdomain.com {
    reverse_proxy 127.0.0.1:8088
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```
Reload Caddy:
```bash
systemctl reload caddy
```

### Step 5: Seed Demonstration Workload
```bash
bash deploy/vps/seed-demo-data.sh
```
