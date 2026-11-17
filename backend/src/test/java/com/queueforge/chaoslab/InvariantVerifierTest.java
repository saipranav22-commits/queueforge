package com.queueforge.chaoslab;

import com.queueforge.chaoslab.model.*;
import com.queueforge.chaoslab.reporter.ExperimentReporter;
import com.queueforge.chaoslab.verification.InvariantVerifier;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class InvariantVerifierTest {

    private InvariantVerifier verifier;
    private ExperimentReporter reporter;
    private UUID testJobId;

    @BeforeEach
    void setUp() {
        verifier = new InvariantVerifier();
        reporter = new ExperimentReporter();
        testJobId = UUID.randomUUID();
    }

    @Test
    @DisplayName("Positive Test: Perfect execution history passes all 9 invariants")
    void testAllInvariantsPassOnValidHistory() {
        UUID claimToken1 = UUID.randomUUID();
        UUID claimToken2 = UUID.randomUUID();
        Instant now = Instant.now();

        List<ChaosEvent> events = List.of(
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.JOB_SUBMITTED, "api-1", null, 0, 0, "Submitted"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.JOB_CLAIMED, "worker-1", claimToken1, 1, 1, "Claimed by worker 1"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.FAULT_INJECTED, "worker-1", claimToken1, 1, 1, "Worker 1 killed"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.LEASE_EXPIRED, "worker-1", claimToken1, 1, 1, "Lease expired"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.JOB_RECOVERED, "worker-2", null, 1, 1, "Swept by worker 2"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.JOB_CLAIMED, "worker-2", claimToken2, 2, 2, "Claimed by worker 2"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.STALE_COMMIT_REJECTED, "worker-1", claimToken1, 1, 1, "Worker 1 rejected"),
                ChaosEvent.of("EXP-VALID", testJobId, ChaosEventType.JOB_COMPLETED, "worker-2", claimToken2, 2, 2, "Completed by worker 2")
        );

        JobSnapshot finalSnapshot = new JobSnapshot(
                testJobId,
                "idemp-1",
                "GENERATE_REPORT",
                JobStatus.COMPLETED,
                2,
                1,
                3,
                null, // cleared upon completion
                2,
                null,
                null,
                null,
                null,
                now.minusSeconds(10),
                now,
                now
        );

        List<AuditSnapshot> auditLogs = List.of(
                new AuditSnapshot(1L, testJobId, "worker-2:thread-1", 2, "COMPLETED", 150L, null, now)
        );

        List<InvariantResult> results = verifier.verifyAll(
                "EXP-VALID",
                List.of(testJobId),
                events,
                Map.of(testJobId, finalSnapshot),
                auditLogs,
                "worker-1",
                "worker-2"
        );

        assertThat(results).hasSize(9);
        for (InvariantResult r : results) {
            assertThat(r.passed()).as("Invariant %s should pass: %s", r.invariantId(), r.message()).isTrue();
        }

        ExperimentReport report = new ExperimentReport(
                "EXP-VALID", "Positive Test Scenario", now.minusSeconds(10), now, 10000,
                "HARD_KILL", "worker-1", Map.of("topology", "2-worker"),
                List.of(testJobId), events, results, true, "All invariants verified."
        );
        String md = reporter.formatMarkdown(report);
        assertThat(md).contains("✅ PASSED");
    }

    @Test
    @DisplayName("Negative Test: SAFETY-1 fails when multiple owners exist or invalid ownership state")
    void testSafety1_FailsOnDualOwners() {
        JobSnapshot badSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.PENDING,
                1, 0, 3, UUID.randomUUID(), 1, "worker-1", null, null, null, Instant.now(), Instant.now(), null
        );

        InvariantResult result = verifier.verifySafety1_SingleValidOwner(
                List.of(testJobId),
                Collections.emptyList(),
                Map.of(testJobId, badSnapshot)
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("SAFETY-1");
        assertThat(result.evidence()).anyMatch(e -> e.contains("claimToken is not null"));
    }

    @Test
    @DisplayName("Negative Test: SAFETY-2 fails when duplicate completion events occur")
    void testSafety2_FailsOnDuplicateCompletions() {
        List<ChaosEvent> duplicateCompletions = List.of(
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.JOB_COMPLETED, "worker-1", UUID.randomUUID(), 1, 1, "Completed 1"),
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.JOB_COMPLETED, "worker-2", UUID.randomUUID(), 2, 2, "Completed 2")
        );

        JobSnapshot completedSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.COMPLETED,
                2, 1, 3, null, 2, null, null, null, null, Instant.now(), Instant.now(), Instant.now()
        );

        InvariantResult result = verifier.verifySafety2_StaleWorkerFenced(
                List.of(testJobId),
                duplicateCompletions,
                Map.of(testJobId, completedSnapshot)
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("SAFETY-2");
        assertThat(result.evidence()).anyMatch(e -> e.contains("multiple completion events"));
    }

    @Test
    @DisplayName("Negative Test: SAFETY-3 fails when acknowledged job disappears from storage")
    void testSafety3_FailsWhenJobDisappears() {
        InvariantResult result = verifier.verifySafety3_DurableStorageSurvival(
                List.of(testJobId),
                Collections.emptyMap() // Job disappeared from DB!
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("SAFETY-3");
        assertThat(result.evidence()).anyMatch(e -> e.contains("not found in DB snapshot"));
    }

    @Test
    @DisplayName("Negative Test: SAFETY-4 fails when retry count exceeds max_retries")
    void testSafety4_FailsOnRetryExhaustionViolation() {
        JobSnapshot exceededRetriesSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.DEAD_LETTER,
                5, 4, 3, null, 4, null, null, FailureCategory.TRANSIENT_FAILURE, "Error", Instant.now(), Instant.now(), null
        );

        InvariantResult result = verifier.verifySafety4_BoundedRetries(
                List.of(testJobId),
                Map.of(testJobId, exceededRetriesSnapshot)
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("SAFETY-4");
        assertThat(result.evidence()).anyMatch(e -> e.contains("exceeded max retries"));
    }

    @Test
    @DisplayName("Negative Test: SAFETY-5 fails when job regresses from COMPLETED back to RUNNING")
    void testSafety5_FailsOnTerminalReversal() {
        Instant t0 = Instant.now();
        List<ChaosEvent> illegalTransitionEvents = List.of(
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.JOB_COMPLETED, "worker-1", UUID.randomUUID(), 1, 1, "Completed"),
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.JOB_CLAIMED, "worker-2", UUID.randomUUID(), 2, 2, "Illegal second claim!")
        );

        JobSnapshot regressedSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.RUNNING,
                2, 1, 3, UUID.randomUUID(), 2, "worker-2", t0.plusSeconds(30), null, null, t0, t0, null
        );

        InvariantResult result = verifier.verifySafety5_NoTerminalReversal(
                List.of(testJobId),
                illegalTransitionEvents,
                Map.of(testJobId, regressedSnapshot)
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("SAFETY-5");
        assertThat(result.evidence()).anyMatch(e -> e.contains("transitioned back to JOB_CLAIMED after COMPLETED"));
    }

    @Test
    @DisplayName("Negative Test: SAFETY-6 fails when COMPLETED job lacks audit record")
    void testSafety6_FailsOnMissingAuditLog() {
        JobSnapshot completedSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.COMPLETED,
                1, 0, 3, null, 1, null, null, null, null, Instant.now(), Instant.now(), Instant.now()
        );

        InvariantResult result = verifier.verifySafety6_ConsistentAuditEvidence(
                List.of(testJobId),
                Map.of(testJobId, completedSnapshot),
                Collections.emptyList() // No audit records!
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("SAFETY-6");
        assertThat(result.evidence()).anyMatch(e -> e.contains("lacks COMPLETED entry in qf_job_execution_logs"));
    }

    @Test
    @DisplayName("Negative Test: LIVENESS-1 fails when faulted job remains abandoned and unrecovered")
    void testLiveness1_FailsOnAbandonedUnrecoveredJob() {
        List<ChaosEvent> events = List.of(
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.JOB_CLAIMED, "worker-1", UUID.randomUUID(), 1, 1, "Claimed"),
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.FAULT_INJECTED, "worker-1", null, 1, 1, "Crash")
        );

        JobSnapshot stuckSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.RUNNING,
                1, 0, 3, UUID.randomUUID(), 1, "worker-1", Instant.now().minusSeconds(10), null, null, Instant.now(), Instant.now(), null
        );

        InvariantResult result = verifier.verifyLiveness1_AbandonedJobRecoverable(
                List.of(testJobId),
                events,
                Map.of(testJobId, stuckSnapshot)
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("LIVENESS-1");
        assertThat(result.evidence()).anyMatch(e -> e.contains("was never recovered"));
    }

    @Test
    @DisplayName("Negative Test: LIVENESS-2 fails when job remains in non-terminal state")
    void testLiveness2_FailsOnNonTerminalFinalState() {
        JobSnapshot pendingSnapshot = new JobSnapshot(
                testJobId, "idemp-bad", "GENERATE_REPORT", JobStatus.PENDING,
                1, 0, 3, null, 1, null, null, null, null, Instant.now(), Instant.now(), null
        );

        InvariantResult result = verifier.verifyLiveness2_EventualTerminalState(
                List.of(testJobId),
                Map.of(testJobId, pendingSnapshot)
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("LIVENESS-2");
        assertThat(result.evidence()).anyMatch(e -> e.contains("non-terminal state"));
    }

    @Test
    @DisplayName("Negative Test: LIVENESS-3 fails when healthy worker records zero executions")
    void testLiveness3_FailsWhenHealthyWorkerIsStarved() {
        List<ChaosEvent> events = List.of(
                ChaosEvent.of("EXP-BAD", testJobId, ChaosEventType.FAULT_INJECTED, "worker-1", null, 1, 1, "Fault")
                // worker-2 has no events
        );

        InvariantResult result = verifier.verifyLiveness3_HealthyWorkerContinuity(
                events,
                "worker-1",
                "worker-2"
        );

        assertThat(result.passed()).isFalse();
        assertThat(result.invariantId()).isEqualTo("LIVENESS-3");
        assertThat(result.evidence()).anyMatch(e -> e.contains("0 processing event(s)"));
    }
}
