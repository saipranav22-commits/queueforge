package com.queueforge.chaoslab.reporter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.queueforge.chaoslab.model.ChaosEvent;
import com.queueforge.chaoslab.model.ExperimentReport;
import com.queueforge.chaoslab.model.InvariantResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class ExperimentReporter {

    private static final Logger log = LoggerFactory.getLogger(ExperimentReporter.class);
    private final ObjectMapper objectMapper;

    public ExperimentReporter() {
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .enable(SerializationFeature.INDENT_OUTPUT)
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public ExperimentReporter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void saveJsonReport(ExperimentReport report, Path outputPath) throws IOException {
        if (outputPath.getParent() != null) {
            Files.createDirectories(outputPath.getParent());
        }
        Files.writeString(outputPath, objectMapper.writeValueAsString(report));
        log.info("Saved JSON experiment report to: {}", outputPath.toAbsolutePath());
    }

    public void saveMarkdownReport(ExperimentReport report, Path outputPath) throws IOException {
        if (outputPath.getParent() != null) {
            Files.createDirectories(outputPath.getParent());
        }
        String markdown = formatMarkdown(report);
        Files.writeString(outputPath, markdown);
        log.info("Saved Markdown experiment report to: {}", outputPath.toAbsolutePath());
    }

    public String formatMarkdown(ExperimentReport report) {
        StringBuilder sb = new StringBuilder();
        sb.append("# QueueForge ChaosLab Experiment Report: ").append(report.scenarioId()).append("\n\n");
        sb.append("**Scenario Name:** ").append(report.scenarioName()).append("\n");
        sb.append("**Status:** ").append(report.allInvariantsPassed() ? "✅ PASSED" : "❌ FAILED").append("\n");
        sb.append("**Start Time:** ").append(report.startTime()).append("\n");
        sb.append("**End Time:** ").append(report.endTime()).append("\n");
        sb.append("**Duration:** ").append(report.durationMs()).append(" ms\n");
        sb.append("**Failure Injected:** `").append(report.failureInjected()).append("` on worker `").append(report.targetWorker()).append("`\n\n");

        sb.append("## Summary\n\n");
        sb.append(report.summary()).append("\n\n");

        sb.append("## Invariant Verification Results\n\n");
        sb.append("| Invariant ID | Name | Status | Message |\n");
        sb.append("| :--- | :--- | :--- | :--- |\n");
        for (InvariantResult inv : report.invariants()) {
            sb.append("| `").append(inv.invariantId()).append("` | ")
                    .append(inv.name()).append(" | ")
                    .append(inv.passed() ? "✅ PASS" : "❌ FAIL").append(" | ")
                    .append(inv.message()).append(" |\n");
        }
        sb.append("\n");

        sb.append("### Invariant Evidence Details\n\n");
        for (InvariantResult inv : report.invariants()) {
            sb.append("#### ").append(inv.invariantId()).append(" — ").append(inv.name()).append(" (")
                    .append(inv.passed() ? "PASS" : "FAIL").append(")\n");
            for (String ev : inv.evidence()) {
                sb.append("- ").append(ev).append("\n");
            }
            sb.append("\n");
        }

        sb.append("## Event Chronology\n\n");
        sb.append("| Timestamp | Event Type | Worker | Job ID | Details |\n");
        sb.append("| :--- | :--- | :--- | :--- | :--- |\n");
        for (ChaosEvent ev : report.events()) {
            sb.append("| `").append(ev.timestamp()).append("` | `")
                    .append(ev.type()).append("` | `")
                    .append(ev.workerId() != null ? ev.workerId() : "-").append("` | `")
                    .append(ev.jobId() != null ? ev.jobId().toString().substring(0, 8) + "..." : "-").append("` | ")
                    .append(ev.details()).append(" |\n");
        }
        sb.append("\n");

        sb.append("## Environment Topology\n\n");
        sb.append("```json\n");
        try {
            sb.append(objectMapper.writeValueAsString(report.environment())).append("\n");
        } catch (Exception e) {
            sb.append(report.environment().toString()).append("\n");
        }
        sb.append("```\n");

        return sb.toString();
    }
}
