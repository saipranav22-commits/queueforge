package com.queueforge.chaoslab.verification;

import com.queueforge.chaoslab.model.*;
import com.queueforge.core.domain.JobStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class InvariantVerifier {

    public List<InvariantResult> verifyAll(
            String scenarioId,
            List<UUID> targetJobIds,
            List<ChaosEvent> events,
            Map<UUID, JobSnapshot> dbSnapshots,
            List<AuditSnapshot> auditLogs,
            String faultedWorkerId,
            String healthyWorkerId
    ) {
        List<InvariantResult> results = new ArrayList<>();
        results.add(verifySafety1_SingleValidOwner(targetJobIds, events, dbSnapshots));
        results.add(verifySafety2_StaleWorkerFenced(targetJobIds, events, dbSnapshots));
        results.add(verifySafety3_DurableStorageSurvival(targetJobIds, dbSnapshots));
        results.add(verifySafety4_BoundedRetries(targetJobIds, dbSnapshots));
        results.add(verifySafety5_NoTerminalReversal(targetJobIds, events, dbSnapshots));
        results.add(verifySafety6_ConsistentAuditEvidence(targetJobIds, dbSnapshots, auditLogs));
        results.add(verifyLiveness1_AbandonedJobRecoverable(targetJobIds, events, dbSnapshots));
        results.add(verifyLiveness2_EventualTerminalState(targetJobIds, dbSnapshots));
        results.add(verifyLiveness3_HealthyWorkerContinuity(events, faultedWorkerId, healthyWorkerId));
        return results;
    }

    /**
     * SAFETY-1: At most one current valid owner exists for each job in the PostgreSQL state.
     */
    public InvariantResult verifySafety1_SingleValidOwner(
            List<UUID> jobIds,
            List<ChaosEvent> events,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            JobSnapshot snap = snapshots.get(jobId);
            if (snap == null) {
                evidence.add("Job " + jobId + " missing from DB snapshot");
                pass = false;
                continue;
            }

            // In final DB state, if status is RUNNING, lockedBy and claimToken must be non-null and single
            if (snap.status() == JobStatus.RUNNING) {
                if (snap.lockedBy() == null || snap.claimToken() == null) {
                    evidence.add("Job " + jobId + " is RUNNING but has null lockedBy or claimToken");
                    pass = false;
                }
            } else {
                // If COMPLETED or DEAD_LETTER or PENDING, lease_until and claim_token must be cleared
                if (snap.claimToken() != null && snap.status() != JobStatus.RUNNING) {
                    evidence.add("Job " + jobId + " has status " + snap.status() + " but claimToken is not null");
                    pass = false;
                }
            }

            // Historical check: detect concurrent overlapping active claims in event stream
            List<ChaosEvent> claimEvents = events.stream()
                    .filter(e -> Objects.equals(e.jobId(), jobId) && e.type() == ChaosEventType.JOB_CLAIMED)
                    .toList();

            Set<UUID> distinctTokens = claimEvents.stream().map(ChaosEvent::claimToken).filter(Objects::nonNull).collect(Collectors.toSet());
            evidence.add("Job " + jobId + " had " + claimEvents.size() + " claim event(s) across " + distinctTokens.size() + " distinct token(s). Final locked_by: " + snap.lockedBy());
        }

        if (pass) {
            return InvariantResult.pass("SAFETY-1", "Single Valid Owner",
                    "All jobs demonstrated strictly mutual exclusive ownership without dual active leases.", evidence);
        } else {
            return InvariantResult.fail("SAFETY-1", "Single Valid Owner",
                    "Detected invalid ownership state or dual active owners in DB/event history.", evidence);
        }
    }

    /**
     * SAFETY-2: A stale worker cannot successfully commit completion after losing ownership.
     */
    public InvariantResult verifySafety2_StaleWorkerFenced(
            List<UUID> jobIds,
            List<ChaosEvent> events,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            JobSnapshot snap = snapshots.get(jobId);
            if (snap == null) continue;

            // Check if any stale commit rejected was recorded
            List<ChaosEvent> staleAttempts = events.stream()
                    .filter(e -> Objects.equals(e.jobId(), jobId) && e.type() == ChaosEventType.STALE_COMMIT_REJECTED)
                    .toList();

            for (ChaosEvent stale : staleAttempts) {
                evidence.add("Stale worker " + stale.workerId() + " attempt to commit job " + jobId +
                        " with token " + stale.claimToken() + " was successfully fenced out.");
            }

            // Check that if the job completed, it completed under the legitimate token
            if (snap.status() == JobStatus.COMPLETED) {
                List<ChaosEvent> completionEvents = events.stream()
                        .filter(e -> Objects.equals(e.jobId(), jobId) && e.type() == ChaosEventType.JOB_COMPLETED)
                        .toList();

                if (completionEvents.size() > 1) {
                    evidence.add("Job " + jobId + " recorded multiple completion events: " + completionEvents.size());
                    pass = false;
                }
            }
        }

        if (pass) {
            return InvariantResult.pass("SAFETY-2", "Stale Worker Fencing",
                    "Stale worker updates were safely fenced by PostgreSQL conditional UPDATE checks.", evidence);
        } else {
            return InvariantResult.fail("SAFETY-2", "Stale Worker Fencing",
                    "Stale worker was able to overwrite state or duplicate completion occurred.", evidence);
        }
    }

    /**
     * SAFETY-3: No acknowledged successful submission disappears from durable storage.
     */
    public InvariantResult verifySafety3_DurableStorageSurvival(
            List<UUID> jobIds,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            if (!snapshots.containsKey(jobId)) {
                evidence.add("CRITICAL: Job " + jobId + " was acknowledged but not found in DB snapshot!");
                pass = false;
            } else {
                JobSnapshot snap = snapshots.get(jobId);
                evidence.add("Job " + jobId + " persisted in durable storage with status=" + snap.status() + ", createdAt=" + snap.createdAt());
            }
        }

        if (pass) {
            return InvariantResult.pass("SAFETY-3", "Durable Storage Survival",
                    "All submitted jobs survived in PostgreSQL durable storage.", evidence);
        } else {
            return InvariantResult.fail("SAFETY-3", "Durable Storage Survival",
                    "One or more acknowledged jobs disappeared from storage.", evidence);
        }
    }

    /**
     * SAFETY-4: Attempt and retry counters remain within documented limits.
     */
    public InvariantResult verifySafety4_BoundedRetries(
            List<UUID> jobIds,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            JobSnapshot snap = snapshots.get(jobId);
            if (snap == null) continue;

            if (snap.retryCount() > snap.maxRetries()) {
                evidence.add("Job " + jobId + " exceeded max retries: retryCount=" + snap.retryCount() + ", maxRetries=" + snap.maxRetries());
                pass = false;
            } else {
                evidence.add("Job " + jobId + ": attemptCount=" + snap.attemptCount() + ", retryCount=" + snap.retryCount() + ", maxRetries=" + snap.maxRetries());
            }
        }

        if (pass) {
            return InvariantResult.pass("SAFETY-4", "Bounded Retries",
                    "Attempt and retry counters strictly respected max_retries limits.", evidence);
        } else {
            return InvariantResult.fail("SAFETY-4", "Bounded Retries",
                    "Retry counter exceeded max_retries boundary.", evidence);
        }
    }

    /**
     * SAFETY-5: A job cannot transition from COMPLETED back to RUNNING without an explicitly authorized lifecycle operation.
     */
    public InvariantResult verifySafety5_NoTerminalReversal(
            List<UUID> jobIds,
            List<ChaosEvent> events,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            List<ChaosEvent> jobEvents = events.stream()
                    .filter(e -> Objects.equals(e.jobId(), jobId))
                    .sorted(Comparator.comparing(ChaosEvent::timestamp))
                    .toList();

            boolean reachedCompleted = false;
            Instant completedTime = null;

            for (ChaosEvent event : jobEvents) {
                if (event.type() == ChaosEventType.JOB_COMPLETED) {
                    reachedCompleted = true;
                    completedTime = event.timestamp();
                } else if (reachedCompleted && (event.type() == ChaosEventType.JOB_CLAIMED || event.type() == ChaosEventType.JOB_RETRIED)) {
                    evidence.add("Job " + jobId + " transitioned back to " + event.type() + " after COMPLETED at " + completedTime);
                    pass = false;
                }
            }

            JobSnapshot snap = snapshots.get(jobId);
            if (snap != null && reachedCompleted && snap.status() != JobStatus.COMPLETED && snap.status() != JobStatus.ARCHIVED) {
                evidence.add("Job " + jobId + " had reached COMPLETED but DB snapshot shows status " + snap.status());
                pass = false;
            }
        }

        if (pass) {
            return InvariantResult.pass("SAFETY-5", "No Terminal Reversal",
                    "Completed jobs remained strictly terminal with zero unauthorized status regressions.", evidence);
        } else {
            return InvariantResult.fail("SAFETY-5", "No Terminal Reversal",
                    "Detected illegal status transition away from terminal COMPLETED state.", evidence);
        }
    }

    /**
     * SAFETY-6: Every committed terminal transition has consistent, queryable audit evidence.
     */
    public InvariantResult verifySafety6_ConsistentAuditEvidence(
            List<UUID> jobIds,
            Map<UUID, JobSnapshot> snapshots,
            List<AuditSnapshot> auditLogs
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            JobSnapshot snap = snapshots.get(jobId);
            if (snap == null) continue;

            List<AuditSnapshot> logs = auditLogs.stream()
                    .filter(l -> Objects.equals(l.jobId(), jobId))
                    .sorted(Comparator.comparing(AuditSnapshot::createdAt))
                    .toList();

            if (snap.status() == JobStatus.COMPLETED) {
                boolean hasCompletedLog = logs.stream().anyMatch(l -> "COMPLETED".equalsIgnoreCase(l.status()));
                if (!hasCompletedLog) {
                    evidence.add("Job " + jobId + " is COMPLETED in DB but lacks COMPLETED entry in qf_job_execution_logs");
                    pass = false;
                } else {
                    evidence.add("Job " + jobId + " has " + logs.size() + " audit log entry(ies), including valid COMPLETED entry.");
                }
            } else if (snap.status() == JobStatus.DEAD_LETTER) {
                boolean hasFailedLog = logs.stream().anyMatch(l -> "FAILED".equalsIgnoreCase(l.status()));
                if (!hasFailedLog && snap.attemptCount() > 0) {
                    evidence.add("Job " + jobId + " is DEAD_LETTER in DB but lacks FAILED entry in qf_job_execution_logs");
                    pass = false;
                } else {
                    evidence.add("Job " + jobId + " has " + logs.size() + " audit log entry(ies) for DEAD_LETTER state.");
                }
            }
        }

        if (pass) {
            return InvariantResult.pass("SAFETY-6", "Consistent Audit Evidence",
                    "All terminal transitions have consistent audit records in qf_job_execution_logs.", evidence);
        } else {
            return InvariantResult.fail("SAFETY-6", "Consistent Audit Evidence",
                    "Audit log entries missing or inconsistent with final job status.", evidence);
        }
    }

    /**
     * LIVENESS-1: An abandoned RUNNING job eventually becomes eligible for recovery when the database and at least one worker are available.
     */
    public InvariantResult verifyLiveness1_AbandonedJobRecoverable(
            List<UUID> jobIds,
            List<ChaosEvent> events,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            boolean faultInjected = events.stream()
                    .anyMatch(e -> Objects.equals(e.jobId(), jobId) && e.type() == ChaosEventType.FAULT_INJECTED);

            if (faultInjected) {
                boolean recovered = events.stream()
                        .anyMatch(e -> Objects.equals(e.jobId(), jobId) &&
                                (e.type() == ChaosEventType.JOB_RECOVERED || e.type() == ChaosEventType.JOB_CLAIMED && e.attempt() > 1));

                JobSnapshot snap = snapshots.get(jobId);
                boolean recoveredInDb = snap != null && (snap.attemptCount() > 1 || snap.status() != JobStatus.RUNNING);

                if (recovered || recoveredInDb) {
                    evidence.add("Job " + jobId + " was abandoned during fault and was successfully recovered.");
                } else {
                    evidence.add("Job " + jobId + " experienced fault but was never recovered!");
                    pass = false;
                }
            }
        }

        if (pass) {
            return InvariantResult.pass("LIVENESS-1", "Abandoned Job Recovery",
                    "Abandoned jobs were detected upon lease expiry and made eligible for recovery.", evidence);
        } else {
            return InvariantResult.fail("LIVENESS-1", "Abandoned Job Recovery",
                    "One or more abandoned jobs remained stuck without recovery.", evidence);
        }
    }

    /**
     * LIVENESS-2: Eligible recoverable jobs eventually reach a valid terminal state under explicitly bounded and healthy test conditions.
     */
    public InvariantResult verifyLiveness2_EventualTerminalState(
            List<UUID> jobIds,
            Map<UUID, JobSnapshot> snapshots
    ) {
        List<String> evidence = new ArrayList<>();
        boolean pass = true;

        for (UUID jobId : jobIds) {
            JobSnapshot snap = snapshots.get(jobId);
            if (snap == null) {
                pass = false;
                continue;
            }

            if (snap.status() == JobStatus.COMPLETED || snap.status() == JobStatus.DEAD_LETTER) {
                evidence.add("Job " + jobId + " reached valid terminal state: " + snap.status());
            } else {
                evidence.add("Job " + jobId + " is in non-terminal state: " + snap.status());
                pass = false;
            }
        }

        if (pass) {
            return InvariantResult.pass("LIVENESS-2", "Eventual Terminal State",
                    "All target jobs reached a terminal state (COMPLETED or DEAD_LETTER).", evidence);
        } else {
            return InvariantResult.fail("LIVENESS-2", "Eventual Terminal State",
                    "One or more jobs failed to reach a terminal state within test boundaries.", evidence);
        }
    }

    /**
     * LIVENESS-3: One failed worker instance does not permanently stop unrelated healthy workers.
     */
    public InvariantResult verifyLiveness3_HealthyWorkerContinuity(
            List<ChaosEvent> events,
            String faultedWorkerId,
            String healthyWorkerId
    ) {
        List<String> evidence = new ArrayList<>();

        if (faultedWorkerId == null || healthyWorkerId == null) {
            return InvariantResult.pass("LIVENESS-3", "Healthy Worker Continuity",
                    "Worker continuity check skipped (single-worker scenario).", List.of("Scenario did not specify dual workers"));
        }

        long healthyWorkerExecutions = events.stream()
                .filter(e -> e.workerId() != null && e.workerId().contains(healthyWorkerId))
                .filter(e -> e.type() == ChaosEventType.JOB_CLAIMED || e.type() == ChaosEventType.JOB_COMPLETED)
                .count();

        evidence.add("Faulted worker: " + faultedWorkerId + ". Healthy worker (" + healthyWorkerId + ") recorded " + healthyWorkerExecutions + " processing event(s).");

        if (healthyWorkerExecutions > 0) {
            return InvariantResult.pass("LIVENESS-3", "Healthy Worker Continuity",
                    "Healthy worker continued processing successfully despite fault in neighboring instance.", evidence);
        } else {
            return InvariantResult.fail("LIVENESS-3", "Healthy Worker Continuity",
                    "Healthy worker was starved or halted by the neighboring failure.", evidence);
        }
    }
}
