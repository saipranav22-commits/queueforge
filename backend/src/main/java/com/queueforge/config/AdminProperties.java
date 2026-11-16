package com.queueforge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "queueforge.admin")
public class AdminProperties {

    /**
     * Secret API key required for all /api/v1/admin/** endpoints via X-Admin-Key header.
     * Injected via ADMIN_API_KEY environment variable in production.
     */
    private String apiKey = "qf_admin_dev_secret_2026";

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}
