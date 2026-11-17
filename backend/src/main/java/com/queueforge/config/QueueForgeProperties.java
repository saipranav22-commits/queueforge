package com.queueforge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.UUID;

/**
 * Top-level configuration properties governing instance identity and operational mode.
 */
@Component
@ConfigurationProperties(prefix = "queueforge")
public class QueueForgeProperties {

    /**
     * Deployment mode: COMBINED (default), API_ONLY, or WORKER_ONLY.
     */
    private AppMode mode = AppMode.COMBINED;

    /**
     * Unique identifier for this JVM process instance in the cluster (e.g. worker-node-1).
     * If blank or omitted, an identifier is generated dynamically.
     */
    private String instanceId;

    public AppMode getMode() {
        return mode;
    }

    public void setMode(AppMode mode) {
        this.mode = mode;
    }

    public String getInstanceId() {
        if (instanceId == null || instanceId.isBlank()) {
            instanceId = defaultInstanceId();
        }
        return instanceId;
    }

    public void setInstanceId(String instanceId) {
        this.instanceId = instanceId;
    }

    public boolean isWorkerActive() {
        return mode == AppMode.COMBINED || mode == AppMode.WORKER_ONLY;
    }

    public boolean isApiActive() {
        return mode == AppMode.COMBINED || mode == AppMode.API_ONLY;
    }

    private static String defaultInstanceId() {
        String host = "node";
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (Exception ignored) {
        }
        return "qf-" + host + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
