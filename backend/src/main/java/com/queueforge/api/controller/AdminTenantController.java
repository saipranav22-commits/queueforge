package com.queueforge.api.controller;

import com.queueforge.api.dto.*;
import com.queueforge.service.TenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/tenants")
public class AdminTenantController {

    private final TenantService tenantService;

    public AdminTenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @GetMapping
    public ResponseEntity<List<TenantSummaryResponse>> listTenants() {
        return ResponseEntity.ok(tenantService.listTenants());
    }

    @GetMapping("/scheduler-config")
    public ResponseEntity<FairShareConfigResponse> getSchedulerConfig() {
        return ResponseEntity.ok(tenantService.getSchedulerConfig());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantDetailResponse> getTenant(@PathVariable String id) {
        return ResponseEntity.ok(tenantService.getTenant(id));
    }

    @PostMapping
    public ResponseEntity<TenantDetailResponse> createTenant(@Valid @RequestBody CreateTenantRequest request) {
        TenantDetailResponse response = tenantService.createTenant(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TenantDetailResponse> updateTenant(
            @PathVariable String id,
            @Valid @RequestBody UpdateTenantRequest request) {
        return ResponseEntity.ok(tenantService.updateTenant(id, request));
    }
}
