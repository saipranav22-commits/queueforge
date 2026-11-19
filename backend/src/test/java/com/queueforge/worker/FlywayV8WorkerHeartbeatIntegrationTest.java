package com.queueforge.worker;

import com.queueforge.api.dto.WorkerInstanceResponse;
import com.queueforge.service.DashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Validates Flyway V8 schema application, qf_worker_heartbeats table structure,
 * concurrent heartbeat registration, status transitions, and worker fleet discovery.
 */
@SpringBootTest(properties = {
        "queueforge.worker.enabled=false"
})
@AutoConfigureMockMvc
class FlywayV8WorkerHeartbeatIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private MockMvc mockMvc;

    @BeforeEach
    void cleanHeartbeats() {
        jdbcTemplate.execute("DELETE FROM qf_worker_heartbeats");
    }

    @Test
    @DisplayName("V8 Schema: verifies qf_worker_heartbeats table exists with all required columns")
    void testV8SchemaStructure() {
        Integer tableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qf_worker_heartbeats'",
                Integer.class
        );
        assertThat(tableCount).isEqualTo(1);

        List<String> columns = jdbcTemplate.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'qf_worker_heartbeats'",
                (rs, rowNum) -> rs.getString("column_name")
        );

        assertThat(columns).contains(
                "instance_id",
                "mode",
                "status",
                "concurrency",
                "active_jobs",
                "last_heartbeat",
                "started_at"
        );
    }

    @Test
    @DisplayName("V8 Index: verifies idx_qf_worker_heartbeats_status index exists on (status, last_heartbeat)")
    void testV8IndexExists() {
        Integer indexCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'qf_worker_heartbeats' AND indexname = 'idx_qf_worker_heartbeats_status'",
                Integer.class
        );
        assertThat(indexCount).isEqualTo(1);
    }

    @Test
    @DisplayName("V8 Migration History: verifies Flyway recorded migrations V1 through V8 as successfully applied")
    void testFlywayHistoryContainsV8() {
        Integer v8Success = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '8' AND success = true",
                Integer.class
        );
        assertThat(v8Success).isEqualTo(1);

        Integer totalApplied = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = true",
                Integer.class
        );
        assertThat(totalApplied).isGreaterThanOrEqualTo(8);
    }

    @Test
    @DisplayName("Heartbeat Registration: UPSERT safely registers worker instance and updates heartbeats")
    void testWorkerHeartbeatRegistrationAndUpsert() {
        String upsertSql = """
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (instance_id) DO UPDATE SET
                status = EXCLUDED.status,
                active_jobs = EXCLUDED.active_jobs,
                last_heartbeat = CURRENT_TIMESTAMP
        """;

        // Initial registration
        int rows1 = jdbcTemplate.update(upsertSql, "worker-node-alpha", "WORKER_ONLY", "RUNNING", 4, 1);
        assertThat(rows1).isEqualTo(1);

        // Update heartbeat
        int rows2 = jdbcTemplate.update(upsertSql, "worker-node-alpha", "WORKER_ONLY", "RUNNING", 4, 3);
        assertThat(rows2).isEqualTo(1);

        // Verify state in database
        Integer activeJobs = jdbcTemplate.queryForObject(
                "SELECT active_jobs FROM qf_worker_heartbeats WHERE instance_id = 'worker-node-alpha'",
                Integer.class
        );
        assertThat(activeJobs).isEqualTo(3);
    }

    @Test
    @DisplayName("Concurrency: concurrent worker heartbeat registrations execute safely without deadlocks")
    void testConcurrentHeartbeatRegistrations() throws Exception {
        int workerCount = 5;
        int iterationsPerWorker = 10;
        ExecutorService executor = Executors.newFixedThreadPool(workerCount);
        CountDownLatch latch = new CountDownLatch(1);
        List<Future<Void>> futures = new ArrayList<>();

        String upsertSql = """
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (instance_id) DO UPDATE SET
                status = EXCLUDED.status,
                active_jobs = EXCLUDED.active_jobs,
                last_heartbeat = CURRENT_TIMESTAMP
        """;

        for (int w = 0; w < workerCount; w++) {
            final String workerId = "worker-concurrent-node-" + w;
            futures.add(executor.submit(() -> {
                latch.await();
                for (int i = 0; i < iterationsPerWorker; i++) {
                    jdbcTemplate.update(upsertSql, workerId, "WORKER_ONLY", "RUNNING", 2, i % 3);
                }
                return null;
            }));
        }

        latch.countDown(); // Release all threads concurrently
        for (Future<Void> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        Integer registeredCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM qf_worker_heartbeats",
                Integer.class
        );
        assertThat(registeredCount).isEqualTo(workerCount);
    }

    @Test
    @DisplayName("Status Transitions: verifies ONLINE (<=15s), STALE (15-45s), and OFFLINE (>45s or STOPPED)")
    void testWorkerStatusTransitions() {
        // 1. Fresh worker (ONLINE)
        jdbcTemplate.update("""
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES ('worker-live', 'WORKER_ONLY', 'RUNNING', 2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """);

        // 2. Worker with heartbeat 25s ago (STALE)
        jdbcTemplate.update("""
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES ('worker-stale', 'WORKER_ONLY', 'RUNNING', 2, 0, CURRENT_TIMESTAMP - INTERVAL '25 seconds', CURRENT_TIMESTAMP - INTERVAL '1 hour')
        """);

        // 3. Worker with heartbeat 60s ago (OFFLINE)
        jdbcTemplate.update("""
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES ('worker-dead', 'WORKER_ONLY', 'RUNNING', 2, 0, CURRENT_TIMESTAMP - INTERVAL '60 seconds', CURRENT_TIMESTAMP - INTERVAL '1 hour')
        """);

        // 4. Worker explicitly stopped (OFFLINE regardless of timestamp)
        jdbcTemplate.update("""
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES ('worker-stopped', 'WORKER_ONLY', 'STOPPED', 2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """);

        List<WorkerInstanceResponse> fleet = dashboardService.getWorkerFleet();
        assertThat(fleet).hasSize(4);

        WorkerInstanceResponse live = fleet.stream().filter(w -> w.instanceId().equals("worker-live")).findFirst().orElseThrow();
        assertThat(live.status()).isEqualTo("ONLINE");

        WorkerInstanceResponse stale = fleet.stream().filter(w -> w.instanceId().equals("worker-stale")).findFirst().orElseThrow();
        assertThat(stale.status()).isEqualTo("STALE");

        WorkerInstanceResponse dead = fleet.stream().filter(w -> w.instanceId().equals("worker-dead")).findFirst().orElseThrow();
        assertThat(dead.status()).isEqualTo("OFFLINE");

        WorkerInstanceResponse stopped = fleet.stream().filter(w -> w.instanceId().equals("worker-stopped")).findFirst().orElseThrow();
        assertThat(stopped.status()).isEqualTo("OFFLINE");
    }

    @Test
    @DisplayName("API Discovery: GET /api/v1/system/workers returns JSON fleet array")
    void testWorkerFleetApiEndpoint() throws Exception {
        jdbcTemplate.update("""
            INSERT INTO qf_worker_heartbeats (instance_id, mode, status, concurrency, active_jobs, last_heartbeat, started_at)
            VALUES ('worker-api-test', 'WORKER_ONLY', 'RUNNING', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """);

        mockMvc.perform(get("/api/v1/system/workers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].instanceId").value("worker-api-test"))
                .andExpect(jsonPath("$[0].mode").value("WORKER_ONLY"))
                .andExpect(jsonPath("$[0].status").value("ONLINE"))
                .andExpect(jsonPath("$[0].concurrency").value(4));
    }
}
