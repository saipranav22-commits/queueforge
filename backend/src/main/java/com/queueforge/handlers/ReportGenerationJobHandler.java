package com.queueforge.handlers;

import com.fasterxml.jackson.databind.JsonNode;
import com.queueforge.core.handler.JobExecutionContext;
import com.queueforge.core.handler.JobHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@Component
public class ReportGenerationJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(ReportGenerationJobHandler.class);
    public static final String JOB_TYPE = "GENERATE_REPORT";

    @Override
    public String getJobType() {
        return JOB_TYPE;
    }

    @Override
    public void handle(JobExecutionContext context) throws Exception {
        log.info("[Worker-{}] Executing report generation for jobId={} (attempt={})",
                context.workerId(), context.jobId(), context.attempt());

        JsonNode payload = context.payload();
        String reportName = payload.path("reportName").asText("default-report");
        String format = payload.path("format").asText("PDF");

        // Write running signal file if requested by test harness
        String signalRunningFile = payload.path("signalRunningFile").asText(null);
        if (signalRunningFile != null && !signalRunningFile.isBlank()) {
            try {
                java.io.File sFile = new java.io.File(signalRunningFile);
                if (sFile.getParentFile() != null) {
                    sFile.getParentFile().mkdirs();
                }
                java.nio.file.Files.writeString(sFile.toPath(), context.workerId() + ":" + context.jobId() + ":" + System.currentTimeMillis());
                log.info("[Worker-{}] Emitted running signal to {} for jobId={}", context.workerId(), signalRunningFile, context.jobId());
            } catch (Exception e) {
                log.warn("[Worker-{}] Failed to write signalRunningFile: {}", context.workerId(), e.getMessage());
            }
        }

        // Wait on test synchronization barrier if requested
        String barrierFile = payload.path("barrierFile").asText(null);
        int barrierAttempt = payload.path("barrierAttempt").asInt(1);
        if (barrierFile != null && !barrierFile.isBlank() && context.attempt() == barrierAttempt) {
            java.io.File bFile = new java.io.File(barrierFile);
            long maxWaitMs = payload.path("barrierTimeoutMs").asLong(30000);
            long startWait = System.currentTimeMillis();
            log.info("[Worker-{}] Waiting on barrier file {} (attempt={}, maxWaitMs={}) for jobId={}",
                    context.workerId(), barrierFile, context.attempt(), maxWaitMs, context.jobId());
            while (bFile.exists() && (System.currentTimeMillis() - startWait < maxWaitMs)) {
                Thread.sleep(100);
            }
            log.info("[Worker-{}] Barrier released or timed out for jobId={}", context.workerId(), context.jobId());
        }

        // Artificial execution delay for crash or slow-worker testing
        long delayMs = payload.path("delayMs").asLong(0);
        if (delayMs > 0) {
            log.info("[Worker-{}] Simulating execution delay of {}ms for jobId={}", context.workerId(), delayMs, context.jobId());
            Thread.sleep(delayMs);
        }

        if (reportName.equalsIgnoreCase("TRIGGER_FAIL")) {
            throw new RuntimeException("Simulated failure for report generation test");
        }

        // Simulate deterministic CPU work by hashing the report parameters
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        String input = String.format("REPORT:%s|FORMAT:%s|JOB:%s", reportName, format, context.jobId());
        byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
        String reportChecksum = HexFormat.of().formatHex(hash);

        log.info("[Worker-{}] Generated report '{}' in format '{}' (checksum={}) for jobId={}",
                context.workerId(), reportName, format, reportChecksum, context.jobId());
    }
}
