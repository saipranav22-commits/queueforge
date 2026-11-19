package com.queueforge.chaoslab.recorder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.queueforge.chaoslab.model.ChaosEvent;
import com.queueforge.chaoslab.model.ChaosEventType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

@Component
public class EventRecorder {

    private static final Logger log = LoggerFactory.getLogger(EventRecorder.class);
    private final List<ChaosEvent> events = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper;

    public EventRecorder() {
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .enable(SerializationFeature.INDENT_OUTPUT)
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public EventRecorder(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void record(ChaosEvent event) {
        events.add(event);
        log.info("[ChaosRecorder] [event={}] [scenario={}] [job={}] [worker={}] - {}",
                event.type(), event.scenarioId(), event.jobId(), event.workerId(), event.details());
    }

    public ChaosEvent record(String scenarioId, UUID jobId, ChaosEventType type, String workerId,
                             UUID claimToken, long claimVersion, int attempt, String details) {
        ChaosEvent event = ChaosEvent.of(scenarioId, jobId, type, workerId, claimToken, claimVersion, attempt, details);
        record(event);
        return event;
    }

    public List<ChaosEvent> getEvents(String scenarioId) {
        return events.stream()
                .filter(e -> Objects.equals(e.scenarioId(), scenarioId))
                .sorted(Comparator.comparing(ChaosEvent::timestamp))
                .collect(Collectors.toList());
    }

    public List<ChaosEvent> getEventsForJob(UUID jobId) {
        return events.stream()
                .filter(e -> Objects.equals(e.jobId(), jobId))
                .sorted(Comparator.comparing(ChaosEvent::timestamp))
                .collect(Collectors.toList());
    }

    public List<ChaosEvent> getAllEvents() {
        return new ArrayList<>(events);
    }

    public void clear() {
        events.clear();
    }

    public String toJson(String scenarioId) {
        try {
            return objectMapper.writeValueAsString(getEvents(scenarioId));
        } catch (Exception e) {
            log.error("Failed to serialize events to JSON:", e);
            return "[]";
        }
    }

    public void saveToJsonFile(String scenarioId, Path outputPath) throws IOException {
        if (outputPath.getParent() != null) {
            Files.createDirectories(outputPath.getParent());
        }
        Files.writeString(outputPath, toJson(scenarioId));
    }
}
