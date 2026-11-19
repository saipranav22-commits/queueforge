package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.dto.ErrorResponse;
import com.queueforge.config.AppMode;
import com.queueforge.config.QueueForgeProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Set;

/**
 * Enforces role boundaries in distributed clusters.
 * If an instance runs as WORKER_ONLY, state-mutating API requests are rejected with 503.
 */
@Component
public class AppModeGuardInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AppModeGuardInterceptor.class);
    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");

    private final QueueForgeProperties properties;
    private final ObjectMapper objectMapper;

    public AppModeGuardInterceptor(QueueForgeProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (properties.getMode() == AppMode.WORKER_ONLY && MUTATING_METHODS.contains(request.getMethod().toUpperCase())) {
            log.warn("Rejected mutating request to '{}' on WORKER_ONLY node (instanceId='{}')",
                    request.getRequestURI(), properties.getInstanceId());

            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            ErrorResponse error = ErrorResponse.of(
                    HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Service Unavailable",
                    "This QueueForge instance is operating in WORKER_ONLY mode. Ingress writes must be routed to an API_ONLY or COMBINED instance.",
                    request.getRequestURI()
            );

            response.getWriter().write(objectMapper.writeValueAsString(error));
            return false;
        }

        return true;
    }
}
