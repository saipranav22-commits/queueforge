package com.queueforge.config;

import com.queueforge.api.security.AdminAuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;
    private final com.queueforge.api.security.AppModeGuardInterceptor appModeGuardInterceptor;
    private final com.queueforge.api.security.TenantAuthInterceptor tenantAuthInterceptor;

    public WebMvcConfig(AdminAuthInterceptor adminAuthInterceptor,
                        com.queueforge.api.security.AppModeGuardInterceptor appModeGuardInterceptor,
                        com.queueforge.api.security.TenantAuthInterceptor tenantAuthInterceptor) {
        this.adminAuthInterceptor = adminAuthInterceptor;
        this.appModeGuardInterceptor = appModeGuardInterceptor;
        this.tenantAuthInterceptor = tenantAuthInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(appModeGuardInterceptor)
                .addPathPatterns("/api/**");

        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/v1/admin/**");

        registry.addInterceptor(tenantAuthInterceptor)
                .addPathPatterns("/api/v1/jobs/**", "/api/v1/admin/dlq/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                        "http://127.0.0.1:5173",
                        "http://localhost:5173",
                        "http://127.0.0.1:3000",
                        "http://localhost:3000"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Set-Cookie")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
