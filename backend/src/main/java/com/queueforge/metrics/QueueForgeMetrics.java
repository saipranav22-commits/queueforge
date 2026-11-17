package com.queueforge.metrics;

import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.worker.WorkerCoordinator;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Centralized metrics registry for QueueForge.
 * Exposes gauges, counters, and timers to Micrometer and Prometheus.
 *
 * Performance Safeguards:
 * 1. Queue gauges do NOT query PostgreSQL on every Prometheus scrape.
 *    Instead, a lightweight single GROUP BY query executes at most once every 1,000ms
 *    and caches results in AtomicLongs.
 * 2. All tags have strictly bounded cardinality (job_type, failure_category, recovery_type, status).
 *    No job IDs, idempotency keys, or raw payloads are ever tagged.
 */
@Component
public class QueueForgeMetrics implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(QueueForgeMetrics.class);

    private final MeterRegistry registry;
    private final JdbcTemplate jdbcTemplate;
    private final WorkerCoordinator workerCoordinator;
    private final com.queueforge.config.QueueForgeProperties queueForgeProperties;

    // Gauges backing values
    private final AtomicLong pendingJobs = new AtomicLong(0);
    private final AtomicLong runningJobs = new AtomicLong(0);
    private final AtomicLong completedJobs = new AtomicLong(0);
    private final AtomicLong deadLetterJobs = new AtomicLong(0);
    private final AtomicLong archivedJobs = new AtomicLong(0);
    private final AtomicLong pendingOutboxEvents = new AtomicLong(0);

    // Refresh synchronization
    private final AtomicBoolean running = new AtomicBoolean(false);
    private ScheduledExecutorService metricsScheduler;
    private volatile long lastRefreshTimestamp = 0;

    public QueueForgeMetrics(MeterRegistry registry,
                             JdbcTemplate jdbcTemplate,
                             @Lazy WorkerCoordinator workerCoordinator,
                             com.queueforge.config.QueueForgeProperties queueForgeProperties) {
        this.registry = registry;
        this.jdbcTemplate = jdbcTemplate;
        this.workerCoordinator = workerCoordinator;
        this.queueForgeProperties = queueForgeProperties;

        registerGauges();
    }

    private void registerGauges() {
        Gauge.builder("queueforge.jobs.pending", pendingJobs, AtomicLong::get)
                .description("Current number of pending jobs awaiting worker claim")
                .register(registry);

        Gauge.builder("queueforge.jobs.running", runningJobs, AtomicLong::get)
                .description("Current number of jobs currently in RUNNING state under active worker lease")
                .register(registry);

        Gauge.builder("queueforge.jobs.completed", completedJobs, AtomicLong::get)
                .description("Current total number of completed jobs in persistent store")
                .register(registry);

        Gauge.builder("queueforge.jobs.dead_letter", deadLetterJobs, AtomicLong::get)
                .description("Current number of jobs in dead-letter queue requiring administrative attention")
                .register(registry);

        Gauge.builder("queueforge.outbox.pending", pendingOutboxEvents, AtomicLong::get)
                .description("Current number of pending outbox events awaiting delivery")
                .register(registry);

        Gauge.builder("queueforge.workers.active", this, QueueForgeMetrics::getActiveWorkerCount)
                .description("Number of worker threads actively executing jobs in local instance worker pool")
                .tag("instance_id", queueForgeProperties.getInstanceId())
                .tag("mode", queueForgeProperties.getMode().name())
                .register(registry);

        Gauge.builder("queueforge.workers.capacity", this, QueueForgeMetrics::getWorkerCapacity)
                .description("Maximum worker pool capacity of this local instance")
                .tag("instance_id", queueForgeProperties.getInstanceId())
                .tag("mode", queueForgeProperties.getMode().name())
                .register(registry);
    }

    @Override
    public synchronized void start() {
        if (running.compareAndSet(false, true)) {
            this.metricsScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "qf-metrics-refresher");
                t.setDaemon(true);
                return t;
            });

            // Initial refresh
            refreshQueueCounts();

            // Refresh queue counts every 1 second
            this.metricsScheduler.scheduleWithFixedDelay(
                    this::refreshQueueCounts,
                    1, 1, TimeUnit.SECONDS
            );
            log.info("QueueForgeMetrics started with 1-second queue count refresher");
        }
    }

    @Override
    public synchronized void stop() {
        if (running.compareAndSet(true, false)) {
            if (metricsScheduler != null) {
                metricsScheduler.shutdownNow();
            }
            log.info("QueueForgeMetrics stopped");
        }
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    /**
     * Executes a single aggregated SQL query to refresh queue counts without locking.
     */
    public void refreshQueueCounts() {
        try {
            String sql = "SELECT status, COUNT(*) AS cnt FROM qf_jobs GROUP BY status";
            Map<String, Long> counts = new ConcurrentHashMap<>();

            jdbcTemplate.query(sql, rs -> {
                String status = rs.getString("status");
                long cnt = rs.getLong("cnt");
                if (status != null) {
                    counts.put(status, cnt);
                }
            });

            pendingJobs.set(counts.getOrDefault(JobStatus.PENDING.name(), 0L));
            runningJobs.set(counts.getOrDefault(JobStatus.RUNNING.name(), 0L));
            completedJobs.set(counts.getOrDefault(JobStatus.COMPLETED.name(), 0L));
            deadLetterJobs.set(counts.getOrDefault(JobStatus.DEAD_LETTER.name(), 0L));
            archivedJobs.set(counts.getOrDefault(JobStatus.ARCHIVED.name(), 0L));

            try {
                Long outboxPending = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING'", Long.class);
                pendingOutboxEvents.set(outboxPending != null ? outboxPending : 0L);
            } catch (Exception ignored) {
                // Table might not be created during early migration stages
            }

            lastRefreshTimestamp = System.currentTimeMillis();
        } catch (Exception e) {
            log.debug("Failed to refresh queue metrics (database may be busy or initializing): {}", e.getMessage());
        }
    }

    public double getActiveWorkerCount() {
        if (workerCoordinator == null) {
            return 0.0;
        }
        return workerCoordinator.getActiveWorkerCount();
    }

    public double getWorkerCapacity() {
        if (workerCoordinator == null) {
            return 0.0;
        }
        return workerCoordinator.getPoolCapacity();
    }

    // =========================================================================
    // Counters
    // =========================================================================

    public void incrementJobsSubmitted(String jobType) {
        Counter.builder("queueforge.jobs.submitted.total")
                .description("Total number of jobs submitted into QueueForge")
                .tag("job_type", normalizeTag(jobType))
                .register(registry)
                .increment();
    }

    public void incrementJobsCompleted(String jobType) {
        Counter.builder("queueforge.jobs.completed.total")
                .description("Total number of successfully executed and completed jobs")
                .tag("job_type", normalizeTag(jobType))
                .register(registry)
                .increment();
    }

    public void incrementJobsFailed(String jobType, FailureCategory category) {
        Counter.builder("queueforge.jobs.failed.total")
                .description("Total number of job execution failures")
                .tag("job_type", normalizeTag(jobType))
                .tag("failure_category", category != null ? category.name() : "UNKNOWN")
                .register(registry)
                .increment();
    }

    public void incrementJobsRetried(String jobType) {
        Counter.builder("queueforge.jobs.retried.total")
                .description("Total number of retry schedules initiated after transient failure")
                .tag("job_type", normalizeTag(jobType))
                .register(registry)
                .increment();
    }

    public void incrementJobsRecovered(String recoveryType) {
        Counter.builder("queueforge.jobs.recovered.total")
                .description("Total number of jobs recovered from failure or lease expiry")
                .tag("recovery_type", normalizeTag(recoveryType))
                .register(registry)
                .increment();
    }

    // =========================================================================
    // Timers
    // =========================================================================

    public void recordExecutionDuration(String jobType, String status, Duration duration) {
        Timer.builder("queueforge.job.execution.duration")
                .description("Execution duration of job handlers in worker thread pool")
                .tag("job_type", normalizeTag(jobType))
                .tag("status", normalizeTag(status))
                .register(registry)
                .record(duration);
    }

    public void recordQueueWaitDuration(String jobType, Duration duration) {
        if (duration.isNegative()) {
            duration = Duration.ZERO;
        }
        Timer.builder("queueforge.job.queue_wait_duration")
                .description("Duration a job remained in queue from scheduled_at until claimed by worker")
                .tag("job_type", normalizeTag(jobType))
                .register(registry)
                .record(duration);
    }

    // =========================================================================
    // Outbox Metrics
    // =========================================================================

    public void incrementOutboxCreated(String eventType) {
        Counter.builder("queueforge.outbox.events.created.total")
                .description("Total number of transactional outbox events written with order transaction")
                .tag("event_type", normalizeTag(eventType))
                .register(registry)
                .increment();
    }

    public void incrementOutboxDelivered(String eventType) {
        Counter.builder("queueforge.outbox.events.delivered.total")
                .description("Total number of outbox events successfully delivered and acknowledged")
                .tag("event_type", normalizeTag(eventType))
                .register(registry)
                .increment();
    }

    public void incrementOutboxFailed(String eventType, String errorCategory) {
        Counter.builder("queueforge.outbox.events.failed.total")
                .description("Total number of outbox event dispatch attempts that resulted in failure")
                .tag("event_type", normalizeTag(eventType))
                .tag("error_category", normalizeTag(errorCategory))
                .register(registry)
                .increment();
    }

    public void incrementOutboxDeadLetter(String eventType) {
        Counter.builder("queueforge.outbox.events.dead_letter.total")
                .description("Total number of outbox events moved to dead-letter state after retry exhaustion")
                .tag("event_type", normalizeTag(eventType))
                .register(registry)
                .increment();
    }

    public void incrementOutboxAttempt(String eventType) {
        Counter.builder("queueforge.outbox.delivery.attempts.total")
                .description("Total number of outbox event dispatch attempts initiated")
                .tag("event_type", normalizeTag(eventType))
                .register(registry)
                .increment();
    }

    public void recordOutboxDeliveryDuration(String eventType, Duration duration) {
        if (duration.isNegative()) {
            duration = Duration.ZERO;
        }
        Timer.builder("queueforge.outbox.delivery.duration")
                .description("Latency of outbox delivery from dispatch claim to receiver acknowledgement")
                .tag("event_type", normalizeTag(eventType))
                .register(registry)
                .record(duration);
    }

    public long getPendingOutboxCount() {
        return pendingOutboxEvents.get();
    }

    // =========================================================================
    // Gauge Read Accessors (for tests)
    // =========================================================================

    public long getPendingCount() {
        return pendingJobs.get();
    }

    public long getRunningCount() {
        return runningJobs.get();
    }

    public long getCompletedCount() {
        return completedJobs.get();
    }

    public long getDeadLetterCount() {
        return deadLetterJobs.get();
    }

    public long getArchivedCount() {
        return archivedJobs.get();
    }

    public MeterRegistry getMeterRegistry() {
        return registry;
    }

    private String normalizeTag(String value) {
        return (value != null && !value.isBlank()) ? value.trim().toUpperCase() : "UNKNOWN";
    }
}
