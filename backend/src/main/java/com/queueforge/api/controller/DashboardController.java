package com.queueforge.api.controller;

import com.queueforge.api.dto.DashboardStatsResponse;
import com.queueforge.api.dto.SystemHealthResponse;
import com.queueforge.api.dto.SystemMetricsSummaryResponse;
import com.queueforge.api.dto.WorkerInstanceResponse;
import com.queueforge.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    /**
     * Retrieves aggregated high-level statistics for the dashboard overview.
     */
    @GetMapping("/dashboard/stats")
    public ResponseEntity<DashboardStatsResponse> getDashboardStats() {
        DashboardStatsResponse stats = dashboardService.getDashboardStats();
        return ResponseEntity.ok(stats);
    }

    /**
     * Retrieves system health status including worker pool capacity and database connection.
     */
    @GetMapping("/system/health")
    public ResponseEntity<SystemHealthResponse> getSystemHealth() {
        SystemHealthResponse health = dashboardService.getSystemHealth();
        return ResponseEntity.ok(health);
    }

    /**
     * Retrieves aggregated throughput and latency metrics for visualization.
     */
    @GetMapping("/system/metrics-summary")
    public ResponseEntity<SystemMetricsSummaryResponse> getMetricsSummary() {
        SystemMetricsSummaryResponse summary = dashboardService.getMetricsSummary();
        return ResponseEntity.ok(summary);
    }

    /**
     * Retrieves real-time distributed worker fleet heartbeats and lease attribution.
     */
    @GetMapping("/system/workers")
    public ResponseEntity<List<WorkerInstanceResponse>> getWorkerFleet() {
        List<WorkerInstanceResponse> fleet = dashboardService.getWorkerFleet();
        return ResponseEntity.ok(fleet);
    }
}
