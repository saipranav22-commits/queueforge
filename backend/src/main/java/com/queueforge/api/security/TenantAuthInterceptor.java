package com.queueforge.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueforge.config.AdminProperties;
import com.queueforge.config.TenantSecurityProperties;
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
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Component
public class TenantAuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(TenantAuthInterceptor.class);

    private final AdminProperties adminProperties;
    private final TenantSecurityProperties tenantSecurityProperties;
    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;

    public TenantAuthInterceptor(AdminProperties adminProperties,
                                 TenantSecurityProperties tenantSecurityProperties,
                                 TenantRepository tenantRepository,
                                 ObjectMapper objectMapper) {
        this.adminProperties = adminProperties;
        this.tenantSecurityProperties = tenantSecurityProperties;
        this.tenantRepository = tenantRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String adminKey = request.getHeader("X-Admin-Key");
        if (adminKey != null && !adminKey.isBlank()) {
            if (ApiKeyHasher.constantTimeEquals(adminKey, adminProperties.getApiKey())) {
                TenantContext.set(TenantAuthentication.masterAdmin());
                return true;
            }
        }

        String tenantKey = request.getHeader("X-Tenant-Key");
        if (tenantKey != null && !tenantKey.isBlank()) {
            String rawKey = tenantKey.trim();

            // Explicit rejection of known hardcoded default key
            if ("qf_tenant_default_key".equalsIgnoreCase(rawKey)) {
                log.warn("[TenantAuth] Rejected hardcoded default tenant key attempt from IP={}", request.getRemoteAddr());
                rejectUnauthorized(response, "Hardcoded default development keys are disabled for security");
                return false;
            }

            // Secure hash-based credential lookup (never compares against plaintext in DB)
            String keyHash = ApiKeyHasher.hash(rawKey);
            Optional<TenantEntity> tenantOpt = tenantRepository.findByApiKeyHash(keyHash);

            if (tenantOpt.isEmpty() || tenantOpt.get().getStatus() != TenantStatus.ACTIVE) {
                log.warn("[TenantAuth] Rejected invalid or inactive tenant key (prefix={}) from IP={}",
                        ApiKeyHasher.extractPrefix(rawKey), request.getRemoteAddr());
                rejectUnauthorized(response, "Invalid or inactive tenant credentials");
                return false;
            }

            TenantEntity tenant = tenantOpt.get();
            TenantContext.set(TenantAuthentication.tenant(tenant.getId()));
            return true;
        }

        // Fallback for backward compatibility (Legacy Default mode)
        if (tenantSecurityProperties.isAllowAnonymousDefault()) {
            TenantContext.set(TenantAuthentication.legacyDefault());
            return true;
        } else {
            log.warn("[TenantAuth] Rejected unauthenticated request in strict security mode from IP={}", request.getRemoteAddr());
            rejectUnauthorized(response, "Authentication required: anonymous default access is disabled in strict mode");
            return false;
        }
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
}
