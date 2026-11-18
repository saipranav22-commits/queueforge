package com.queueforge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "queueforge.security")
public class TenantSecurityProperties {

    /**
     * Whether anonymous requests without X-Tenant-Key or X-Admin-Key are permitted
     * and scoped to the 'default' tenant. Enabled by default for backward compatibility.
     * In production hardened environments, should be set to false.
     */
    private boolean allowAnonymousDefault = true;

    /**
     * When enabled, prevents startup if the admin API key equals the known development default.
     */
    private boolean enforceStrongAdminKey = false;

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
}
