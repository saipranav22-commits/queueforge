package com.queueforge.core.handler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class JobHandlerRegistry {

    private static final Logger log = LoggerFactory.getLogger(JobHandlerRegistry.class);
    private final Map<String, JobHandler> handlers = new ConcurrentHashMap<>();

    public JobHandlerRegistry(List<JobHandler> handlerBeans) {
        if (handlerBeans != null) {
            for (JobHandler handler : handlerBeans) {
                register(handler);
            }
        }
    }

    public void register(JobHandler handler) {
        String key = handler.getJobType().trim().toUpperCase();
        JobHandler previous = handlers.put(key, handler);
        if (previous != null) {
            log.warn("Overwrote existing handler for jobType='{}' with {}", key, handler.getClass().getSimpleName());
        } else {
            log.info("Registered job handler for type='{}' -> {}", key, handler.getClass().getSimpleName());
        }
    }

    public Optional<JobHandler> getHandler(String jobType) {
        if (jobType == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(handlers.get(jobType.trim().toUpperCase()));
    }

    public Set<String> getRegisteredJobTypes() {
        return Collections.unmodifiableSet(handlers.keySet());
    }
}
