package com.queueforge.chaoslab.fault;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Component
public class FaultInjector {

    private static final Logger log = LoggerFactory.getLogger(FaultInjector.class);
    private static final String ALLOWED_CONTAINER_PREFIX = "qf-chaos-";

    public boolean killContainer(String containerName) {
        validateContainerName(containerName);
        log.warn("[FaultInjector] Executing HARD KILL on test container: {}", containerName);
        return runCommand("docker", "kill", containerName);
    }

    public boolean pauseContainer(String containerName) {
        validateContainerName(containerName);
        log.warn("[FaultInjector] Freezing/pausing container: {}", containerName);
        return runCommand("docker", "pause", containerName);
    }

    public boolean unpauseContainer(String containerName) {
        validateContainerName(containerName);
        log.info("[FaultInjector] Unpausing/resuming container: {}", containerName);
        return runCommand("docker", "unpause", containerName);
    }

    public boolean disconnectNetwork(String networkName, String containerName) {
        validateContainerName(containerName);
        log.warn("[FaultInjector] Disconnecting container {} from network: {}", containerName, networkName);
        return runCommand("docker", "network", "disconnect", networkName, containerName);
    }

    public boolean reconnectNetwork(String networkName, String containerName) {
        validateContainerName(containerName);
        log.info("[FaultInjector] Reconnecting container {} to network: {}", containerName, networkName);
        return runCommand("docker", "network", "connect", networkName, containerName);
    }

    public void createBarrier(Path barrierPath) throws Exception {
        if (barrierPath.getParent() != null) {
            Files.createDirectories(barrierPath.getParent());
        }
        Files.writeString(barrierPath, "PAUSED_AT_" + System.currentTimeMillis());
        log.info("[FaultInjector] Created test barrier file: {}", barrierPath);
    }

    public void releaseBarrier(Path barrierPath) throws Exception {
        if (Files.exists(barrierPath)) {
            Files.delete(barrierPath);
            log.info("[FaultInjector] Released test barrier file: {}", barrierPath);
        }
    }

    private void validateContainerName(String containerName) {
        if (containerName == null || !containerName.startsWith(ALLOWED_CONTAINER_PREFIX)) {
            throw new SecurityException("SAFETY VIOLATION: FaultInjector can only target containers starting with '"
                    + ALLOWED_CONTAINER_PREFIX + "'. Target was: '" + containerName + "'");
        }
    }

    private boolean runCommand(String... args) {
        try {
            ProcessBuilder pb = new ProcessBuilder(args);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean finished = process.waitFor(15, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.error("Command timed out: {}", String.join(" ", args));
                return false;
            }
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.warn("Command output: {}", line);
                    }
                }
            }
            return exitCode == 0;
        } catch (Exception e) {
            log.error("Failed to run command: {}", String.join(" ", args), e);
            return false;
        }
    }
}
