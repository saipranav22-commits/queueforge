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

    public QueueForgeWorkerHealthIndicator(WorkerCoordinator workerCoordinator) {
        this.workerCoordinator = workerCoordinator;
    }

    @Override
    public Health health() {
        if (!workerCoordinator.isRunning()) {
            return Health.down()
                    .withDetail("workerStatus", "STOPPED")
                    .withDetail("message", "WorkerCoordinator background engine is not running")
                    .build();
        }

        int activeWorkers = workerCoordinator.getActiveWorkerCount();
        int poolCapacity = workerCoordinator.getPoolCapacity();

        Health.Builder builder = Health.up()
                .withDetail("workerStatus", "RUNNING")
                .withDetail("activeWorkers", activeWorkers)
                .withDetail("poolCapacity", poolCapacity);

        // Warning flag if pool is completely saturated
        if (poolCapacity > 0 && activeWorkers >= poolCapacity) {
            builder.withDetail("saturationWarning", "Worker pool operating at 100% maximum capacity");
        }

        return builder.build();
    }
}
