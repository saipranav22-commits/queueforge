package com.queueforge.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

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

    @PostConstruct
    public void validateSecurity() {
        if (DEFAULT_DEV_SECRET.equals(apiKey)) {
            log.warn("[SECURITY WARNING] Admin API key is using the default development secret! In production environments, set ADMIN_API_KEY to a high-entropy secret.");
        }
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
