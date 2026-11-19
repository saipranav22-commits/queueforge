package com.queueforge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "queueforge.worker")
public class WorkerProperties {

    private boolean enabled = true;
    private int concurrency = 4;
    private long pollIntervalMs = 250;
    private int leaseDurationSeconds = 30;
    private int heartbeatIntervalSeconds = 10;
    private long recoveryPollIntervalMs = 5000;
    private int shutdownTimeoutSeconds = 10;
    private boolean chaosPayloadsEnabled = false;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getConcurrency() {
        return concurrency;
    }

    public void setConcurrency(int concurrency) {
        this.concurrency = concurrency;
    }

    public long getPollIntervalMs() {
        return pollIntervalMs;
    }

    public void setPollIntervalMs(long pollIntervalMs) {
        this.pollIntervalMs = pollIntervalMs;
    }

    public int getLeaseDurationSeconds() {
        return leaseDurationSeconds;
    }

    public void setLeaseDurationSeconds(int leaseDurationSeconds) {
        this.leaseDurationSeconds = leaseDurationSeconds;
    }

    public int getHeartbeatIntervalSeconds() {
        return heartbeatIntervalSeconds;
    }

    public void setHeartbeatIntervalSeconds(int heartbeatIntervalSeconds) {
        this.heartbeatIntervalSeconds = heartbeatIntervalSeconds;
    }

    public long getRecoveryPollIntervalMs() {
        return recoveryPollIntervalMs;
    }

    public void setRecoveryPollIntervalMs(long recoveryPollIntervalMs) {
        this.recoveryPollIntervalMs = recoveryPollIntervalMs;
    }

    public int getShutdownTimeoutSeconds() {
        return shutdownTimeoutSeconds;
    }

    public void setShutdownTimeoutSeconds(int shutdownTimeoutSeconds) {
        this.shutdownTimeoutSeconds = shutdownTimeoutSeconds;
    }

    public boolean isChaosPayloadsEnabled() {
        return chaosPayloadsEnabled;
    }

    public void setChaosPayloadsEnabled(boolean chaosPayloadsEnabled) {
        this.chaosPayloadsEnabled = chaosPayloadsEnabled;
    }
}
