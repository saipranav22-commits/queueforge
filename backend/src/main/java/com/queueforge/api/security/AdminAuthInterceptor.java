package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.controller.AuthController;
import com.queueforge.api.dto.ErrorResponse;
import com.queueforge.config.AdminProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

/**
 * Security interceptor guarding /api/v1/admin/** endpoints.
 * Supports dual-mode authentication:
 * 1. CLI / Automated: X-Admin-Key header (constant-time token comparison)
 * 2. Browser Admin Console: HttpOnly QF_SESSION cookie with CSRF protection on mutating requests
 */
@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthInterceptor.class);
    public static final String ADMIN_KEY_HEADER = "X-Admin-Key";
    public static final String CSRF_HEADER = "X-CSRF-Token";
    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");

    private final AdminProperties adminProperties;
    private final AuthSessionService sessionService;
    private final ObjectMapper objectMapper;

    public AdminAuthInterceptor(AdminProperties adminProperties,
                                AuthSessionService sessionService,
                                ObjectMapper objectMapper) {
        this.adminProperties = adminProperties;
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 1. Check Header Authentication (CLI / Test Automation)
        String apiKey = request.getHeader(ADMIN_KEY_HEADER);
        if (apiKey != null && isValidAdminKey(apiKey)) {
            return true;
        }

        // 2. Check Browser Session Cookie Authentication
        Optional<String> sessionIdOpt = extractSessionCookie(request);
        if (sessionIdOpt.isPresent()) {
            Optional<SessionInfo> sessionOpt = sessionService.getSession(sessionIdOpt.get());
            if (sessionOpt.isPresent()) {
                SessionInfo session = sessionOpt.get();

                // 3. Enforce CSRF token verification on state-changing requests
                if (MUTATING_METHODS.contains(request.getMethod().toUpperCase())) {
                    String csrfHeader = request.getHeader(CSRF_HEADER);
                    if (csrfHeader == null || !MessageDigest.isEqual(
                            csrfHeader.getBytes(StandardCharsets.UTF_8),
                            session.getCsrfToken().getBytes(StandardCharsets.UTF_8))) {
                        log.warn("CSRF validation failed for admin request from IP='{}' URI='{}'",
                                request.getRemoteAddr(), request.getRequestURI());
                        sendForbiddenResponse(request, response, "Invalid or missing CSRF token");
                        return false;
                    }
                }

                return true;
            }
        }

        log.warn("Unauthorized administrative access attempt from IP='{}' URI='{}'",
                request.getRemoteAddr(), request.getRequestURI());

        sendUnauthorizedResponse(request, response, "Missing or invalid administrative authentication key");
        return false;
    }

    private boolean isValidAdminKey(String providedKey) {
        if (providedKey == null || adminProperties.getApiKey() == null) {
            return false;
        }
        byte[] providedBytes = providedKey.getBytes(StandardCharsets.UTF_8);
        byte[] expectedBytes = adminProperties.getApiKey().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(providedBytes, expectedBytes);
    }

    private Optional<String> extractSessionCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
                .filter(c -> AuthController.SESSION_COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst();
    }

    private void sendUnauthorizedResponse(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        sendErrorResponse(request, response, HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized", message);
    }

    private void sendForbiddenResponse(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        sendErrorResponse(request, response, HttpServletResponse.SC_FORBIDDEN, "Forbidden", message);
    }

    private void sendErrorResponse(HttpServletRequest request, HttpServletResponse response, int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ErrorResponse errorResponse = ErrorResponse.of(
                status,
                error,
                message,
                request.getRequestURI()
        );

        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}
