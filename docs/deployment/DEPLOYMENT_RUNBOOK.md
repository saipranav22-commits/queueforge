# QueueForge V2 — Production Deployment Runbook & Operating Manual

**Author**: Staff DevOps Engineer & Principal Cloud Architect  
**Date**: November 2026  
**Status**: TESTED RUNBOOK  
**Target OS**: Ubuntu 22.04 / 24.04 LTS (x86_64)  
**Target Hardware**: 2 vCPUs, 4 GB RAM, 40+ GB SSD (e.g. Hetzner CX23 or DO Droplet)  

---

## 1. Prerequisites & Host Provisioning

### 1.1 Operating System & Firewall Setup
1. Connect via SSH to the provisioned Linux server:
   ```bash
   ssh root@<server_ip>
   ```
2. Update system packages and configure UFW firewall (allow only SSH, HTTP, and HTTPS):
   ```bash
   apt-get update && apt-get upgrade -y
   apt-get install -y ufw curl git jq gzip
   
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp comment 'SSH'
   ufw allow 80/tcp comment 'HTTP'
   ufw allow 443/tcp comment 'HTTPS'
   ufw --force enable
   ```

### 1.2 Install Docker Engine & Docker Compose V2
Install official Docker CE:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
docker --version && docker compose version
```

---

## 2. Repository Deployment & Configuration

### 2.1 Clone Repository
```bash
git clone https://github.com/saipranav22-commits/queueforge.git /opt/queueforge
cd /opt/queueforge
git checkout 5c1e2ca394ac483fff272421fa6323326c1bea6b
```

### 2.2 Generate Cryptographic Secrets
Run the following commands to generate high-entropy secrets and write them to `.env`:
```bash
cat <<EOF > .env
# ------------------------------------------------------------------------------
# QueueForge V2 Production Secrets (Generated on $(date -u))
# ------------------------------------------------------------------------------
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
RECEIVER_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
ADMIN_API_KEY=$(openssl rand -hex 32)
RECEIVER_SERVICE_KEY=$(openssl rand -hex 32)
FRONTEND_PORT=80
QUEUEFORGE_CORS_ALLOWED_ORIGINS=https://queueforge.yourdomain.com
EOF

chmod 600 .env
```

---

## 3. Production Multi-Container Launch

QueueForge V2 uses `docker-compose.v2.yml` with production memory constraints.

### 3.1 Build and Start the 7-Service Topology
```bash
docker compose -f docker-compose.v2.yml build --no-cache
docker compose -f docker-compose.v2.yml up -d
```

### 3.2 Verify Cluster Healthchecks
Monitor healthcheck transitions until all services report healthy:
```bash
docker compose -f docker-compose.v2.yml ps
```
Expected output:
```text
NAME                     IMAGE                              STATUS                   PORTS
qf-v2-api-server         queueforge-backend:v2              Up (healthy)             
qf-v2-frontend           queueforge-frontend:v2             Up (healthy)             0.0.0.0:80->80/tcp
qf-v2-payment-receiver   queueforge-payment-receiver:v2     Up (healthy)             
qf-v2-receiver-db        postgres:16.8-alpine               Up (healthy)             
qf-v2-sender-db          postgres:16.8-alpine               Up (healthy)             
qf-v2-worker-1           queueforge-backend:v2              Up (healthy)             
qf-v2-worker-2           queueforge-backend:v2              Up (healthy)             
```

---

## 4. TLS & Domain Configuration

For automatic Let's Encrypt TLS certificate management with modern cipher suites and zero maintenance, use **Caddy** as a lightweight edge proxy in front of Nginx (or Certbot with Nginx).

### 4.1 Caddy Edge Setup (Recommended)
1. Install Caddy:
   ```bash
   apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
   apt-get update && apt-get install -y caddy
   ```
2. Configure `/etc/caddy/Caddyfile`:
   ```caddy
   queueforge.yourdomain.com {
       reverse_proxy 127.0.0.1:8088
       encode gzip zstd
       header {
           Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
           X-Content-Type-Options "nosniff"
           X-Frame-Options "DENY"
       }
   }
   ```
3. Restart Caddy:
   ```bash
   systemctl restart caddy
   ```
Caddy automatically provisions, binds, and renews a trusted Let's Encrypt TLS certificate.

---

## 5. Routine Operations & Maintenance

### 5.1 Inspecting Live Service Logs
```bash
# View combined cluster stream
docker compose -f docker-compose.v2.yml logs -f --tail=100

# Inspect worker heartbeat claims
docker compose -f docker-compose.v2.yml logs -f worker-1 worker-2

# Inspect payment receiver idempotency logs
docker compose -f docker-compose.v2.yml logs -f payment-receiver
```

### 5.2 Performing Rolling Container Restarts
To restart worker nodes without dropping HTTP traffic:
```bash
docker compose -f docker-compose.v2.yml restart worker-1
docker compose -f docker-compose.v2.yml restart worker-2
```

### 5.3 Automated Daily Database Backup
Add the following script to `/etc/cron.daily/queueforge-backup`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/queueforge"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%F_%H%M%S)

# Backup Sender Database (Jobs, Heartbeats, Outbox)
docker exec qf-v2-sender-db pg_dump -U queueforge_app queueforge | gzip > "$BACKUP_DIR/sender_db_$DATE.sql.gz"

# Backup Receiver Database (Charges, Idempotency)
docker exec qf-v2-receiver-db pg_dump -U queueforge_app queueforge_payment_receiver | gzip > "$BACKUP_DIR/receiver_db_$DATE.sql.gz"

# Retain only last 7 days of backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete
```
```bash
chmod +x /etc/cron.daily/queueforge-backup
```

---

## 6. Troubleshooting & Recovery Matrix

| Symptom | Diagnostic Command | Probable Cause | Corrective Action |
|---|---|---|---|
| **Worker OOM-Killed (Exit Code 137)** | `dmesg -T \| grep -i oom` | JVM heap exceeded container limit. | Verify `-Xmx220m` flag is active in container environment. Increase container limit to `512M` if custom payloads are large. |
| **Worker Disconnected in Fleet UI** | `SELECT * FROM qf_worker_heartbeats;` | Worker JVM crashed or thread pool deadlocked. | Inspect `docker logs qf-v2-worker-1`. Check `qf_worker_heartbeats` table; expired worker will automatically be marked `OFFLINE`. |
| **Outbox Events Backlogged in DISPATCHING** | `SELECT status, count(*) FROM qf_outbox_events GROUP BY status;` | Worker was terminated while HTTP call was in flight. | Worker heartbeat recovery loop will automatically reset orphan events back to `PENDING` after 5 seconds. |
| **Admin Login Returns HTTP 401** | Inspect browser network tab. | `ADMIN_API_KEY` in `.env` does not match key entered in UI unlock modal. | Retrieve actual key from server `.env`: `grep ADMIN_API_KEY /opt/queueforge/.env`. |
| **Payment Receiver 503 Gateway Error** | `docker logs qf-v2-payment-receiver` | `receiver-db` is not healthy or unreachable. | Verify `receiver-db` health status via `docker compose ps`. |
