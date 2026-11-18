package com.queueforge.service;

import com.queueforge.api.dto.*;
import com.queueforge.api.security.ApiKeyHasher;
import com.queueforge.common.exception.BadRequestException;
import com.queueforge.common.exception.ResourceNotFoundException;
import com.queueforge.core.domain.TenantStatus;
import com.queueforge.persistence.entity.TenantEntity;
import com.queueforge.persistence.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
public class TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);

    private final TenantRepository tenantRepository;
    private final JdbcTemplate jdbcTemplate;

    public TenantService(TenantRepository tenantRepository, JdbcTemplate jdbcTemplate) {
        this.tenantRepository = tenantRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<TenantSummaryResponse> listTenants() {
        return tenantRepository.findAll().stream()
                .map(this::toSummaryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TenantDetailResponse getTenant(String id) {
        TenantEntity entity = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + id));
        return toDetailResponse(entity, null);
    }

    @Transactional
    public TenantDetailResponse createTenant(CreateTenantRequest request) {
        String id = request.id().trim().toLowerCase();
        if (tenantRepository.existsById(id)) {
            throw new BadRequestException("Tenant already exists with id: " + id);
        }

        String rawKey = request.apiKey();
        if (rawKey == null || rawKey.isBlank()) {
            rawKey = ApiKeyHasher.generateSecureKey(id);
        }

        TenantEntity entity = new TenantEntity(
                id,
                request.name().trim(),
                request.effectiveWeight(),
                request.effectiveMaxConcurrency(),
                rawKey
        );

        TenantEntity saved = tenantRepository.save(entity);
        log.info("Created new tenant id='{}' name='{}' weight={} maxConcurrency={} keyPrefix='{}'",
                saved.getId(), saved.getName(), saved.getWeight(), saved.getMaxConcurrency(), saved.getApiKeyPrefix());

        // Return rawKey once upon creation so the tenant operator can copy it
        return toDetailResponse(saved, rawKey);
    }

    @Transactional
    public TenantDetailResponse updateTenant(String id, UpdateTenantRequest request) {
        TenantEntity entity = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + id));

        if (request.name() != null && !request.name().isBlank()) {
            entity.setName(request.name().trim());
        }
        if (request.weight() != null) {
            entity.setWeight(request.weight());
        }
        if (request.maxConcurrency() != null) {
            entity.setMaxConcurrency(request.maxConcurrency());
        }
        if (request.status() != null) {
            entity.setStatus(request.status());
        }

        TenantEntity saved = tenantRepository.save(entity);
        log.info("Updated tenant id='{}' weight={} maxConcurrency={} status={}",
                saved.getId(), saved.getWeight(), saved.getMaxConcurrency(), saved.getStatus());

        return toDetailResponse(saved, null);
    }

    @Transactional
    public TenantDetailResponse rotateApiKey(String id) {
        TenantEntity entity = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + id));

        String newRawKey = ApiKeyHasher.generateSecureKey(id);
        entity.setRawApiKey(newRawKey);
        TenantEntity saved = tenantRepository.save(entity);

        log.info("Rotated API key for tenant id='{}', newPrefix='{}'", saved.getId(), saved.getApiKeyPrefix());
        return toDetailResponse(saved, newRawKey);
    }

    private TenantSummaryResponse toSummaryResponse(TenantEntity entity) {
        long running = countJobs(entity.getId(), "RUNNING");
        long pending = countJobs(entity.getId(), "PENDING");

        return new TenantSummaryResponse(
                entity.getId(),
                entity.getName(),
                entity.getStatus().name(),
                entity.getWeight(),
                entity.getMaxConcurrency(),
                entity.getDeficitCounter(),
                running,
                pending,
                entity.getLastScheduledAt(),
                entity.getCreatedAt()
        );
    }

    private TenantDetailResponse toDetailResponse(TenantEntity entity, String ephemeralRawKey) {
        long running = countJobs(entity.getId(), "RUNNING");
        long pending = countJobs(entity.getId(), "PENDING");

        // Plaintext key is only returned once upon creation or rotation; otherwise return masked prefix
        String apiKeyRepresentation = ephemeralRawKey != null ? ephemeralRawKey : entity.getApiKey();

        return new TenantDetailResponse(
                entity.getId(),
                entity.getName(),
                entity.getStatus().name(),
                entity.getWeight(),
                entity.getMaxConcurrency(),
                entity.getDeficitCounter(),
                apiKeyRepresentation,
                running,
                pending,
                entity.getLastScheduledAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private long countJobs(String tenantId, String status) {
        String sql = "SELECT COUNT(*) FROM qf_jobs WHERE tenant_id = ? AND status = ?";
        Long count = jdbcTemplate.queryForObject(sql, Long.class, tenantId, status);
        return count != null ? count : 0L;
    }
}
