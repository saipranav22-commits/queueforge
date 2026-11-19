package com.queueforge.config;

import com.queueforge.api.security.AdminAuthInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;
    private final com.queueforge.api.security.AppModeGuardInterceptor appModeGuardInterceptor;
    private final com.queueforge.api.security.TenantAuthInterceptor tenantAuthInterceptor;

    @Value("${queueforge.cors.allowed-origins:http://127.0.0.1:*,http://localhost:*,http://127.0.0.1,http://localhost}")
    private String allowedOrigins;

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
        String[] patterns = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toArray(String[]::new);

        registry.addMapping("/api/**")
                .allowedOriginPatterns(patterns)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Set-Cookie")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
