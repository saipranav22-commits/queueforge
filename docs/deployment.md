# QueueForge Production Deployment & Operations Guide

## 1. Architectural Overview

QueueForge is a robust, concurrent distributed task execution engine built with:
- **Backend**: Spring Boot 3.3.5 / Java 21 (Temurin runtime, non-root user `queueforge`)
- **Queue Engine**: PostgreSQL 16.8 (ACID guarantees, `SELECT FOR UPDATE SKIP LOCKED`, fencing tokens)
- **Frontend**: React 19 / TypeScript / Tailwind CSS / Vite served via Nginx 1.27 Alpine
- **Observability**: Prometheus v2.51.0 (internal metric scraping) & Grafana 10.4.1 (dashboards)

In production container mode (`docker-compose.prod.yml`), all inter-service communication is confined to an internal Docker bridge network (`queueforge-prod-network`). Only the Nginx frontend reverse proxy and optionally Prometheus/Grafana (bound strictly to `127.0.0.1`) are exposed.

```
       [ Client Browser ]
               │
        HTTP:8088 (127.0.0.1)
               ▼
   ┌───────────────────────┐
   │  Nginx Frontend Proxy │
   │  (queueforge-frontend)│
   └───────────┬───────────┘
               │ Internal Docker Network (backend:8085)
               ▼
   ┌───────────────────────┐         ┌────────────────────────┐
   │  Spring Boot Backend  │────────▶│ PostgreSQL 16 Database │
   │  (queueforge-backend) │         │ (queueforge-postgres)  │
   └───────────┬───────────┘         └────────────────────────┘
               │ Scrape: /actuator/prometheus
               ▼
   ┌───────────────────────┐         ┌────────────────────────┐
   │  Prometheus Scraper   │────────▶│   Grafana Dashboard    │
   │ (127.0.0.1:9091)      │         │   (127.0.0.1:3001)     │
   └───────────────────────┘         └────────────────────────┘
```

---

## 2. Prerequisites & Environment Configuration

1. **Docker Engine**: Docker 26+ and Docker Compose v2.20+.
2. **Configuration**: Copy `.env.production.example` to `.env.production`:
   ```bash
   cp .env.production.example .env.production
   ```
3. **Configure Environment Variables**:
   - `DB_NAME`: Database name (default: `queueforge`)
   - `DB_USERNAME`: Dedicated application user (e.g., `queueforge_app`)
   - `DB_PASSWORD`: Cryptographically random database password (>=32 characters)
   - `ADMIN_API_KEY`: Cryptographically secure API key for admin session authentication (>=64 characters)
   - `FRONTEND_PORT`: Host port to publish frontend (default: `8088`)
   - `GRAFANA_ADMIN_USER`: Grafana admin username (default: `qf_admin`)
   - `GRAFANA_ADMIN_PASSWORD`: Strong password for Grafana

---

## 3. Starting the Production Stack

```bash
docker compose -p queueforge-prod --env-file .env.production -f docker-compose.prod.yml up -d
```

### Checking Stack Status & Health
```bash
docker compose -p queueforge-prod -f docker-compose.prod.yml ps
```

All services will reach `healthy` status in dependency order:
1. `postgres`: Runs `pg_isready` check.
2. `backend`: Executes Flyway migrations (v1-v4) and reports readiness on `/actuator/health/readiness`.
3. `frontend`: Verifies Nginx liveness on `/health`.

---

## 4. Verification & Operational Endpoints

| Service | Access URL | Authentication |
| :--- | :--- | :--- |
| **Web Console** | `http://127.0.0.1:8088/` | Public read-only; admin features require Unlock |
| **System Health** | `http://127.0.0.1:8088/api/v1/system/health` | Public health indicator |
| **Job API** | `http://127.0.0.1:8088/api/v1/jobs` | Public submission & status retrieval |
| **Admin API** | `http://127.0.0.1:8088/api/v1/admin/` | Requires `QF_SESSION` cookie + `X-CSRF-Token` |
| **Prometheus** | `http://127.0.0.1:9091/` | Localhost only |
| **Grafana** | `http://127.0.0.1:3001/` | Form login (`GRAFANA_ADMIN_USER` / password) |

---

## 5. Backup and Disaster Recovery

### Database Backup (`pg_dump`)
```bash
docker exec queueforge-prod-postgres pg_dump -U queueforge_app -d queueforge -F c -b -v -f /tmp/queueforge_backup.dump
docker cp queueforge-prod-postgres:/tmp/queueforge_backup.dump ./backup_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore (`pg_restore`)
```bash
docker cp ./backup.dump queueforge-prod-postgres:/tmp/restore.dump
docker exec queueforge-prod-postgres pg_restore -U queueforge_app -d queueforge -v --clean /tmp/restore.dump
```

---

## 6. Security Limitations & Production Considerations

1. **In-Memory Session Store**: Admin sessions and CSRF tokens are currently maintained in backend JVM memory (`ConcurrentHashMap`). In a multi-replica clustered deployment, session state must be backed by a distributed cache (e.g., Redis).
2. **TLS / HTTPS Termination**: The containerized Nginx configuration serves plain HTTP on port 80. In public production, an edge proxy (such as Cloudflare, AWS ALB, Traefik, or Let's Encrypt Nginx reverse proxy) must terminate TLS, pass `X-Forwarded-Proto: https`, and enforce HTTP-to-HTTPS redirection.
3. **Secure Cookie Attribute**: The backend issues `Secure` cookies only when incoming requests indicate `request.isSecure()` or provide `X-Forwarded-Proto: https`. Ensure the edge TLS terminator forwards this header.
4. **Network Exposure**: Database port 5432 and backend port 8085 have zero published host ports. Never expose them to public network interfaces.
