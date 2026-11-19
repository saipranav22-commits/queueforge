package com.queueforge.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminSecurityConfigTest {

    @Test
    @DisplayName("Development mode: permits default dev secret with warning")
    void devMode_permitsDefaultSecret() {
        AdminProperties props = new AdminProperties();
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        ReflectionTestUtils.setField(props, "environment", env);
        props.setApiKey(AdminProperties.DEFAULT_DEV_SECRET);

        // Does not throw in dev mode
        props.validateSecurity();
        assertThat(props.isUsingDefaultDevSecret()).isTrue();
    }

    @Test
    @DisplayName("Production mode: rejects default dev secret and throws IllegalStateException")
    void prodMode_rejectsDefaultDevSecret() {
        AdminProperties props = new AdminProperties();
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        ReflectionTestUtils.setField(props, "environment", env);
        props.setApiKey(AdminProperties.DEFAULT_DEV_SECRET);

        assertThatThrownBy(props::validateSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[CRITICAL SECURITY RELEASE GATE]");
    }

    @Test
    @DisplayName("Production mode: rejects blank or null admin API key")
    void prodMode_rejectsBlankKey() {
        AdminProperties props = new AdminProperties();
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("production");
        ReflectionTestUtils.setField(props, "environment", env);
        props.setApiKey("   ");

        assertThatThrownBy(props::validateSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[CRITICAL SECURITY RELEASE GATE]");
    }

    @Test
    @DisplayName("Production mode: accepts strong external secret")
    void prodMode_acceptsStrongKey() {
        AdminProperties props = new AdminProperties();
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        ReflectionTestUtils.setField(props, "environment", env);
        props.setApiKey("qf_super_strong_production_entropy_key_998877");

        props.validateSecurity();
        assertThat(props.isUsingDefaultDevSecret()).isFalse();
        assertThat(props.getApiKey()).isEqualTo("qf_super_strong_production_entropy_key_998877");
    }

    @Test
    @DisplayName("Strict enforcement mode via TenantSecurityProperties: rejects default secret")
    void strictEnforceMode_rejectsDefaultSecret() {
        AdminProperties props = new AdminProperties();
        TenantSecurityProperties secProps = new TenantSecurityProperties();
        secProps.setEnforceStrongAdminKey(true);
        ReflectionTestUtils.setField(props, "tenantSecurityProperties", secProps);
        props.setApiKey(AdminProperties.DEFAULT_DEV_SECRET);

        assertThatThrownBy(props::validateSecurity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[CRITICAL SECURITY RELEASE GATE]");
    }
}
