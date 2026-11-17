package com.queueforge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "queueforge.scheduler.fairshare")
public class FairShareProperties {

    private boolean enabled = true;
    private int baseQuantum = 1;
    private int maxTenantsPerSweep = 10;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getBaseQuantum() {
        return baseQuantum;
    }

    public void setBaseQuantum(int baseQuantum) {
        this.baseQuantum = baseQuantum;
    }

    public int getMaxTenantsPerSweep() {
        return maxTenantsPerSweep;
    }

    public void setMaxTenantsPerSweep(int maxTenantsPerSweep) {
        this.maxTenantsPerSweep = maxTenantsPerSweep;
    }
}
