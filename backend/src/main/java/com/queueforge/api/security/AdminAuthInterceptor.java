package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.api.controller.AuthController;
import com.queueforge.api.dto.ErrorResponse;
import com.queueforge.config.AdminProperties;
import com.queueforge.config.TenantSecurityProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final TenantSecurityProperties tenantSecurityProperties;

    public AdminAuthInterceptor(AdminProperties adminProperties,
                                AuthSessionService sessionService,
                                ObjectMapper objectMapper) {
        this(adminProperties, sessionService, objectMapper, null);
    }

    @Autowired
    public AdminAuthInterceptor(AdminProperties adminProperties,
                                AuthSessionService sessionService,
                                ObjectMapper objectMapper,
                                @Autowired(required = false) TenantSecurityProperties tenantSecurityProperties) {
        this.adminProperties = adminProperties;
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
        this.tenantSecurityProperties = tenantSecurityProperties;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 1. Check Header Authentication (CLI / Test Automation)
        String apiKey = request.getHeader(ADMIN_KEY_HEADER);
        if (apiKey != null && isValidAdminKey(apiKey)) {
            return true;
        }

        // 1b. Allow tenant credentials for tenant-scoped DLQ operations
        String tenantKey = request.getHeader("X-Tenant-Key");
        if (tenantKey != null && !tenantKey.isBlank() && request.getRequestURI().startsWith("/api/v1/admin/dlq")) {
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

        // 4. Public Demo Mode: Allow read-only GET requests on allowlisted monitoring endpoints
        if (tenantSecurityProperties != null && tenantSecurityProperties.isPublicDemoMode()) {
            if ("GET".equalsIgnoreCase(request.getMethod())) {
                String uri = request.getRequestURI();
                if (uri.startsWith("/api/v1/admin/dlq") ||
                    uri.startsWith("/api/v1/admin/outbox") ||
                    uri.startsWith("/api/v1/admin/tenants")) {
                    log.debug("Permitting anonymous read access under public demo mode: {} {}", request.getMethod(), uri);
                    return true;
                }
            }
        }

        log.warn("Unauthorized administrative access attempt from IP='{}' URI='{}'",
                request.getRemoteAddr(), request.getRequestURI());

        sendUnauthorizedResponse(request, response, "Missing or invalid administrative authentication key");
        return false;
    }

    /**
     * Checks if the incoming request has valid admin credentials (either via X-Admin-Key header or active QF_SESSION cookie).
     * Does not reject the request; used for role-based conditional data masking.
     */
    public boolean isAuthorized(HttpServletRequest request) {
        if (request == null) {
            return false;
        }

        // 1. Header verification
        String apiKey = request.getHeader(ADMIN_KEY_HEADER);
        if (apiKey != null && isValidAdminKey(apiKey)) {
            return true;
        }

        // 2. Cookie session verification
        Optional<String> sessionIdOpt = extractSessionCookie(request);
        if (sessionIdOpt.isPresent()) {
            return sessionService.getSession(sessionIdOpt.get()).isPresent();
        }

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
