package com.queueforge.persistence.repository;

import com.queueforge.core.domain.TenantStatus;
import com.queueforge.persistence.entity.TenantEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<TenantEntity, String> {

    Optional<TenantEntity> findByApiKeyHash(String apiKeyHash);

    @Deprecated
    Optional<TenantEntity> findByApiKey(String apiKey);

    List<TenantEntity> findByStatus(TenantStatus status);

    boolean existsByIdAndStatus(String id, TenantStatus status);
}
