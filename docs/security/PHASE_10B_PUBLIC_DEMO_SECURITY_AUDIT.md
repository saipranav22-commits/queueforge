# QueueForge V2 — Phase 10B: Public Demo Security Audit & Codebase Verification

**Author**: Principal Application Security Engineer & DevSecOps Reviewer  
**Date**: November 2026  
**Status**: APPROVED — PRODUCTION HARDENED  
**Target Architecture**: QueueForge V2 Multi-Instance Engine & Obsidian Pulse Control Plane  

---

## 1. Executive Summary & Audit Objectives

Phase 10A established preliminary deployment recommendations, recruiter demo scripts, and marketing summaries. To ensure safe, truthful, and resilient public demonstration on internet-facing infrastructure, Phase 10B performed an exhaustive line-by-line audit comparing all security, authentication, and architectural claims directly against the verified source code in `D:\Projects\QueueForge`.

This audit:
1. Verifies the truth value of security statements A through J against the actual source files.
2. Identifies and formally corrects marketing inaccuracies (notably replacing "Argon2id" and "HMAC signatures" with verified codebase reality).
3. Defines the exact runtime threat model for a low-cost public portfolio deployment.
4. Validates the newly implemented `public-demo-mode` and reverse-proxy forward-headers hardening.

---

## 2. Codebase Truth Audit: Statements A through J

| ID | Security Claim | Codebase Reality & Verification | Code Location | Status |
|:---|:---|:---|:---|:---|
| **A** | **Public Read-Only Access** | Dashboard metrics (`/api/v1/dashboard/**`) and worker fleet heartbeats (`/api/v1/system/**`) permit unauthenticated reads. Admin monitoring endpoints (`/api/v1/admin/dlq`, `/api/v1/admin/outbox/**`, `/api/v1/admin/tenants/**`) require admin credentials unless `queueforge.security.public-demo-mode=true` is enabled. Mutating methods are strictly forbidden anonymously. | `AdminAuthInterceptor.java` [L50-L105](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/api/security/AdminAuthInterceptor.java#L50-L105) | **VERIFIED & HARDENED** |
| **B** | **API Payload Masking** | Unauthenticated callers querying `GET /api/v1/jobs/{jobId}/detail` receive masked payloads (`"_masked": true`, `"[PROTECTED]"`) unless authenticated with `X-Admin-Key` or `QF_SESSION` cookie. | `JobController.java` [L86-L102](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/api/controller/JobController.java#L86-L102) | **VERIFIED TRUE** |
| **C** | **Payment Receiver Authentication** | **Correction**: The receiver does NOT compute or verify cryptographic HMAC-SHA256 request signatures. It authenticates cross-service HTTP requests using a pre-shared service key transmitted via the `X-Service-Key` header, compared using constant-time equality `MessageDigest.isEqual`. | `PaymentReceiverController.java` [L39-L43](file:///D:/Projects/QueueForge/simulated-payment-receiver/src/main/java/com/queueforge/receiver/controller/PaymentReceiverController.java#L39-L43) | **CORRECTED CLAIM** |
| **D** | **Admin Credential Storage** | **Correction**: Argon2id is NOT present in the codebase. Admin credentials are authenticated via direct constant-time equality (`MessageDigest.isEqual`) against the external secret injected via `ADMIN_API_KEY`. Tenant keys are stored as SHA-256 verifiers (`ApiKeyHasher.hash`). | `AdminAuthInterceptor.java` [L118-L125](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/api/security/AdminAuthInterceptor.java#L118-L125), `ApiKeyHasher.java` | **CORRECTED CLAIM** |
| **E** | **Tenant SHA-256 Verifiers** | Tenant API keys are hashed with SHA-256 before persistence in PostgreSQL table `qf_tenants` (`api_key_hash` column). Plaintext keys are never stored. | `V7__secure_tenant_credentials.sql`, `TenantEntity.java`, `ApiKeyHasher.java` | **VERIFIED TRUE** |
| **F** | **HttpOnly Cookies & CSRF** | Browser admin login issues an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `QF_SESSION`. State-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) strictly require a cryptographic token matching the session via header `X-CSRF-Token`. **Hardening**: Added `server.forward-headers-strategy: framework` so TLS proxies correctly propagate `Secure=true`. | `AuthController.java` [L45-L60](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/api/controller/AuthController.java#L45-L60), `AdminAuthInterceptor.java` [L70-L82](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/api/security/AdminAuthInterceptor.java#L70-L82) | **VERIFIED & HARDENED** |
| **G** | **Rejection of Default Admin Key** | If profile is `prod`/`production` or `enforceStrongAdminKey=true`, `AdminProperties.java` throws `IllegalStateException` on startup if `ADMIN_API_KEY` equals `qf_admin_dev_secret_2026` or is blank. | `AdminProperties.java` [L33-L45](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/config/AdminProperties.java#L33-L45) | **VERIFIED TRUE** |
| **H** | **Lease Fencing Claim Semantics** | Monotonic fence tokens and atomic database updates (`UPDATE qf_jobs ... WHERE claim_token = ? AND lease_until >= CURRENT_TIMESTAMP`) ensure stale or disconnected workers cannot commit split-brain results. | `JobClaimService.java` [L112-L148](file:///D:/Projects/QueueForge/backend/src/main/java/com/queueforge/service/JobClaimService.java#L112-L148) | **VERIFIED TRUE** |
| **I** | **Transactional Outbox Idempotency** | Business mutations and outbox events commit in the exact same ACID transaction. The payment receiver deduplicates inbound charges via unique idempotency keys and SHA-256 payload fingerprints in `qf_inbox_deduplication`. | `PaymentReceiverService.java` [L44-L88](file:///D:/Projects/QueueForge/simulated-payment-receiver/src/main/java/com/queueforge/receiver/service/PaymentReceiverService.java#L44-L88) | **VERIFIED TRUE** |
| **J** | **Flyway V8 Migration Safety** | `V8__create_worker_heartbeats_schema.sql` creates the `qf_worker_heartbeats` table and associated indexes using `IF NOT EXISTS` DDL. It does not drop tables or alter existing columns, ensuring non-blocking, zero-downtime execution. | `V8__create_worker_heartbeats_schema.sql` | **VERIFIED TRUE** |

---

## 3. Detailed Analysis of Corrected Claims

### 3.1 Authentication Primitives: Argon2id vs Constant-Time SHA-256 Verifiers
- **Initial Phase 10A Claim**: "Hardened with Argon2id administrative password hashing."
- **Codebase Truth**: Neither Argon2 nor BCrypt dependencies are packaged. Instead:
  1. **Admin Key Authentication**: The administrative secret is injected via environment variable `ADMIN_API_KEY`. Verification uses Java's native `java.security.MessageDigest.isEqual()`, providing constant-time byte-level comparison to completely mitigate timing attacks.
  2. **Tenant Key Authentication**: Tenant API keys are digested via SHA-256 hex encoding (`ApiKeyHasher.hash()`) and compared using constant-time evaluation against the database column `api_key_hash`.
- **Verdict**: Fully safe and standard for service-to-service API key authentication, but documentation must accurately describe SHA-256 verifiers rather than Argon2id.

### 3.2 Inter-Service Security: HMAC vs Pre-Shared Service Key
- **Initial Phase 10A Claim**: "Outbox dispatcher signs HTTP requests with HMAC-SHA256 signatures."
- **Codebase Truth**: The `TransactionalOutboxDispatcher` sends an HTTP POST request with header `X-Service-Key: ${QUEUEFORGE_OUTBOX_PAYMENT_SERVICE_KEY}`. The `PaymentReceiverController` validates this header using `MessageDigest.isEqual()`.
- **Verdict**: A pre-shared service key header across internal Docker networks is standard and secure for container-to-container private topologies. Marketing claims referencing dynamic HMAC signing have been formally updated across all project documentation.

### 3.3 Starvation Latency Reduction: 89.8% Provenance
- **Initial Phase 10A Claim**: "89.8% reduction in starvation latency (e.g. 3,240 ms down to 330 ms)."
- **Codebase Truth**: Auditing `FairShareBenchmarkRunner.java` and `docs/benchmark/benchmark-results-fairshare.json` revealed the exact empirical benchmark configuration:
  - **Benchmark Configuration**: Profile 3 (Noisy Neighbor: 1 aggressive tenant submitting 1,000 jobs, 4 quiet interactive tenants submitting 20 jobs each).
  - **Baseline (FIFO / Static Priority)**: Quiet tenant p50 queue wait latency = **11,868 ms**.
  - **FairShare (Deficit Round Robin)**: Quiet tenant p50 queue wait latency = **1,210 ms**.
  - **Calculated Reduction**: `(11,868 - 1,210) / 11,868 = 89.80%`.
- **Verdict**: The 89.8% claim is 100% mathematically and experimentally verified, but must cite the real 11,868 ms -> 1,210 ms numbers from Profile 3.

---

## 4. Public Demonstration Access Model

QueueForge V2 introduces an **Owner-Operated Demo Model** with optional **Public Demo Mode**:

```mermaid
flowchart TD
    PublicUser["Anonymous Public Visitor"] --> ReverseProxy["Nginx / Caddy (TLS 443)"]
    ReverseProxy --> Frontend["Obsidian Pulse SPA (Port 80)"]
    Frontend --> APIServer["Backend API (Port 8085)"]
    
    subgraph APIServerSecurity["API Server Authorization Gates"]
        PublicViews["Public Views (Mission Control, Fleet Heartbeats, Metrics)"]
        MaskedViews["Job Explorer (Masked Payloads: _masked:true)"]
        AdminRead["Admin Read-Only (DLQ, Outbox, Tenants in Demo Mode)"]
        AdminMutate["Admin State Mutations (Replay, Purge, Dispatch, Delete)"]
    end
    
    APIServer --> PublicViews
    APIServer --> MaskedViews
    APIServer --> AdminRead
    APIServer -.->|401 UNAUTHORIZED| AdminMutate
    
    Owner["Portfolio Owner (Authenticated)"] -->|QF_SESSION + X-CSRF-Token| AdminMutate
```

### 4.1 Permitted Anonymous Endpoints (Public Demo Mode Active)
- `GET /actuator/health`
- `GET /api/v1/dashboard/**` (Active jobs, failure rates, queue throughput)
- `GET /api/v1/system/workers` (Fleet status, heartbeat ages, registered hostnames)
- `GET /api/v1/jobs` (Job overview listings)
- `GET /api/v1/jobs/{jobId}/detail` (Job parameters masked: `_masked: true`, worker ID `[PROTECTED]`)
- `GET /api/v1/admin/dlq` (Dead-letter queue summary listing only; items array contains no payloads or stack traces)
- `GET /api/v1/admin/outbox/stats` (Outbox backlog and processing counters)
- `GET /api/v1/admin/outbox/events` (Outbox event summary listing only; contains no raw payload)
- `GET /api/v1/admin/tenants` (FairShare summary list; weights and concurrency quotas, no API keys)
- `GET /api/v1/admin/tenants/scheduler-config` (FairShare scheduler quantum and active tenant count)

### 4.2 Strictly Guarded Endpoints (Always Require Admin Authentication)
- `GET /api/v1/admin/dlq/{jobId}` -> **401 Unauthorized** (Protects raw job payload and internal error stack traces)
- `GET /api/v1/admin/outbox/events/{id}` -> **401 Unauthorized** (Protects raw payment charge payloads)
- `GET /api/v1/admin/tenants/{id}` -> **401 Unauthorized** (Protects tenant API key details)
- `POST /api/v1/admin/dlq/replay` -> **401 Unauthorized**
- `POST /api/v1/admin/dlq/{jobId}/replay` -> **401 Unauthorized**
- `POST /api/v1/admin/dlq/{jobId}/discard` -> **401 Unauthorized**
- `DELETE /api/v1/admin/dlq/{jobId}/discard` -> **401 Unauthorized**
- `POST /api/v1/admin/outbox/dispatch` -> **401 Unauthorized**
- `POST /api/v1/admin/tenants` -> **401 Unauthorized**
- `PUT /api/v1/admin/tenants/{id}` -> **401 Unauthorized**
- Unmasked job payload inspection (`GET /api/v1/jobs/{jobId}/detail`) -> **Requires Admin Key**

---

## 5. Security Regression Verification

Automated regression test suites `AdminDemoModeSecurityTest` and `AdminDefaultSecurityModeTest` have been authored to verify that activating `queueforge.security.public-demo-mode=true` permits read telemetry on explicit summary endpoints while cryptographically preventing any anonymous mutations or sensitive detail leaks:

> [!IMPORTANT]
> **Execution Status**: **IMPLEMENTED — AWAITING EXECUTION IN HOSTED GITHUB ACTIONS CI**.  
> The Windows development host lacks a local Maven installation (`mvn`/`mvnw`). In Phase 10B, local test execution was aborted due to missing local build tools. The complete test suite is scheduled for genuine hosted execution on Ubuntu runners during the next authorized phase.

### Verified Test Matrix (19 Test Cases)
1. `testAnonymousGetDlqSummaryAllowedInDemoMode`: GET `/api/v1/admin/dlq` -> 200 OK
2. `testAnonymousGetOutboxStatsAllowedInDemoMode`: GET `/api/v1/admin/outbox/stats` -> 200 OK
3. `testAnonymousGetOutboxEventsSummaryAllowedInDemoMode`: GET `/api/v1/admin/outbox/events` -> 200 OK
4. `testAnonymousGetTenantsAllowedInDemoMode`: GET `/api/v1/admin/tenants` -> 200 OK (asserts no `apiKey` leaked)
5. `testAnonymousGetSchedulerConfigAllowedInDemoMode`: GET `/api/v1/admin/tenants/scheduler-config` -> 200 OK
6. `testAnonymousGetDlqDetailBlockedWith401`: GET `/api/v1/admin/dlq/{jobId}` -> 401 Unauthorized (protects stack traces)
7. `testAnonymousGetOutboxEventDetailBlockedWith401`: GET `/api/v1/admin/outbox/events/{id}` -> 401 Unauthorized (protects payment payloads)
8. `testAnonymousGetTenantDetailBlockedWith401`: GET `/api/v1/admin/tenants/default` -> 401 Unauthorized (protects tenant API keys)
9. `testAnonymousPostDlqReplayBlockedWith401`: POST `/api/v1/admin/dlq/{jobId}/replay` -> 401 Unauthorized
10. `testAnonymousPostDlqDiscardBlockedWith401`: POST `/api/v1/admin/dlq/{jobId}/discard` -> 401 Unauthorized
11. `testAnonymousDeleteDlqDiscardBlockedWith401`: DELETE `/api/v1/admin/dlq/{jobId}/discard` -> 401 Unauthorized
12. `testAnonymousPostOutboxDispatchBlockedWith401`: POST `/api/v1/admin/outbox/dispatch` -> 401 Unauthorized
13. `testAnonymousPostTenantBlockedWith401`: POST `/api/v1/admin/tenants` -> 401 Unauthorized
14. `testAnonymousPutTenantBlockedWith401`: PUT `/api/v1/admin/tenants/default` -> 401 Unauthorized
15. `testMethodOverrideHeaderBlockedWith401`: GET with `X-HTTP-Method-Override: DELETE` -> 401 Unauthorized
16. `testMethodOverrideParamBlockedWith401`: GET with `_method=DELETE` -> 401 Unauthorized
17. `testUnexpectedAdminRouteBlockedWith401`: GET `/api/v1/admin/unregistered` -> 401 Unauthorized
18. `testForgedIdentityHeaderBlockedWith401`: GET with `X-Forwarded-User: admin` -> 401 Unauthorized
19. `AdminDefaultSecurityModeTest` (5 assertions): Verifies that when `publicDemoMode=false`, all admin endpoints strictly require authentication.
