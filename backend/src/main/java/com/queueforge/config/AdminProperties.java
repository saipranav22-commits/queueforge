package com.queueforge.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
@ConfigurationProperties(prefix = "queueforge.admin")
public class AdminProperties {

    private static final Logger log = LoggerFactory.getLogger(AdminProperties.class);
    public static final String DEFAULT_DEV_SECRET = "qf_admin_dev_secret_2026";

    /**
     * Secret API key required for all /api/v1/admin/** endpoints via X-Admin-Key header.
     * Injected via ADMIN_API_KEY environment variable in production.
     */
    private String apiKey = DEFAULT_DEV_SECRET;

    @Autowired(required = false)
    private Environment environment;

    @Autowired(required = false)
    private TenantSecurityProperties tenantSecurityProperties;

    @PostConstruct
    public void validateSecurity() {
        boolean isProduction = isProductionProfile();
        boolean enforce = isProduction || (tenantSecurityProperties != null && tenantSecurityProperties.isEnforceStrongAdminKey());

        if (enforce) {
            if (apiKey == null || apiKey.isBlank() || DEFAULT_DEV_SECRET.equals(apiKey.trim())) {
                throw new IllegalStateException("[CRITICAL SECURITY RELEASE GATE] In production or strict mode, " +
                        "ADMIN_API_KEY must be provided externally as a strong secret. The known development default secret is strictly prohibited.");
            }
            log.info("[SecurityGate] Strong Admin API key validation passed for production environment.");
        } else if (DEFAULT_DEV_SECRET.equals(apiKey)) {
            log.warn("[SECURITY WARNING] Admin API key is using the default development secret! In production environments, set ADMIN_API_KEY to a high-entropy secret.");
        }
    }

    public boolean isProductionProfile() {
        if (environment == null) return false;
        String[] profiles = environment.getActiveProfiles();
        return Arrays.stream(profiles).anyMatch(p -> "prod".equalsIgnoreCase(p) || "production".equalsIgnoreCase(p));
    }

    public boolean isUsingDefaultDevSecret() {
        return DEFAULT_DEV_SECRET.equals(apiKey);
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}
