package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.config.AdminProperties;
import com.queueforge.core.domain.TenantStatus;
import com.queueforge.persistence.entity.TenantEntity;
import com.queueforge.persistence.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Component
public class TenantAuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(TenantAuthInterceptor.class);

    private final AdminProperties adminProperties;
    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;

    public TenantAuthInterceptor(AdminProperties adminProperties,
                                 TenantRepository tenantRepository,
                                 ObjectMapper objectMapper) {
        this.adminProperties = adminProperties;
        this.tenantRepository = tenantRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String adminKey = request.getHeader("X-Admin-Key");
        if (adminKey != null && !adminKey.isBlank()) {
            if (constantTimeEquals(adminKey, adminProperties.getApiKey())) {
                TenantContext.set(TenantAuthentication.masterAdmin());
                return true;
            }
        }

        String tenantKey = request.getHeader("X-Tenant-Key");
        if (tenantKey != null && !tenantKey.isBlank()) {
            Optional<TenantEntity> tenantOpt = tenantRepository.findByApiKey(tenantKey.trim());
            if (tenantOpt.isEmpty() || tenantOpt.get().getStatus() != TenantStatus.ACTIVE) {
                log.warn("[TenantAuth] Rejected invalid or inactive tenant key from IP={}", request.getRemoteAddr());
                rejectUnauthorized(response, "Invalid or inactive tenant credentials");
                return false;
            }
            TenantEntity tenant = tenantOpt.get();
            TenantContext.set(TenantAuthentication.tenant(tenant.getId()));
            return true;
        }

        // Fallback for backward compatibility (Legacy Default mode)
        TenantContext.set(TenantAuthentication.legacyDefault());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TenantContext.clear();
    }

    private void rejectUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = Map.of(
                "timestamp", Instant.now().toString(),
                "status", HttpStatus.UNAUTHORIZED.value(),
                "error", "Unauthorized",
                "message", message
        );
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(a.getBytes(), b.getBytes());
    }
}
