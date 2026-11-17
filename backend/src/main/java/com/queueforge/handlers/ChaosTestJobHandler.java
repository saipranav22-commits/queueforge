package com.queueforge.handlers;

import com.fasterxml.jackson.databind.JsonNode;
import com.queueforge.core.handler.JobExecutionContext;
import com.queueforge.core.handler.JobHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Dedicated test-only job handler for ChaosLab experiments.
 * Separated completely from production job handlers.
 * Conditionally loaded ONLY when queueforge.worker.chaos-payloads-enabled is true.
 * Implements strict path-traversal guards and bounded timeouts.
 */
@Component
@ConditionalOnProperty(prefix = "queueforge.worker", name = "chaos-payloads-enabled", havingValue = "true")
public class ChaosTestJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(ChaosTestJobHandler.class);
    public static final String JOB_TYPE = "CHAOS_TEST";

    private static final long MAX_BARRIER_TIMEOUT_MS = 30000;
    private static final long MAX_ARTIFICIAL_DELAY_MS = 60000;

    @Override
    public String getJobType() {
        return JOB_TYPE;
    }

    @Override
    public void handle(JobExecutionContext context) throws Exception {
        log.info("[Worker-{}] Executing ChaosLab test job id={} (attempt={})",
                context.workerId(), context.jobId(), context.attempt());

        JsonNode payload = context.payload();
        if (payload == null) {
            return;
        }

        // 1. Signal Running File (with strict path validation)
        String signalPath = payload.path("signalRunningFile").asText(null);
        if (signalPath != null && !signalPath.isBlank()) {
            validatePathSafety(signalPath);
            File sFile = new File(signalPath);
            if (sFile.getParentFile() != null) {
                sFile.getParentFile().mkdirs();
            }
            Files.writeString(sFile.toPath(), context.workerId() + ":" + context.jobId() + ":" + System.currentTimeMillis());
            log.info("[Worker-{}] Emitted running signal to {} for jobId={}", context.workerId(), signalPath, context.jobId());
        }

        // 2. Barrier Synchronization (with bounded wait and attempt gating)
        String barrierPath = payload.path("barrierFile").asText(null);
        int barrierAttempt = payload.path("barrierAttempt").asInt(1);
        if (barrierPath != null && !barrierPath.isBlank() && context.attempt() == barrierAttempt) {
            validatePathSafety(barrierPath);
            File bFile = new File(barrierPath);
            long requestedTimeout = payload.path("barrierTimeoutMs").asLong(MAX_BARRIER_TIMEOUT_MS);
            long maxWaitMs = Math.min(requestedTimeout, MAX_BARRIER_TIMEOUT_MS);
            long startWait = System.currentTimeMillis();

            log.info("[Worker-{}] Waiting on barrier file {} (attempt={}, maxWaitMs={}) for jobId={}",
                    context.workerId(), barrierPath, context.attempt(), maxWaitMs, context.jobId());

            while (bFile.exists() && (System.currentTimeMillis() - startWait < maxWaitMs)) {
                Thread.sleep(100);
            }
            log.info("[Worker-{}] Barrier released or timed out for jobId={}", context.workerId(), context.jobId());
        }

        // 3. Artificial Execution Delay (bounded)
        long requestedDelay = payload.path("delayMs").asLong(0);
        long delayMs = Math.min(Math.max(0, requestedDelay), MAX_ARTIFICIAL_DELAY_MS);
        if (delayMs > 0) {
            log.info("[Worker-{}] Simulating execution delay of {}ms for jobId={}", context.workerId(), delayMs, context.jobId());
            Thread.sleep(delayMs);
        }

        // 4. Simulated Failure Trigger
        if (payload.path("failExecution").asBoolean(false)) {
            throw new RuntimeException("Simulated fault requested by ChaosLab test payload");
        }

        log.info("[Worker-{}] ChaosLab test job id={} completed successfully", context.workerId(), context.jobId());
    }

    private void validatePathSafety(String filePath) {
        if (filePath.contains("..")) {
            throw new SecurityException("Path traversal attempt rejected in ChaosLab file parameter: " + filePath);
        }
        Path path = Paths.get(filePath).normalize();
        String str = path.toString().replace('\\', '/').toLowerCase();

        boolean allowed = str.startsWith("/chaos-signals")
                || str.contains("chaos-signals")
                || str.contains("temp")
                || str.contains("data/chaos-signals");

        if (!allowed) {
            throw new SecurityException("Access to path outside authorized test signal directories rejected: " + filePath);
        }
    }
}
