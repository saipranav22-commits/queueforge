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
