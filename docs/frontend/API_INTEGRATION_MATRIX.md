# QueueForge Frontend API Integration Matrix

## 1. Overview
The QueueForge Control Plane interacts with the backend through REST endpoints structured under `/api/v1`. This document catalogs all integrated endpoints, HTTP methods, authorization levels, and corresponding UI components.

---

## 2. API Endpoint Mapping Matrix

| UI Component / Feature | Endpoint Path | HTTP Method | Auth Required | CSRF Required | Request Body / Parameters | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mission Control & KPIs** | `/api/v1/dashboard/stats` | `GET` | No | No | None | `DashboardStats` |
| **Health Header Pills** | `/api/v1/system/health` | `GET` | No | No | None | `SystemHealth` |
| **Telemetry & Latency P95** | `/api/v1/system/metrics-summary` | `GET` | No | No | None | `SystemMetricsSummary` |
| **Worker Fleet Discovery** | `/api/v1/system/workers` | `GET` | No | No | None | `WorkerInstance[]` |
| **Job Explorer Table** | `/api/v1/jobs` | `GET` | No | No | `page, size, status, tenantId, jobType, search, priority, sortBy, sortDirection` | `PageResponse<JobSummary>` |
| **Job Slide-Over Drawer** | `/api/v1/jobs/{jobId}/detail` | `GET` | No (Masked) / Yes (Raw) | No | Path: `jobId` | `JobDetail` |
| **Execution History Logs** | `/api/v1/jobs/{jobId}/history` | `GET` | No (Masked) / Yes (Raw) | No | Path: `jobId` | `JobExecutionLog[]` |
| **Submit Test Job** | `/api/v1/jobs` | `POST` | No | No | `jobType, payload, priority, maxRetries, tenantId` | `{ jobId, status, createdAt }` |
| **FairShare Tenant Registry** | `/api/v1/admin/tenants` | `GET` | Yes (Admin) | No | None | `TenantSummary[]` |
| **Provision Tenant Modal** | `/api/v1/admin/tenants` | `POST` | Yes (Admin) | Yes | `id, name, weight, maxConcurrency` | `{ tenant, apiKey }` |
| **Manual Outbox Dispatch** | `/api/v1/admin/outbox/dispatch`| `POST` | Yes (Admin) | Yes | `batchSize, leaseDurationSeconds` | `OutboxDispatchResult` |
| **DLQ Job Replay** | `/api/v1/admin/dlq/{jobId}/replay` | `POST` | Yes (Admin) | Yes | Path: `jobId` | `ApiMessageResponse` |
| **DLQ Job Discard** | `/api/v1/admin/dlq/{jobId}/discard` | `DELETE`| Yes (Admin) | Yes | Path: `jobId` | `ApiMessageResponse` |
| **Admin Session Unlock** | `/api/v1/auth/unlock` | `POST` | No | Yes | `password` | `{ authenticated: true }` |
| **Admin Session Lock** | `/api/v1/auth/logout` | `POST` | Yes (Admin) | Yes | None | `{ authenticated: false }` |
| **Session Status Check** | `/api/v1/auth/status` | `GET` | No | No | None | `{ authenticated: boolean }` |

---

## 3. Worker Fleet API Contract (`/api/v1/system/workers`)

```json
[
  {
    "instanceId": "worker-v2-node-1",
    "mode": "WORKER_ONLY",
    "status": "ONLINE",
    "concurrency": 2,
    "activeJobs": 1,
    "heldLeasesCount": 1,
    "completedJobsCount": 42,
    "failedJobsCount": 1,
    "lastHeartbeat": "2026-11-19T11:45:00Z",
    "startedAt": "2026-11-19T11:00:00Z",
    "heartbeatAgeSeconds": 3
  }
]
```

### Status Definitions:
- `ONLINE`: `heartbeatAgeSeconds <= 15`
- `STALE`: `heartbeatAgeSeconds > 15 && heartbeatAgeSeconds <= 45`
- `OFFLINE`: `heartbeatAgeSeconds > 45` or explicitly reported as `STOPPED`

---

## 4. Request Header Standards

### A. Consumer Idempotency
- When submitting jobs via `POST /api/v1/jobs`, the client attaches an `Idempotency-Key: <unique-key>` header.
- The PostgreSQL backend guarantees that identical idempotency keys within the lease window produce deterministic responses without duplicate job enqueueing.

### B. Anti-CSRF Token Enforcement
- State-changing mutations under `/api/v1/admin/*` require the `X-CSRF-Token` header.
- The client reads the CSRF token issued during initial handshake or unlock and injects it into every mutation request.

### C. Tenant Header Isolation
- Optional `X-Tenant-ID` header routes job claims and queries into isolated tenant partitions.
