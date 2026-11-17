package com.queueforge.health;

import com.queueforge.worker.WorkerCoordinator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Health indicator monitoring the background worker engine.
 * Distinguishes healthy active processing from thread exhaustion or coordinator failure.
 */
@Component("queueForgeWorker")
public class QueueForgeWorkerHealthIndicator implements HealthIndicator {

    private final WorkerCoordinator workerCoordinator;
    private final com.queueforge.config.QueueForgeProperties queueForgeProperties;

    public QueueForgeWorkerHealthIndicator(WorkerCoordinator workerCoordinator,
                                           com.queueforge.config.QueueForgeProperties queueForgeProperties) {
        this.workerCoordinator = workerCoordinator;
        this.queueForgeProperties = queueForgeProperties;
    }

    @Override
    public Health health() {
        if (!queueForgeProperties.isWorkerActive()) {
            return Health.up()
                    .withDetail("workerStatus", "DISABLED")
                    .withDetail("mode", queueForgeProperties.getMode().name())
                    .withDetail("message", "Worker coordinator disabled in API_ONLY mode (delegated to external workers)")
                    .build();
        }

        if (!workerCoordinator.isRunning()) {
            return Health.down()
                    .withDetail("workerStatus", "STOPPED")
                    .withDetail("mode", queueForgeProperties.getMode().name())
                    .withDetail("message", "WorkerCoordinator background engine is not running")
                    .build();
        }

        int activeWorkers = workerCoordinator.getActiveWorkerCount();
        int poolCapacity = workerCoordinator.getPoolCapacity();

        Health.Builder builder = Health.up()
                .withDetail("workerStatus", "RUNNING")
                .withDetail("instanceId", queueForgeProperties.getInstanceId())
                .withDetail("mode", queueForgeProperties.getMode().name())
                .withDetail("activeWorkers", activeWorkers)
                .withDetail("poolCapacity", poolCapacity);

        // Warning flag if pool is completely saturated
        if (poolCapacity > 0 && activeWorkers >= poolCapacity) {
            builder.withDetail("saturationWarning", "Worker pool operating at 100% maximum capacity");
        }

        return builder.build();
    }
}
