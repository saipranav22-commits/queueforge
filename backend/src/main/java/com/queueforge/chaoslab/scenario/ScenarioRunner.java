package com.queueforge.chaoslab.scenario;

import com.queueforge.chaoslab.fault.FaultInjector;
import com.queueforge.chaoslab.model.*;
import com.queueforge.chaoslab.recorder.EventRecorder;
import com.queueforge.chaoslab.reporter.ExperimentReporter;
import com.queueforge.chaoslab.verification.InvariantVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

@Component
public class ScenarioRunner {

    private static final Logger log = LoggerFactory.getLogger(ScenarioRunner.class);

    private final EventRecorder eventRecorder;
    private final InvariantVerifier invariantVerifier;
    private final ExperimentReporter experimentReporter;
    private final FaultInjector faultInjector;

    public ScenarioRunner(EventRecorder eventRecorder,
                          InvariantVerifier invariantVerifier,
                          ExperimentReporter experimentReporter,
                          FaultInjector faultInjector) {
        this.eventRecorder = eventRecorder;
        this.invariantVerifier = invariantVerifier;
        this.experimentReporter = experimentReporter;
        this.faultInjector = faultInjector;
    }

    public ExperimentReport buildReport(
            String scenarioId,
            String scenarioName,
            Instant startTime,
            Instant endTime,
            String failureInjected,
            String targetWorker,
            Map<String, Object> environment,
            List<UUID> targetJobIds,
            Map<UUID, JobSnapshot> dbSnapshots,
            List<AuditSnapshot> auditLogs,
            String faultedWorkerId,
            String healthyWorkerId,
            String summary
    ) {
        List<ChaosEvent> events = eventRecorder.getEvents(scenarioId);
        List<InvariantResult> invariants = invariantVerifier.verifyAll(
                scenarioId,
                targetJobIds,
                events,
                dbSnapshots,
                auditLogs,
                faultedWorkerId,
                healthyWorkerId
        );

        boolean allPassed = invariants.stream().allMatch(InvariantResult::passed);
        long durationMs = endTime.toEpochMilli() - startTime.toEpochMilli();

        return new ExperimentReport(
                scenarioId,
                scenarioName,
                startTime,
                endTime,
                durationMs,
                failureInjected,
                targetWorker,
                environment,
                targetJobIds,
                events,
                invariants,
                allPassed,
                summary
        );
    }

    public void saveReports(ExperimentReport report, Path baseDir) {
        try {
            Path jsonPath = baseDir.resolve(report.scenarioId() + ".json");
            Path mdPath = baseDir.resolve(report.scenarioId() + ".md");
            experimentReporter.saveJsonReport(report, jsonPath);
            experimentReporter.saveMarkdownReport(report, mdPath);
        } catch (Exception e) {
            log.error("Failed to write experiment reports for scenario {}:", report.scenarioId(), e);
        }
    }
}
