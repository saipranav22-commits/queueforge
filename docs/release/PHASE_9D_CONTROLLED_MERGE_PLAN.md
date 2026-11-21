# QueueForge V2 & Obsidian Pulse — Phase 9D Controlled Merge Plan & Post-Merge Verification

## Executive Summary

This document defines the formal, controlled merge procedure, Git ancestry preservation strategy, and post-merge verification protocol for merging **QueueForge V2** and the **Obsidian Pulse Control Plane** into `main`.

- **Backend Pull Request #1:** [https://github.com/saipranav22-commits/queueforge/pull/1](https://github.com/saipranav22-commits/queueforge/pull/1)
  - Base: `main`
  - Head: `feature/multi-instance-workers`
  - Head SHA: `7125821e7136b8c485337d307cd3dffe60ac07b6`
  - Status: Open (`mergeable: true`, `mergeable_state: clean`)
- **Control Plane UI Pull Request #2:** [https://github.com/saipranav22-commits/queueforge/pull/2](https://github.com/saipranav22-commits/queueforge/pull/2)
  - Current Base: `feature/multi-instance-workers` (stacked PR architecture)
  - Head: `feature/v2-control-plane-ui`
  - Head SHA: `4505b956b574086ea7dfca1d2a773126f2fd4b93`
  - Status: Open (`mergeable: true`, `mergeable_state: clean`)
- **Cloud CI Status:** **6 / 6 JOBS PASSED (100% GREEN on both PR and Push pipelines)**
- **Release Readiness Verdict:** **READY FOR CONTROLLED MERGE (AWAITING HUMAN APPROVAL)**

---

## 1. Verified GitHub Repository & PR Status

| Property | Pull Request #1 (Backend V2) | Pull Request #2 (Control Plane UI) |
|:---|:---|:---|
| **Repository** | `saipranav22-commits/queueforge` | `saipranav22-commits/queueforge` |
| **Pull Request URL** | [PR #1](https://github.com/saipranav22-commits/queueforge/pull/1) | [PR #2](https://github.com/saipranav22-commits/queueforge/pull/2) |
| **Target Base Branch** | `main` | `feature/multi-instance-workers` (to be retargeted to `main`) |
| **Head Branch** | `feature/multi-instance-workers` | `feature/v2-control-plane-ui` |
| **Head Commit SHA** | `7125821e7136b8c485337d307cd3dffe60ac07b6` | `4505b956b574086ea7dfca1d2a773126f2fd4b93` |
| **Mergeable** | `true` | `true` |
| **Mergeable State** | `clean` | `clean` |
| **CI Matrix Status** | All check runs passed (`success`) | All check runs passed (`success`) |
| **Workflow Run (PR)** | [Run 44588806464](https://github.com/saipranav22-commits/queueforge/actions/runs/44588806464) | [Run 44605652813](https://github.com/saipranav22-commits/queueforge/actions/runs/44605652813) |
| **Workflow Run (Push)**| [Run 44588795168](https://github.com/saipranav22-commits/queueforge/actions/runs/44588795168) | [Run 44605639288](https://github.com/saipranav22-commits/queueforge/actions/runs/44605639288) |

---

## 2. Merge Strategy & Git Ancestry Analysis

### The Stacked Branch Topology
QueueForge V2 was developed using a stacked branch model:
```
main:                          --- M0 ----------------------------------------------------->
                                    \
feature/multi-instance-workers:      B1 --- B2 --- ... --- 7125821 (PR #1)
                                                              \
feature/v2-control-plane-ui:                                   U1 --- U2 --- ... --- 4505b95 (PR #2)
```

### Analysis of Merge Strategy Options for PR #1

#### Option A: Regular Merge Commit (`git merge --no-ff`, "Create a merge commit") — RECOMMENDED
- **Mechanism:** GitHub creates a merge commit on `main` with two parent commits:
  1. Parent 1: The current HEAD of `main` ($M_0$).
  2. Parent 2: Commit `7125821` (the HEAD of `feature/multi-instance-workers`).
- **Ancestry Impact:** Commit `7125821` becomes an explicit first-class ancestor of `main`.
- **Impact on Retargeted PR #2:**
  - When PR #2 is retargeted from `feature/multi-instance-workers` to `main`, Git computes the merge-base between `main` and `feature/v2-control-plane-ui`.
  - The merge-base resolves directly to `7125821`.
  - GitHub automatically recognizes that commits $B_1 \dots 7125821$ are already part of `main`.
  - The resulting PR #2 diff contains **strictly the 105 UI files and workflows** ($U_1 \dots 4505b95$).
  - **Zero merge conflicts** and **zero history rewriting** (no `rebase`, no `cherry-pick`, no `force-push`).

#### Option B: Squash and Merge (`git merge --squash`) — DANGEROUS FOR STACKED BRANCHES
- **Mechanism:** GitHub compresses commits $B_1 \dots 7125821$ into a single new commit $S_1$ on `main`.
- **Ancestry Impact:** $S_1$ has only one parent ($M_0$). Commit `7125821` is **NOT** in `main`'s commit graph.
- **Impact on Retargeted PR #2:**
  - When PR #2 is retargeted to `main`, Git computes the merge-base between $S_1$ and $4505b95$.
  - The merge-base falls back to $M_0$ (the state before PR #1 began).
  - PR #2 would falsely display all backend commits ($B_1 \dots 7125821$) as unmerged changes.
  - Potential false merge conflicts arise between $S_1$ and $B_1 \dots 7125821$ on shared files.
  - Resolving this would require a manual `git rebase --onto main 7125821 feature/v2-control-plane-ui` followed by a dangerous `git push --force`.

### Strategic Verdict
**Option A (Regular Merge Commit, "Create a merge commit") is strictly recommended for PR #1.**

---

## 3. Merge Readiness & Architectural Preservation

Merging PR #1 and subsequently PR #2 preserves all architectural contracts:

1. **Distributed Worker Coordination:**
   - Multi-worker leasing (`JobClaimService.java`), dynamic heartbeat registration (`WorkerCoordinator.java`), and fencing token validation ($T_{claim} > T_{prev}$) remain intact.
2. **Flyway Migrations:**
   - Migrations V1 through V7 (PR #1) and V8 (PR #2) are strictly additive. V8 introduces `qf_worker_heartbeats` without altering or dropping any V1-V7 schema objects.
3. **Multi-Tenant FairShare Engine:**
   - Weighted Deficit Round Robin scheduling and tenant concurrency quotas operate as validated across 164 integration tests.
4. **Transactional Outbox & Payment Receiver:**
   - Durable outbox dispatch, exponential backoff with full jitter, and receiver idempotency via SHA-256 fingerprint hashing remain fully verified.
5. **Security Architecture:**
   - Double-submit CSRF protection on mutating admin actions, strict tenant boundary fencing, externalized CORS origin policy, and the production admin key boot gate are preserved.

---

## 4. Test Evidence & Smoke Test Count Accounting Audit

### Test Execution Counts
- **Backend Tests:** 164 / 164 passed across 22 classes.
- **Payment Receiver Tests:** 13 / 13 passed across 3 classes.
- **Frontend Unit Tests:** 44 / 44 passed across 20 Vitest files.
- **Browser E2E Tests:** 20 / 20 passed across Desktop Chromium and Mobile Safari viewports.
- **Full-Stack Smoke Stages:** 8 / 8 passed against 7 live Docker containers.

### Audit of the 17-Execution vs 16-Burst-Job Accounting
In Stage 8 of `scripts/smoke-test-v2.sh`, the cluster worker distribution query reported:
```text
worker-v2-node-2:qf-worker-1 | 4
worker-v2-node-2:qf-worker-2 | 4
worker-v2-node-1:qf-worker-2 | 4
worker-v2-node-1:qf-worker-1 | 5
Total: 17 executions
```
**Audit Findings:**
1. **Stage 4 Submission:** 1 baseline job (`GENERATE_REPORT`) is submitted in Stage 4 to verify single-job claim lifecycle, creating 1 row in `qf_job_execution_logs`.
2. **Stage 8 Submission:** 16 burst jobs (8 for Tenant Alpha, 8 for Tenant Beta) are submitted in Stage 8 to exercise concurrent multi-worker load balancing, creating 16 rows.
3. **Database Lifetime Scan:** The query `SELECT worker_id, COUNT(*) FROM qf_job_execution_logs GROUP BY worker_id;` scans the entire table for the container session:
   $$\text{Total Executions} = 1 \text{ (Stage 4)} + 16 \text{ (Stage 8)} = 17 \text{ executions}$$
4. **No-Duplicate Verification:** Exactly 17 jobs were enqueued in the smoke test run; exactly 17 execution log rows were inserted. Every job was claimed and completed exactly once.
5. **Limitation:** The verification query aggregates across the entire test session. Scoping future verification via `WHERE job_id IN (...)` will provide stage-isolated assertion granularity.

---

## 5. Step-by-Step Controlled Merge Plan

> **STRICT ENFORCEMENT:** Do NOT execute any merge action without explicit user confirmation.

### Phase 1: Merge Backend PR #1 into `main`
1. Navigate to [PR #1](https://github.com/saipranav22-commits/queueforge/pull/1) on GitHub.
2. Select **Create a merge commit** (Option A: Regular Merge Commit, non-squash).
3. Confirm merge with commit message: `Merge pull request #1 from saipranav22-commits/feature/multi-instance-workers`.
4. Wait for GitHub Actions workflow to run on `main` and verify that all jobs conclude with `success`.

### Phase 2: Retarget Frontend PR #2 to `main`
1. Navigate to [PR #2](https://github.com/saipranav22-commits/queueforge/pull/2) on GitHub.
2. Click **Edit** beside the PR title.
3. In the **base** dropdown, change `feature/multi-instance-workers` to `main`.
4. Click **Save**.
5. Inspect the file diff in PR #2:
   - Confirm file count remains strictly 105 files.
   - Confirm zero backend PR #1 commits appear in PR #2 commit log.
   - Confirm `mergeable` status reports `clean` with zero conflicts.

### Phase 3: Verify Retargeted PR #2 Checks
1. GitHub Actions will automatically trigger on PR #2 against the updated `main` base.
2. Verify all six matrix jobs complete with `success`:
   - `Frontend Quality & Build`
   - `Simulated Payment Receiver Tests`
   - `Backend Build & Integration Tests`
   - `Docker Container Image Verification`
   - `Full-Stack Docker Smoke Test`
   - `Browser E2E Verification (Playwright)`

### Phase 4: Merge Frontend PR #2 into `main`
1. Following successful verification and final user confirmation, merge PR #2 into `main` using **Squash and Merge** (or **Create a merge commit**).
2. Confirm GitHub Actions workflow completes successfully on `main`.

---

## 6. Post-Merge Validation Protocol

Following the merge of both PRs into `main`, execute the following verification steps on a fresh clone or updated working copy:

```bash
# 1. Update local main
git checkout main
git pull origin main

# 2. Verify clean backend compilation and tests
./mvnw clean test-compile
./mvnw test -Dtest=AdminSecurityConfigTest,InvariantVerifierTest,BackoffCalculatorTest

# 3. Verify clean frontend build and unit tests
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix frontend test

# 4. Boot full-stack cluster locally (on hardware with >= 16 GB RAM) or via CI
docker compose -f docker-compose.v2.yml up -d --build

# 5. Run end-to-end smoke test
bash scripts/smoke-test-v2.sh

# 6. Tear down cluster
docker compose -f docker-compose.v2.yml down -v
```

---

## 7. Rollback & Contingency Plan

| Scenario | Rollback Procedure | Impact / Mitigation |
|:---|:---|:---|
| **PR #1 merge succeeds, but PR #2 fails retargeted checks** | Leave PR #2 unmerged. Backend V2 remains operational on `main`. Fix issues on `feature/v2-control-plane-ui` and push to update PR #2. | Zero impact on `main`. Backend features are fully functional independently. |
| **Runtime defect identified after PR #1 merge** | Revert the merge commit on `main` via `git revert -m 1 <MERGE_COMMIT_SHA>`. | Cleanly removes V2 backend changes without history rewriting. |
| **Frontend regression identified after PR #2 merge** | Revert PR #2 merge commit on `main`. | Frontend returns to static shell while backend V2 continues processing distributed jobs. |
| **Database rollback requirement** | Flyway V8 introduces `qf_worker_heartbeats`. Rollback is clean: `DROP TABLE qf_worker_heartbeats; DELETE FROM flyway_schema_history WHERE version = '8';`. | Zero impact on `qf_jobs` or V1 schema objects. |

---

## 8. Release Prerequisites for Future `v2.0.0` Tag

Before tagging `v2.0.0` for production distribution:

1. **Production Secret Injection:** Ensure `ADMIN_API_KEY`, `RECEIVER_SERVICE_KEY`, and `DB_PASSWORD` are managed in production via HashiCorp Vault or Kubernetes Secrets.
2. **CORS Production Lockdown:** Set `QUEUEFORGE_CORS_ALLOWED_ORIGINS` to the exact corporate DNS domain.
3. **Database SSL/TLS:** Enforce `sslmode=require` on production PostgreSQL connections.
4. **README & Release Notes:** Finalize `README.md` and `docs/release/V2_RELEASE_NOTES_DRAFT.md`.
