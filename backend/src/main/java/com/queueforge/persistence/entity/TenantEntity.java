package com.queueforge.persistence.entity;

import com.queueforge.api.security.ApiKeyHasher;
import com.queueforge.core.domain.TenantStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "qf_tenants")
public class TenantEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "name", length = 128, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32, nullable = false)
    private TenantStatus status;

    @Column(name = "weight", nullable = false)
    private int weight;

    @Column(name = "max_concurrency", nullable = false)
    private int maxConcurrency;

    @Column(name = "deficit_counter", precision = 12, scale = 2, nullable = false)
    private BigDecimal deficitCounter;

    /**
     * @deprecated Plaintext API keys are removed in V7. Use apiKeyHash instead.
     */
    @Deprecated
    @Column(name = "api_key", length = 128)
    private String apiKey;

    @Column(name = "api_key_hash", length = 64, nullable = false, unique = true)
    private String apiKeyHash;

    @Column(name = "api_key_prefix", length = 16)
    private String apiKeyPrefix;

    @Column(name = "last_scheduled_at", nullable = false)
    private Instant lastScheduledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public TenantEntity() {
    }

    public TenantEntity(String id, String name, int weight, int maxConcurrency, String rawApiKey) {
        this.id = id;
        this.name = name;
        this.status = TenantStatus.ACTIVE;
        this.weight = weight;
        this.maxConcurrency = maxConcurrency;
        this.deficitCounter = BigDecimal.ZERO;
        setRawApiKey(rawApiKey);
        this.lastScheduledAt = Instant.now();
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void setRawApiKey(String rawApiKey) {
        if (rawApiKey != null && !rawApiKey.isBlank()) {
            this.apiKeyHash = ApiKeyHasher.hash(rawApiKey);
            this.apiKeyPrefix = ApiKeyHasher.extractPrefix(rawApiKey);
            this.apiKey = null; // Plaintext is never retained
        }
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.updatedAt == null) {
            this.updatedAt = this.createdAt;
        }
        if (this.lastScheduledAt == null) {
            this.lastScheduledAt = this.createdAt;
        }
        if (this.status == null) {
            this.status = TenantStatus.ACTIVE;
        }
        if (this.deficitCounter == null) {
            this.deficitCounter = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public TenantStatus getStatus() {
        return status;
    }

    public void setStatus(TenantStatus status) {
        this.status = status;
    }

    public int getWeight() {
        return weight;
    }

    public void setWeight(int weight) {
        this.weight = weight;
    }

    public int getMaxConcurrency() {
        return maxConcurrency;
    }

    public void setMaxConcurrency(int maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
    }

    public BigDecimal getDeficitCounter() {
        return deficitCounter;
    }

    public void setDeficitCounter(BigDecimal deficitCounter) {
        this.deficitCounter = deficitCounter;
    }

    /**
     * Returns the safe prefix only (e.g. "qf_live_...") to prevent credential leakage.
     */
    public String getApiKey() {
        return apiKeyPrefix != null ? apiKeyPrefix + "..." : null;
    }

    public String getApiKeyHash() {
        return apiKeyHash;
    }

    public void setApiKeyHash(String apiKeyHash) {
        this.apiKeyHash = apiKeyHash;
    }

    public String getApiKeyPrefix() {
        return apiKeyPrefix;
    }

    public void setApiKeyPrefix(String apiKeyPrefix) {
        this.apiKeyPrefix = apiKeyPrefix;
    }

    public Instant getLastScheduledAt() {
        return lastScheduledAt;
    }

    public void setLastScheduledAt(Instant lastScheduledAt) {
        this.lastScheduledAt = lastScheduledAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TenantEntity that = (TenantEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
