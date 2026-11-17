package com.queueforge.outbox.scheduler;

import com.queueforge.outbox.service.OutboxDispatcherService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name = "queueforge.outbox.dispatcher.enabled", havingValue = "true")
public class OutboxDispatcherScheduler {

    private static final Logger log = LoggerFactory.getLogger(OutboxDispatcherScheduler.class);

    private final OutboxDispatcherService dispatcherService;
    private final int batchSize;
    private final int leaseDurationSeconds;

    public OutboxDispatcherScheduler(
            OutboxDispatcherService dispatcherService,
            @Value("${queueforge.outbox.dispatcher.batch-size:10}") int batchSize,
            @Value("${queueforge.outbox.dispatcher.lease-duration-seconds:10}") int leaseDurationSeconds) {
        this.dispatcherService = dispatcherService;
        this.batchSize = batchSize;
        this.leaseDurationSeconds = leaseDurationSeconds;
    }

    @Scheduled(fixedDelayString = "${queueforge.outbox.dispatcher.poll-interval-ms:500}")
    public void pollAndDispatch() {
        try {
            int dispatched = dispatcherService.dispatchPendingEvents(batchSize, leaseDurationSeconds);
            if (dispatched > 0) {
                log.info("[OutboxScheduler] Dispatched {} outbox events", dispatched);
            }
        } catch (Exception e) {
            log.error("[OutboxScheduler] Error in outbox dispatch poll loop: {}", e.getMessage(), e);
        }
    }
}
