package com.queueforge.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
@ConfigurationProperties(prefix = "queueforge.security")
public class TenantSecurityProperties {

    /**
     * Whether anonymous requests without X-Tenant-Key or X-Admin-Key are permitted
     * and scoped to the 'default' tenant. Enabled by default for development backward compatibility.
     * In production environments, set to false.
     */
    private boolean allowAnonymousDefault = true;

    /**
     * When enabled, prevents startup if the admin API key equals the known development default.
     */
    private boolean enforceStrongAdminKey = false;

    /**
     * When enabled, allows unauthenticated GET requests to certain admin monitoring endpoints
     * (/api/v1/admin/dlq, /api/v1/admin/outbox/**, /api/v1/admin/tenants/**) for public portfolio demonstration.
     * State-mutating requests (POST, PUT, DELETE, PATCH) remain strictly authenticated.
     */
    private boolean publicDemoMode = false;

    @Autowired(required = false)
    private Environment environment;

    @PostConstruct
    public void init() {
        if (environment != null) {
            boolean isProd = Arrays.stream(environment.getActiveProfiles())
                    .anyMatch(p -> "prod".equalsIgnoreCase(p) || "production".equalsIgnoreCase(p));
            if (isProd) {
                this.allowAnonymousDefault = false;
                this.enforceStrongAdminKey = true;
            }
        }
    }

    public boolean isAllowAnonymousDefault() {
        return allowAnonymousDefault;
    }

    public void setAllowAnonymousDefault(boolean allowAnonymousDefault) {
        this.allowAnonymousDefault = allowAnonymousDefault;
    }

    public boolean isEnforceStrongAdminKey() {
        return enforceStrongAdminKey;
    }

    public void setEnforceStrongAdminKey(boolean enforceStrongAdminKey) {
        this.enforceStrongAdminKey = enforceStrongAdminKey;
    }

    public boolean isPublicDemoMode() {
        return publicDemoMode;
    }

    public void setPublicDemoMode(boolean publicDemoMode) {
        this.publicDemoMode = publicDemoMode;
    }
}
