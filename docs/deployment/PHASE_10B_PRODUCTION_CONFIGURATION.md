# QueueForge V2 — Phase 10B: Production Configuration & Hardening Guide

**Author**: Senior DevOps Engineer & SRE Specialist  
**Date**: November 2026  
**Status**: APPROVED — PRODUCTION READY  
**Topology**: QueueForge V2 7-Container Topology (`docker-compose.prod.v2.yml`)  

---

## 1. Overview & Architecture Standards

This runbook defines the validated production configuration for QueueForge V2. It is engineered for single-node low-cost VPS hosting (e.g., Hetzner CX23, DigitalOcean Basic Droplet) while enforcing strict enterprise security boundaries:

1. **Zero External Port Exposure**: Only port `80` / `443` is exposed to the internet via an outer TLS reverse proxy. All internal services (`sender-db`, `receiver-db`, `payment-receiver`, `api-server`, `worker-1`, `worker-2`) communicate strictly over isolated Docker bridge networks.
2. **Reverse Proxy TLS Termination**: External HTTPS traffic is terminated at Caddy or Nginx, which proxies to `frontend` on `127.0.0.1:8088`.
3. **Forwarded Headers Security**: Spring Boot is configured with `server.forward-headers-strategy: framework` to inspect `X-Forwarded-Proto: https` and apply the `Secure` attribute to session cookies.
4. **Strict Secret Fail-Fast**: `docker-compose.prod.v2.yml` will refuse to start if production secrets (`DB_PASSWORD`, `ADMIN_API_KEY`, `RECEIVER_SERVICE_KEY`) are missing or using dev defaults.

---

## 2. Production Environment Specification (`.env.production.example`)

Create `/opt/queueforge/.env.production` on the target host:

```bash
# ==============================================================================
# QueueForge V2 Production Environment Variables
# Location: /opt/queueforge/.env.production
# Permissions: chmod 600 /opt/queueforge/.env.production
# ==============================================================================

# Database Credentials
DB_NAME=queueforge
RECEIVER_DB_NAME=queueforge_payment_receiver
DB_USERNAME=queueforge_app
# Generate with: openssl rand -base64 32
DB_PASSWORD=YOUR_HIGH_ENTROPY_DB_PASSWORD_HERE

# Administrative Authentication Key (Required for Operations Console & Mutations)
# Must not be 'qf_admin_dev_secret_2026'. Generate with: openssl rand -hex 32
ADMIN_API_KEY=YOUR_PRODUCTION_ADMIN_API_KEY_HERE

# Cross-Service Payment Receiver Authentication Key
# Generate with: openssl rand -hex 32
RECEIVER_SERVICE_KEY=YOUR_PRODUCTION_RECEIVER_SERVICE_KEY_HERE

# Host Binding Configuration
FRONTEND_PORT=8088

# Public Demonstration Controls
# When set to true, permits unauthenticated GET queries on DLQ and Outbox telemetry
QUEUEFORGE_PUBLIC_DEMO_MODE=true

# Production CORS Allowed Origins (Comma-separated HTTPS origins)
QUEUEFORGE_CORS_ALLOWED_ORIGINS=https://queueforge.example.com

# Worker Fleet Configuration
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=250
WORKER_LEASE_DURATION_SECONDS=30
WORKER_HEARTBEAT_INTERVAL_SECONDS=5
WORKER_RECOVERY_POLL_INTERVAL_MS=5000
```

---

## 3. Reverse Proxy Configuration (TLS Termination)

### 3.1 Option A: Caddy Server (Recommended: Automatic HTTPS)
Caddy automatically provisions and renews Let's Encrypt certificates with zero configuration.

`/etc/caddy/Caddyfile`:
```caddy
queueforge.example.com {
    reverse_proxy 127.0.0.1:8088 {
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {remote_host}
        header_up Host {host}
    }

    # Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### 3.2 Option B: Nginx + Certbot
If using standard Nginx:

`/etc/nginx/sites-available/queueforge`:
```nginx
server {
    listen 80;
    server_name queueforge.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name queueforge.example.com;

    ssl_certificate /etc/letsencrypt/live/queueforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/queueforge.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port 443;

        # WebSocket support for future reactive telemetry
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }
}
```

---

## 4. Reverse-Proxy Cookie Security Hardening

In standard Spring Boot deployments behind a reverse proxy, the client-to-proxy connection is HTTPS, but the proxy-to-container connection is plain HTTP (`http://frontend:80` -> `http://api-server:8085`).

### The Vulnerability Without Hardening
When `AuthController.java` calls:
```java
ResponseCookie.from(SESSION_COOKIE_NAME, session.getSessionId())
    .httpOnly(true)
    .secure(httpRequest.isSecure())
```
`httpRequest.isSecure()` evaluates to `false` because the immediate hop from the reverse proxy is unencrypted HTTP. Consequently, the browser session cookie is transmitted without the `Secure` attribute, leaving it vulnerable to interception over unencrypted HTTP channels.

### The Phase 10B Resolution
In `backend/src/main/resources/application.yml` and `application-prod.yml`:
```yaml
server:
  forward-headers-strategy: framework
```
This instructs Spring Boot's web container to register `ForwardedHeaderFilter`. When the reverse proxy sends `X-Forwarded-Proto: https`, Spring Boot overrides `httpRequest.isSecure()` to `true`. As a result, the `QF_SESSION` cookie is issued with:
- `HttpOnly`: Prevents JavaScript XSS cookie extraction
- `Secure`: Transmitted exclusively over TLS
- `SameSite=Lax`: Mitigates cross-site request forgery

---

## 5. Database Connection Pooling Specifications

QueueForge leverages HikariCP for high-throughput, low-latency connection management:

```yaml
spring:
  datasource:
    hikari:
      pool-name: QueueForgeHikariPool
      maximum-pool-size: 15
      minimum-idle: 5
      idle-timeout: 300000       # 5 minutes
      connection-timeout: 20000  # 20 seconds
      max-lifetime: 1200000      # 20 minutes
```

### PostgreSQL Max Connections Budget
On a 4 GB VPS with 3 JVM instances connecting to `sender-db`:
- `api-server`: 15 connections max
- `worker-1`: 15 connections max
- `worker-2`: 15 connections max
- Superuser / maintenance reserve: 10 connections
- **Total PostgreSQL `max_connections` Required**: 55 (PostgreSQL default of 100 easily accommodates this).

---

## 6. Secrets Rotation & Maintenance Procedures

### 6.1 Admin API Key Rotation
1. Update `ADMIN_API_KEY` in `/opt/queueforge/.env.production`.
2. Perform rolling reload of the API server:
   ```bash
   docker compose -f docker-compose.prod.v2.yml up -d --no-deps api-server
   ```
3. Existing active sessions in `AuthSessionService` remain valid until their 8-hour expiry or server restart. Subsequent logins will require the new admin key.

### 6.2 Receiver Service Key Rotation
1. Update `RECEIVER_SERVICE_KEY` in `/opt/queueforge/.env.production`.
2. Reload `payment-receiver`, `worker-1`, and `worker-2`:
   ```bash
   docker compose -f docker-compose.prod.v2.yml up -d --no-deps payment-receiver worker-1 worker-2
   ```

---

## 7. Automated Database Backup Strategy

To ensure zero data loss on a single VPS, implement an automated daily backup cron for both databases.

`/opt/queueforge/scripts/backup-databases.sh`:
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/queueforge"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "${BACKUP_DIR}"

echo "[QueueForge Backup] Starting database dump at ${TIMESTAMP}..."

# Backup Primary Queue DB
docker exec qf-prod-sender-db pg_dump -U queueforge_app queueforge | gzip > "${BACKUP_DIR}/sender_db_${TIMESTAMP}.sql.gz"

# Backup Receiver DB
docker exec qf-prod-receiver-db pg_dump -U queueforge_app queueforge_payment_receiver | gzip > "${BACKUP_DIR}/receiver_db_${TIMESTAMP}.sql.gz"

# Retention: Delete backups older than 14 days
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +14 -delete

echo "[QueueForge Backup] Completed successfully."
```

Schedule daily via crontab (`crontab -e`):
```cron
0 3 * * * /opt/queueforge/scripts/backup-databases.sh >> /var/log/queueforge-backup.log 2>&1
```
