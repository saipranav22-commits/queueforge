package com.queueforge.api.dto;

import java.util.Map;

public record SystemMetricsSummaryResponse(
        double submittedTotal,
        double completedTotal,
        double failedTotal,
        double retriedTotal,
        double recoveredTotal,
        Map<String, Double> failuresByCategory,
        double executionLatencyP50Ms,
        double executionLatencyP95Ms,
        double executionLatencyP99Ms,
        double queueWaitLatencyP50Ms,
        double queueWaitLatencyP95Ms
) {
}
