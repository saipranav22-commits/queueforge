package com.queueforge.api.security;

public final class TenantContext {

    private static final ThreadLocal<TenantAuthentication> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(TenantAuthentication auth) {
        CURRENT.set(auth);
    }

    public static TenantAuthentication get() {
        return CURRENT.get();
    }

    public static String getTenantId() {
        TenantAuthentication auth = get();
        return auth != null && auth.tenantId() != null ? auth.tenantId() : "default";
    }

    public static boolean isMasterAdmin() {
        TenantAuthentication auth = get();
        return auth != null && auth.isMasterAdmin();
    }

    public static boolean isLegacyDefault() {
        TenantAuthentication auth = get();
        return auth != null && auth.isLegacyDefault();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
