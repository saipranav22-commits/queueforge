package com.queueforge.service;

import com.queueforge.api.dto.WorkerInstanceResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class WorkerFleetAttributionTest {

    /**
     * Replicates the SQL predicate:
     * (locked_by = instance_id OR locked_by LIKE CONCAT(instance_id, ':%'))
     */
    private boolean matchesWorkerLease(String instanceId, String lockedBy) {
        if (lockedBy == null || instanceId == null) {
            return false;
        }
        return lockedBy.equals(instanceId) || lockedBy.startsWith(instanceId + ":");
    }

    private String evaluateWorkerStatus(String reportedStatus, double ageSec) {
        if ("STOPPED".equalsIgnoreCase(reportedStatus)) {
            return "OFFLINE";
        } else if (ageSec <= 15.0) {
            return "ONLINE";
        } else if (ageSec <= 45.0) {
            return "STALE";
        } else {
            return "OFFLINE";
        }
    }

    private boolean matchesPriority(Integer priority, Integer minPriority, Integer maxPriority, int jobPriority) {
        if (minPriority != null && jobPriority < minPriority) {
            return false;
        }
        if (maxPriority != null && jobPriority > maxPriority) {
            return false;
        }
        if (priority != null && minPriority == null && maxPriority == null) {
            return jobPriority == priority;
        }
        return true;
    }

    @Test
    @DisplayName("Worker Attribution: worker-1 matches self and thread sub-ids, never worker-10")
    void testWorkerAttributionSafety() {
        String worker1 = "worker-1";

        // Positive matches
        assertThat(matchesWorkerLease(worker1, "worker-1")).isTrue();
        assertThat(matchesWorkerLease(worker1, "worker-1:qf-worker-1")).isTrue();
        assertThat(matchesWorkerLease(worker1, "worker-1:qf-worker-2")).isTrue();

        // Critical safety checks: worker-1 MUST NOT match worker-10 or worker-11
        assertThat(matchesWorkerLease(worker1, "worker-10")).isFalse();
        assertThat(matchesWorkerLease(worker1, "worker-10:qf-worker-1")).isFalse();
        assertThat(matchesWorkerLease(worker1, "worker-11")).isFalse();
        assertThat(matchesWorkerLease(worker1, "worker-1-alt")).isFalse();
    }

    @Test
    @DisplayName("Status Evaluation: ONLINE (<=15s), STALE (15-45s), OFFLINE (>45s or STOPPED)")
    void testWorkerStatusEvaluation() {
        assertThat(evaluateWorkerStatus("RUNNING", 5.0)).isEqualTo("ONLINE");
        assertThat(evaluateWorkerStatus("RUNNING", 15.0)).isEqualTo("ONLINE");
        assertThat(evaluateWorkerStatus("RUNNING", 15.1)).isEqualTo("STALE");
        assertThat(evaluateWorkerStatus("RUNNING", 45.0)).isEqualTo("STALE");
        assertThat(evaluateWorkerStatus("RUNNING", 45.1)).isEqualTo("OFFLINE");
        assertThat(evaluateWorkerStatus("RUNNING", 120.0)).isEqualTo("OFFLINE");
        assertThat(evaluateWorkerStatus("STOPPED", 2.0)).isEqualTo("OFFLINE");
    }

    @Test
    @DisplayName("Priority Range Filtering: High (80+) correctly matches >=80, not just equality")
    void testPriorityFilteringSemantics() {
        // High (80+) preset
        assertThat(matchesPriority(null, 80, null, 80)).isTrue();
        assertThat(matchesPriority(null, 80, null, 95)).isTrue();
        assertThat(matchesPriority(null, 80, null, 100)).isTrue();
        assertThat(matchesPriority(null, 80, null, 79)).isFalse();
        assertThat(matchesPriority(null, 80, null, 50)).isFalse();
        assertThat(matchesPriority(null, 80, null, 20)).isFalse();

        // Med (50) exact preset
        assertThat(matchesPriority(50, null, null, 50)).isTrue();
        assertThat(matchesPriority(50, null, null, 51)).isFalse();

        // Low (20) exact preset
        assertThat(matchesPriority(20, null, null, 20)).isTrue();
        assertThat(matchesPriority(20, null, null, 19)).isFalse();
    }

    @Test
    @DisplayName("WorkerInstanceResponse DTO: immutability and record mapping")
    void testWorkerInstanceResponseRecord() {
        Instant now = Instant.now();
        WorkerInstanceResponse response = new WorkerInstanceResponse(
                "worker-node-1",
                "FULL_ENGINE",
                "ONLINE",
                4,
                2,
                2,
                150L,
                3L,
                now,
                now.minusSeconds(3600),
                3L
        );

        assertThat(response.instanceId()).isEqualTo("worker-node-1");
        assertThat(response.mode()).isEqualTo("FULL_ENGINE");
        assertThat(response.status()).isEqualTo("ONLINE");
        assertThat(response.concurrency()).isEqualTo(4);
        assertThat(response.activeJobs()).isEqualTo(2);
        assertThat(response.heldLeasesCount()).isEqualTo(2);
        assertThat(response.completedJobsCount()).isEqualTo(150L);
        assertThat(response.failedJobsCount()).isEqualTo(3L);
        assertThat(response.heartbeatAgeSeconds()).isEqualTo(3L);
    }
}
