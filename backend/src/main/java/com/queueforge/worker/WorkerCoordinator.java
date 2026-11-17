package com.queueforge.worker;

import com.queueforge.common.exception.PermanentJobException;
import com.queueforge.common.exception.TransientJobException;
import com.queueforge.config.WorkerProperties;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.handler.JobExecutionContext;
import com.queueforge.core.handler.JobHandler;
import com.queueforge.core.handler.JobHandlerRegistry;
import com.queueforge.service.JobClaimService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class WorkerCoordinator implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(WorkerCoordinator.class);

    private final JobClaimService claimService;
    private final JobHandlerRegistry handlerRegistry;
    private final WorkerProperties properties;
    private final com.queueforge.config.QueueForgeProperties queueForgeProperties;
    private final String coordinatorId;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private ThreadPoolExecutor workerPool;
    private ScheduledExecutorService schedulerService;

    public WorkerCoordinator(JobClaimService claimService,
                             JobHandlerRegistry handlerRegistry,
                             WorkerProperties properties,
                             com.queueforge.config.QueueForgeProperties queueForgeProperties) {
        this.claimService = claimService;
        this.handlerRegistry = handlerRegistry;
        this.properties = properties;
        this.queueForgeProperties = queueForgeProperties;
        this.coordinatorId = queueForgeProperties.getInstanceId();
    }

    @Override
    public synchronized void start() {
        if (running.get() || !queueForgeProperties.isWorkerActive() || !properties.isEnabled()) {
            log.info("WorkerCoordinator is disabled or already running (enabled={}, mode={})",
                    properties.isEnabled(), queueForgeProperties.getMode());
            return;
        }

        int concurrency = Math.max(1, properties.getConcurrency());
        AtomicInteger threadSeq = new AtomicInteger(1);

        ThreadFactory workerThreadFactory = r -> {
            Thread t = new Thread(r, "qf-worker-" + threadSeq.getAndIncrement());
            t.setDaemon(true);
            return t;
        };

        this.workerPool = new ThreadPoolExecutor(
                concurrency,
                concurrency,
                60L, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(concurrency),
                workerThreadFactory,
                new ThreadPoolExecutor.CallerRunsPolicy()
        );

        this.schedulerService = Executors.newScheduledThreadPool(2, r -> {
            Thread t = new Thread(r, "qf-coordinator-scheduler");
            t.setDaemon(true);
            return t;
        });

        running.set(true);
        log.info("[{}] WorkerCoordinator started with concurrency={} leaseDuration={}s pollInterval={}ms",
                coordinatorId, concurrency, properties.getLeaseDurationSeconds(), properties.getPollIntervalMs());

        // Polling loop: runs periodically to claim pending jobs
        schedulerService.scheduleWithFixedDelay(
                this::pollAndDispatch,
                100,
                properties.getPollIntervalMs(),
                TimeUnit.MILLISECONDS
        );

        // Recovery loop: runs periodically to reclaim expired worker leases
        schedulerService.scheduleWithFixedDelay(
                this::recoverStaleLeases,
                properties.getRecoveryPollIntervalMs(),
                properties.getRecoveryPollIntervalMs(),
                TimeUnit.MILLISECONDS
        );
    }

    private void pollAndDispatch() {
        if (!running.get()) {
            return;
        }

        try {
            // Determine capacity: avoid polling when worker pool is saturated
            int active = workerPool.getActiveCount();
            int max = workerPool.getMaximumPoolSize();
            int remainingQueue = workerPool.getQueue().remainingCapacity();
            int availableCapacity = (max - active) + remainingQueue;

            if (availableCapacity <= 0) {
                log.trace("[{}] Worker pool saturated (active={}, max={}). Skipping poll.", coordinatorId, active, max);
                return;
            }

            int batchSize = Math.min(availableCapacity, max);
            List<ClaimedJob> claimedJobs = claimService.claimJobs(
                    batchSize,
                    properties.getLeaseDurationSeconds(),
                    coordinatorId
            );

            for (ClaimedJob job : claimedJobs) {
                workerPool.submit(() -> executeClaimedJob(job));
            }
        } catch (Exception e) {
            log.error("[{}] Error during job polling and dispatch:", coordinatorId, e);
        }
    }

    private void executeClaimedJob(ClaimedJob job) {
        String workerName = coordinatorId + ":" + Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();

        try {
            MDC.put("instanceId", coordinatorId);
            MDC.put("jobId", job.id().toString());
            MDC.put("jobType", job.jobType());
            MDC.put("attempt", String.valueOf(job.attemptCount()));
            MDC.put("workerId", workerName);

            log.debug("[{}] Processing jobId={} type='{}' attempt={} retry={}",
                    workerName, job.id(), job.jobType(), job.attemptCount(), job.retryCount());

            Optional<JobHandler> handlerOpt = handlerRegistry.getHandler(job.jobType());
            if (handlerOpt.isEmpty()) {
                String errorMsg = String.format("No registered handler found for job type: '%s'", job.jobType());
                log.error("[{}] Fatal: {}", workerName, errorMsg);
                // Missing handler is unrecoverable; route immediately to DEAD_LETTER rather than retry loops
                claimService.failJob(
                        job.id(),
                        job.claimToken(),
                        job.jobType(),
                        job.attemptCount(),
                        job.retryCount(),
                        job.maxRetries(),
                        FailureCategory.HANDLER_NOT_FOUND,
                        errorMsg,
                        null,
                        System.currentTimeMillis() - startTime,
                        workerName
                );
                return;
            }

            JobHandler handler = handlerOpt.get();
            ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "qf-heartbeat-" + job.id().toString().substring(0, 8));
                t.setDaemon(true);
                return t;
            });

            // Periodic heartbeat extension for long-running executions
            int heartbeatInterval = properties.getHeartbeatIntervalSeconds();
            int leaseDuration = properties.getLeaseDurationSeconds();
            boolean disableHeartbeat = properties.isChaosPayloadsEnabled()
                    && "CHAOS_TEST".equalsIgnoreCase(job.jobType())
                    && job.payload() != null
                    && job.payload().path("disableHeartbeat").asBoolean(false);
            ScheduledFuture<?> heartbeatTask = null;

            if (!disableHeartbeat && heartbeatInterval > 0) {
                heartbeatTask = heartbeatExecutor.scheduleWithFixedDelay(
                        () -> {
                            try {
                                boolean extended = claimService.extendLease(job.id(), job.claimToken(), leaseDuration, workerName);
                                if (!extended) {
                                    log.warn("[{}] Heartbeat extension rejected for jobId={}. Fencing out.", workerName, job.id());
                                }
                            } catch (Exception ex) {
                                log.warn("[{}] Heartbeat extension exception for jobId={}: {}", workerName, job.id(), ex.getMessage());
                            }
                        },
                        heartbeatInterval,
                        heartbeatInterval,
                        TimeUnit.SECONDS
                );
            } else if (disableHeartbeat) {
                log.info("[{}] Heartbeat intentionally disabled by payload for jobId={}", workerName, job.id());
            }

            JobExecutionContext context = new JobExecutionContext(
                    job.id(),
                    job.jobType(),
                    job.payload(),
                    job.claimToken(),
                    job.attemptCount(),
                    workerName
            );

            try {
                // Business logic execution completely OUTSIDE any database transaction
                handler.handle(context);

                long duration = System.currentTimeMillis() - startTime;
                cancelHeartbeat(heartbeatTask, heartbeatExecutor);

                // Guarded completion update
                claimService.completeJob(job.id(), job.claimToken(), job.jobType(), job.attemptCount(), duration, workerName);
            } catch (Exception ex) {
                long duration = System.currentTimeMillis() - startTime;
                cancelHeartbeat(heartbeatTask, heartbeatExecutor);

                StringWriter sw = new StringWriter();
                ex.printStackTrace(new PrintWriter(sw));
                String stackTrace = sw.toString();

                FailureCategory failureCategory = (ex instanceof PermanentJobException)
                        ? FailureCategory.PERMANENT_FAILURE
                        : FailureCategory.TRANSIENT_FAILURE;

                log.error("[{}] Job {} failed with exception (category={}): {}", workerName, job.id(), failureCategory, ex.getMessage());
                claimService.failJob(
                        job.id(),
                        job.claimToken(),
                        job.jobType(),
                        job.attemptCount(),
                        job.retryCount(),
                        job.maxRetries(),
                        failureCategory,
                        ex.getMessage(),
                        stackTrace,
                        duration,
                        workerName
                );
            }
        } finally {
            MDC.clear();
        }
    }

    private void recoverStaleLeases() {
        if (!running.get()) {
            return;
        }
        try {
            claimService.recoverExpiredLeases();
        } catch (Exception e) {
            log.error("[{}] Error recovering expired leases:", coordinatorId, e);
        }
    }

    private void cancelHeartbeat(ScheduledFuture<?> task, ScheduledExecutorService executor) {
        if (task != null) {
            task.cancel(false);
        }
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    @Override
    public synchronized void stop() {
        if (!running.compareAndSet(true, false)) {
            return;
        }

        log.info("[{}] Initiating graceful shutdown of WorkerCoordinator...", coordinatorId);

        if (schedulerService != null) {
            schedulerService.shutdown();
        }

        if (workerPool != null) {
            workerPool.shutdown();
            try {
                int timeout = properties.getShutdownTimeoutSeconds();
                if (!workerPool.awaitTermination(timeout, TimeUnit.SECONDS)) {
                    log.warn("[{}] Worker pool did not terminate within {}s, forcing shutdownNow()", coordinatorId, timeout);
                    workerPool.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                workerPool.shutdownNow();
            }
        }

        log.info("[{}] WorkerCoordinator shutdown complete.", coordinatorId);
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE - 1000; // Start after persistence, stop before persistence
    }

    public int getActiveWorkerCount() {
        return workerPool != null ? workerPool.getActiveCount() : 0;
    }

    public int getPoolCapacity() {
        return workerPool != null ? workerPool.getMaximumPoolSize() : 0;
    }

    public String getCoordinatorId() {
        return coordinatorId;
    }
}
