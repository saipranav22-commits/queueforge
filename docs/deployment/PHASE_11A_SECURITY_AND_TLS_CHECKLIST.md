# QueueForge V2 — Security, TLS, and Reverse-Proxy Verification Checklist

**Author:** Principal Application Security Engineer & DevOps Lead  
**Date:** November 2026  
**Status:** VERIFIED & HARDENED  

---

## 1. Security Architecture & Boundary Verification

QueueForge V2 implements a defense-in-depth security perimeter combining host network isolation, edge TLS termination, reverse-proxy header mapping, application interceptors, and DTO projection sanitization.

### Security Gates Summary

| Security Boundary | Mechanism | Verified Behavior |
| :--- | :--- | :--- |
| **Host Network** | UFW Firewall + Docker Bridge | Only ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) are exposed. Zero database or backend ports are accessible from the host IP. |
| **Edge TLS Termination** | Host Caddy Proxy | Terminates TLS with Let's Encrypt certificates. Replaces incoming client `X-Forwarded-*` headers, setting `X-Forwarded-Proto: https`. |
| **Frontend Reverse Proxy** | Container Nginx (`frontend`) | Binds strictly to `127.0.0.1:8088`. Maps `$http_x_forwarded_proto` down to the Spring Boot backend. |
| **Backend Trust Framework** | `server.forward-headers-strategy=framework` | Spring Boot resolves request protocol from trusted reverse proxies. `httpRequest.isSecure()` returns `true`. |
| **Session Cookie Security** | `AuthController.java` | Issues `QF_SESSION` cookie with `HttpOnly=true`, `SameSite=Lax`, `Path=/api/v1`, and `Secure=true`. |
| **CSRF Defense** | `AdminAuthInterceptor.java` | Requires matching `X-CSRF-Token` header on all state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) with active cookie session. |
| **Public Demo Mode** | `AdminAuthInterceptor.java` | Exact allowlist for 5 summary telemetry endpoints. All detail routes (`/dlq/{id}`, `/tenants/{id}`, `/events/{id}`) return `401 Unauthorized`. |
| **Client Bundle Security** | `SecurityScan.test.ts` | Automated build-time audit verifies zero API keys or secrets are bundled into static frontend JavaScript assets. |

---

## 2. Public-Demo Read-Only Allowlist Matrix

In public demo mode (`QUEUEFORGE_PUBLIC_DEMO_MODE=true`), unauthenticated recruiters can view real-time system metrics, but all administrative mutations and sensitive customer records remain inaccessible:

| Endpoint | Method | Public Access | Response DTO | Sensitive Data Protection |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/admin/dlq` | `GET` | **ALLOW** | `DlqJobSummaryResponse` | Excludes raw payload and exception stack traces |
| `/api/v1/admin/dlq/{jobId}` | `GET` | **DENY (401)** | `DlqJobDetailResponse` | Requires owner authentication |
| `/api/v1/admin/dlq/{jobId}/replay` | `POST` | **DENY (401)** | `ReplayJobResponse` | Requires owner authentication + CSRF |
| `/api/v1/admin/dlq/{jobId}/discard`| `POST/DELETE`| **DENY (401)** | `DiscardJobResponse` | Requires owner authentication + CSRF |
| `/api/v1/admin/outbox/stats` | `GET` | **ALLOW** | `OutboxStatsResponse` | High-level delivery metrics only |
| `/api/v1/admin/outbox/events` | `GET` | **ALLOW** | `OutboxEventSummaryResponse`| Excludes payment payload and signature |
| `/api/v1/admin/outbox/events/{id}` | `GET` | **DENY (401)** | `OutboxEventDetailResponse` | Requires owner authentication |
| `/api/v1/admin/outbox/dispatch` | `POST` | **DENY (401)** | `Map<String, Object>` | Requires owner authentication + CSRF |
| `/api/v1/admin/tenants` | `GET` | **ALLOW** | `TenantSummaryResponse` | Excludes `apiKey` and `apiKeyHash` |
| `/api/v1/admin/tenants/{id}` | `GET` | **DENY (401)** | `TenantDetailResponse` | Excludes tenant secret keys |
| `/api/v1/admin/tenants` | `POST` | **DENY (401)** | `TenantDetailResponse` | Requires owner authentication + CSRF |
| `/api/v1/admin/tenants/scheduler-config`| `GET` | **ALLOW** | `FairShareConfigResponse`| Scheduler quantum configuration only |

---

## 3. Domain & Public TLS Scenarios

| Deployment Scenario | DNS Requirement | TLS Provider | Configuration Required |
| :--- | :--- | :--- | :--- |
| **A. Custom Domain (Recommended)** | A Record -> `<server_ip>` (e.g. `queueforge.yourdomain.com`) | Caddy (Automated Let's Encrypt) | Standard Caddyfile reverse proxy to `127.0.0.1:8088`. Zero manual certificate renewal. |
| **B. Free Dynamic DNS Hostname** | DynDNS A Record -> `<server_ip>` (e.g. `queueforge.duckdns.org`) | Caddy (Automated Let's Encrypt) | Same as custom domain; valid public DNS name triggers standard ACME HTTP-01 challenge. |
| **C. Owner Staging (Direct IP)** | None (Access via `http://<server_ip>:8088` or SSH tunnel) | Self-Signed or Plain HTTP | Internal staging before public DNS activation. Public demo mode must remain **disabled**. |

---

## 4. Pre-Deployment Security Verification Commands

Execute on the live server prior to opening public traffic:

```bash
# 1. Verify firewall blocks internal database ports externally
nc -zv <server_ip> 5432 && echo "VULNERABILITY: DB Port 5432 is exposed!" || echo "PASS: DB Port 5432 is closed."

# 2. Verify frontend binds only to loopback
ss -tuln | grep 8088 | grep "127.0.0.1:8088" && echo "PASS: Loopback bound." || echo "FAIL: Bound publicly!"

# 3. Verify .env file permissions
ls -l /opt/queueforge/.env | grep -E "^-rw-------" && echo "PASS: Permissions 600." || echo "FAIL: Insecure permissions!"

# 4. Verify Caddy reverse proxy rewrites X-Forwarded-Proto
curl -kI https://queueforge.yourdomain.com/api/v1/auth/session | grep -i "strict-transport-security"
```
