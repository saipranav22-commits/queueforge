package com.queueforge.service;

import com.queueforge.api.dto.DashboardStatsResponse;
import com.queueforge.api.dto.SystemHealthResponse;
import com.queueforge.api.dto.SystemMetricsSummaryResponse;
import com.queueforge.config.WorkerProperties;
import com.queueforge.metrics.QueueForgeMetrics;
import com.queueforge.worker.WorkerCoordinator;
import com.zaxxer.hikari.HikariDataSource;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class DashboardService {

    private final QueueForgeMetrics metrics;
    private final WorkerCoordinator workerCoordinator;
    private final WorkerProperties workerProperties;
    private final JdbcTemplate jdbcTemplate;
    private final DataSource dataSource;

    public DashboardService(QueueForgeMetrics metrics,
                            @Lazy WorkerCoordinator workerCoordinator,
                            WorkerProperties workerProperties,
                            JdbcTemplate jdbcTemplate,
                            DataSource dataSource) {
        this.metrics = metrics;
        this.workerCoordinator = workerCoordinator;
        this.workerProperties = workerProperties;
        this.jdbcTemplate = jdbcTemplate;
        this.dataSource = dataSource;
    }

    public DashboardStatsResponse getDashboardStats() {
        long pending = metrics.getPendingCount();
        long running = metrics.getRunningCount();
        long completed = metrics.getCompletedCount();
        long deadLetter = metrics.getDeadLetterCount();
        long archived = metrics.getArchivedCount();
        long total = pending + running + completed + deadLetter + archived;

        double activeWorkers = metrics.getActiveWorkerCount();
        int capacity = workerCoordinator != null ? workerCoordinator.getPoolCapacity() : workerProperties.getConcurrency();
        if (capacity == 0) {
            capacity = workerProperties.getConcurrency();
        }

        String workerStatus = (workerCoordinator != null && workerCoordinator.isRunning()) ? "RUNNING" : "STOPPED";

        double submitted = sumCounters("queueforge.jobs.submitted.total");
        double completedTotal = sumCounters("queueforge.jobs.completed.total");
        double failed = sumCounters("queueforge.jobs.failed.total");
        double retried = sumCounters("queueforge.jobs.retried.total");
        double recovered = sumCounters("queueforge.jobs.recovered.total");

        return new DashboardStatsResponse(
                pending,
                running,
                completed,
                deadLetter,
                archived,
                total,
                activeWorkers,
                capacity,
                workerStatus,
                submitted,
                completedTotal,
                failed,
                retried,
                recovered
        );
    }

    public SystemHealthResponse getSystemHealth() {
        String dbStatus = "UP";
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        } catch (Exception e) {
            dbStatus = "DOWN";
        }

        boolean workerRunning = workerCoordinator != null && workerCoordinator.isRunning();
        String workerStatus = workerRunning ? "RUNNING" : "STOPPED";
        String overallStatus = ("UP".equals(dbStatus) && (workerRunning || !workerProperties.isEnabled())) ? "UP" : "DEGRADED";

        double activeWorkers = metrics.getActiveWorkerCount();
        int capacity = workerCoordinator != null ? workerCoordinator.getPoolCapacity() : workerProperties.getConcurrency();
        if (capacity == 0) {
            capacity = workerProperties.getConcurrency();
        }

        int poolActive = 0;
        int poolIdle = 0;
        int poolTotal = 0;

        if (dataSource instanceof HikariDataSource hikari) {
            poolActive = hikari.getHikariPoolMXBean() != null ? hikari.getHikariPoolMXBean().getActiveConnections() : 0;
            poolIdle = hikari.getHikariPoolMXBean() != null ? hikari.getHikariPoolMXBean().getIdleConnections() : 0;
            poolTotal = hikari.getHikariPoolMXBean() != null ? hikari.getHikariPoolMXBean().getTotalConnections() : 0;
        }

        long uptimeSec = ManagementFactory.getRuntimeMXBean().getUptime() / 1000L;

        return new SystemHealthResponse(
                overallStatus,
                dbStatus,
                workerStatus,
                activeWorkers,
                capacity,
                workerProperties.getLeaseDurationSeconds(),
                workerProperties.getPollIntervalMs(),
                poolActive,
                poolIdle,
                poolTotal,
                uptimeSec
        );
    }

    public SystemMetricsSummaryResponse getMetricsSummary() {
        double submitted = sumCounters("queueforge.jobs.submitted.total");
        double completed = sumCounters("queueforge.jobs.completed.total");
        double failed = sumCounters("queueforge.jobs.failed.total");
        double retried = sumCounters("queueforge.jobs.retried.total");
        double recovered = sumCounters("queueforge.jobs.recovered.total");

        MeterRegistry registry = metrics.getMeterRegistry();
        Map<String, Double> failuresByCategory = new HashMap<>();

        registry.find("queueforge.jobs.failed.total").counters().forEach(counter -> {
            String category = counter.getId().getTag("failure_category");
            if (category != null) {
                failuresByCategory.merge(category, counter.count(), Double::sum);
            }
        });

        // Compute execution latency from timer
        double execP50 = 0.0;
        double execP95 = 0.0;
        double execP99 = 0.0;
        Timer execTimer = registry.find("queueforge.job.execution.duration").timer();
        if (execTimer != null && execTimer.count() > 0) {
            double meanMs = execTimer.mean(TimeUnit.MILLISECONDS);
            double maxMs = execTimer.max(TimeUnit.MILLISECONDS);
            execP50 = Math.round(meanMs * 100.0) / 100.0;
            execP95 = Math.round((meanMs + (maxMs - meanMs) * 0.75) * 100.0) / 100.0;
            execP99 = Math.round(maxMs * 100.0) / 100.0;
        }

        // Compute queue wait latency from timer
        double waitP50 = 0.0;
        double waitP95 = 0.0;
        Timer waitTimer = registry.find("queueforge.job.queue_wait_duration").timer();
        if (waitTimer != null && waitTimer.count() > 0) {
            double meanMs = waitTimer.mean(TimeUnit.MILLISECONDS);
            double maxMs = waitTimer.max(TimeUnit.MILLISECONDS);
            waitP50 = Math.round(meanMs * 100.0) / 100.0;
            waitP95 = Math.round(maxMs * 100.0) / 100.0;
        }

        return new SystemMetricsSummaryResponse(
                submitted,
                completed,
                failed,
                retried,
                recovered,
                failuresByCategory,
                execP50,
                execP95,
                execP99,
                waitP50,
                waitP95
        );
    }

    private double sumCounters(String name) {
        MeterRegistry registry = metrics.getMeterRegistry();
        double sum = 0.0;
        for (Counter c : registry.find(name).counters()) {
            sum += c.count();
        }
        return sum;
    }
}
