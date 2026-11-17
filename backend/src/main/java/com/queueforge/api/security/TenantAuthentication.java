package com.queueforge.api.security;

public record TenantAuthentication(
        String tenantId,
        boolean isMasterAdmin,
        boolean isLegacyDefault
) {
    public static TenantAuthentication masterAdmin() {
        return new TenantAuthentication("default", true, false);
    }

    public static TenantAuthentication tenant(String tenantId) {
        return new TenantAuthentication(tenantId, false, false);
    }

    public static TenantAuthentication legacyDefault() {
        return new TenantAuthentication("default", false, true);
    }
}
