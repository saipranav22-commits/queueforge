package com.queueforge.metrics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.queueforge.api.dto.CreateJobRequest;
import com.queueforge.core.domain.ClaimedJob;
import com.queueforge.core.domain.FailureCategory;
import com.queueforge.core.domain.JobStatus;
import com.queueforge.persistence.entity.JobEntity;
import com.queueforge.persistence.repository.JobRepository;
import com.queueforge.service.AdminDlqService;
import com.queueforge.service.JobClaimService;
import com.queueforge.service.JobService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "queueforge.worker.enabled=false"
})
@AutoConfigureMockMvc
class QueueForgeMetricsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JobService jobService;

    @Autowired
    private JobClaimService claimService;

    @Autowired
    private AdminDlqService adminDlqService;

    @Autowired
    private QueueForgeMetrics metrics;

    @Autowired
    private MeterRegistry meterRegistry;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM qf_job_execution_logs");
        jdbcTemplate.execute("DELETE FROM qf_jobs");
        metrics.refreshQueueCounts();
    }

    private JobEntity createJob(JobStatus status, String type) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("test", "data");

        JobEntity job = new JobEntity(
                "key-" + UUID.randomUUID(),
                "fp-" + UUID.randomUUID(),
                type,
                payload,
                50,
                3,
                Instant.now().minusSeconds(60)
        );
        job.setStatus(status);
        if (status == JobStatus.DEAD_LETTER) {
            job.setFailureCategory(FailureCategory.TRANSIENT_FAILURE);
            job.setLastErrorMessage("Simulated DLQ error");
        }
        return jobRepository.saveAndFlush(job);
    }

    @Test
    @DisplayName("Custom Gauges reflect actual durable queue counts from PostgreSQL")
    void gauges_reflectDurableQueueCounts() {
        createJob(JobStatus.PENDING, "GENERATE_REPORT");
        createJob(JobStatus.PENDING, "GENERATE_REPORT");
        createJob(JobStatus.RUNNING, "GENERATE_REPORT");
        createJob(JobStatus.COMPLETED, "GENERATE_REPORT");
        createJob(JobStatus.DEAD_LETTER, "GENERATE_REPORT");

        metrics.refreshQueueCounts();

        assertThat(metrics.getPendingCount()).isEqualTo(2);
        assertThat(metrics.getRunningCount()).isEqualTo(1);
        assertThat(metrics.getCompletedCount()).isEqualTo(1);
        assertThat(metrics.getDeadLetterCount()).isEqualTo(1);

        Double gaugePending = meterRegistry.get("queueforge.jobs.pending").gauge().value();
        Double gaugeRunning = meterRegistry.get("queueforge.jobs.running").gauge().value();
        Double gaugeCompleted = meterRegistry.get("queueforge.jobs.completed").gauge().value();
        Double gaugeDeadLetter = meterRegistry.get("queueforge.jobs.dead_letter").gauge().value();

        assertThat(gaugePending).isEqualTo(2.0);
        assertThat(gaugeRunning).isEqualTo(1.0);
        assertThat(gaugeCompleted).isEqualTo(1.0);
        assertThat(gaugeDeadLetter).isEqualTo(1.0);
    }

    @Test
    @DisplayName("Submitted counter increments on job submission")
    void submittedCounter_increments() {
        double before = getCounterCount("queueforge.jobs.submitted.total", "job_type", "GENERATE_REPORT");

        ObjectNode payload = objectMapper.createObjectNode().put("report", "sales");
        CreateJobRequest req = new CreateJobRequest("GENERATE_REPORT", payload, 50, 3, 0);
        jobService.submitJob(req, null);

        double after = getCounterCount("queueforge.jobs.submitted.total", "job_type", "GENERATE_REPORT");
        assertThat(after).isEqualTo(before + 1.0);
    }

    @Test
    @DisplayName("Completed counter and execution timer record successful job run")
    void completedMetrics_recordSuccessAndLatency() {
        double beforeCompleted = getCounterCount("queueforge.jobs.completed.total", "job_type", "GENERATE_REPORT");

        JobEntity job = createJob(JobStatus.PENDING, "GENERATE_REPORT");
        ClaimedJob claimed = claimService.claimJobs(1, 30, "worker-test").getFirst();

        claimService.completeJob(claimed.id(), claimed.claimToken(), "GENERATE_REPORT", 1, 150L, "worker-test");

        double afterCompleted = getCounterCount("queueforge.jobs.completed.total", "job_type", "GENERATE_REPORT");
        assertThat(afterCompleted).isEqualTo(beforeCompleted + 1.0);

        Timer timer = meterRegistry.find("queueforge.job.execution.duration")
                .tag("job_type", "GENERATE_REPORT")
                .tag("status", "COMPLETED")
                .timer();
        assertThat(timer).isNotNull();
        assertThat(timer.count()).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("Failed counter and retried counter record transient failure with backoff")
    void failedAndRetriedCounters_recordFailure() {
        double beforeFailed = getCounterCount("queueforge.jobs.failed.total", "failure_category", "TRANSIENT_FAILURE");
        double beforeRetried = getCounterCount("queueforge.jobs.retried.total", "job_type", "GENERATE_REPORT");

        JobEntity job = createJob(JobStatus.PENDING, "GENERATE_REPORT");
        ClaimedJob claimed = claimService.claimJobs(1, 30, "worker-test").getFirst();

        claimService.failJob(
                claimed.id(),
                claimed.claimToken(),
                "GENERATE_REPORT",
                claimed.attemptCount(),
                claimed.retryCount(),
                claimed.maxRetries(),
                FailureCategory.TRANSIENT_FAILURE,
                "Simulated network timeout",
                null,
                80L,
                "worker-test"
        );

        double afterFailed = getCounterCount("queueforge.jobs.failed.total", "failure_category", "TRANSIENT_FAILURE");
        double afterRetried = getCounterCount("queueforge.jobs.retried.total", "job_type", "GENERATE_REPORT");

        assertThat(afterFailed).isEqualTo(beforeFailed + 1.0);
        assertThat(afterRetried).isEqualTo(beforeRetried + 1.0);
    }

    @Test
    @DisplayName("Recovered counter increments on DLQ replay and lease sweeper")
    void recoveredCounter_incrementsOnReplay() {
        JobEntity job = createJob(JobStatus.DEAD_LETTER, "GENERATE_REPORT");

        double beforeReplay = getCounterCount("queueforge.jobs.recovered.total", "recovery_type", "ADMIN_REPLAY");
        adminDlqService.replayDlqJob(job.getId());
        double afterReplay = getCounterCount("queueforge.jobs.recovered.total", "recovery_type", "ADMIN_REPLAY");

        assertThat(afterReplay).isEqualTo(beforeReplay + 1.0);
    }

    @Test
    @DisplayName("Prometheus endpoint /actuator/prometheus exposes queueforge custom metrics")
    void prometheusScrapeEndpoint_exposesCustomMetrics() throws Exception {
        createJob(JobStatus.PENDING, "GENERATE_REPORT");
        metrics.refreshQueueCounts();

        mockMvc.perform(get("/actuator/prometheus"))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("queueforge_jobs_pending")))
                .andExpect(content().string(containsString("queueforge_jobs_running")))
                .andExpect(content().string(containsString("queueforge_jobs_completed")))
                .andExpect(content().string(containsString("queueforge_jobs_dead_letter")))
                .andExpect(content().string(containsString("queueforge_workers_active")));
    }

    private double getCounterCount(String name, String tagKey, String tagValue) {
        Counter counter = meterRegistry.find(name).tag(tagKey, tagValue).counter();
        return counter != null ? counter.count() : 0.0;
    }
}
