package com.queueforge;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class DatabaseIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Verify Spring Boot context loads, connects to PostgreSQL 16 on 5435, and Flyway migrations V1 and V2 apply tables and columns")
    void contextLoadsAndFlywayTablesCreated() {
        // 1. Verify connection and current database
        String currentDb = jdbcTemplate.queryForObject("SELECT current_database()", String.class);
        assertThat(currentDb).isEqualTo("queueforge");

        // 2. Verify qf_jobs table was created by Flyway
        Integer jobsTableCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qf_jobs'",
            Integer.class
        );
        assertThat(jobsTableCount).isEqualTo(1);

        // 3. Verify qf_job_execution_logs table was created by Flyway
        Integer logsTableCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qf_job_execution_logs'",
            Integer.class
        );
        assertThat(logsTableCount).isEqualTo(1);

        // 4. Verify flyway schema history records V1 and V2 success
        Integer flywayCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM flyway_schema_history WHERE success = true",
            Integer.class
        );
        assertThat(flywayCount).isGreaterThanOrEqualTo(2);

        // 5. Verify V2 added idempotency_fingerprint column
        Integer fingerprintCol = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'qf_jobs' AND column_name = 'idempotency_fingerprint'",
            Integer.class
        );
        assertThat(fingerprintCol).isEqualTo(1);
    }
}
