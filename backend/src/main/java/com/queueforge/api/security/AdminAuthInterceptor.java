package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.dto.ErrorResponse;
import com.queueforge.config.AdminProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.time.Instant;

/**
 * Security interceptor guarding /api/v1/admin/** endpoints.
 * Requires a valid X-Admin-Key HTTP header.
 */
@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthInterceptor.class);
    public static final String ADMIN_KEY_HEADER = "X-Admin-Key";

    private final AdminProperties adminProperties;
    private final ObjectMapper objectMapper;

    public AdminAuthInterceptor(AdminProperties adminProperties, ObjectMapper objectMapper) {
        this.adminProperties = adminProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String apiKey = request.getHeader(ADMIN_KEY_HEADER);

        if (apiKey == null || !apiKey.equals(adminProperties.getApiKey())) {
            log.warn("Unauthorized administrative access attempt from IP={} uri={}",
                    request.getRemoteAddr(), request.getRequestURI());

            sendUnauthorizedResponse(request, response, "Missing or invalid administrative authentication key");
            return false;
        }

        return true;
    }

    private void sendUnauthorizedResponse(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ErrorResponse errorResponse = ErrorResponse.of(
                HttpServletResponse.SC_UNAUTHORIZED,
                "Unauthorized",
                message,
                request.getRequestURI()
        );

        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}
