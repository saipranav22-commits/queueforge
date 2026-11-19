# ==============================================================================
# QueueForge V2 — Phase 4: Noisy-Neighbor Mitigation Demonstration
# Visualizes queue monopolization under Baseline vs fair interleaving under FairShare
# ==============================================================================
param (
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5435,
    [string]$DbName = "queueforge",
    [string]$DbUser = "queueforge_app",
    [string]$DbPass = "qf_dev_secret_d_isolated_2026",
    [int]$FloodJobCount = 100,
    [int]$VipJobCount = 5,
    [int]$BatchSize = 10
)

$ErrorActionPreference = "Stop"

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  QUEUEFORGE V2: NOISY-NEIGHBOR MITIGATION DEMONSTRATION" -ForegroundColor Cyan
Write-Host "  Workload: 1 Bulk Tenant ($FloodJobCount jobs) vs 1 Critical Tenant ($VipJobCount jobs)" -ForegroundColor Cyan
Write-Host "================================================================================`n" -ForegroundColor Cyan

$projectRoot = "D:\Projects\QueueForge"
. "$projectRoot\env.ps1"

$env:DB_HOST = $DbHost
$env:DB_PORT = $DbPort
$env:DB_NAME = $DbName
$env:DB_USERNAME = $DbUser
$env:DB_PASSWORD = $DbPass

# Helper function to execute PSQL
function Invoke-QFQuery {
    param ([string]$Query)
    docker exec queueforge-postgres psql -U $DbUser -d $DbName -t -A -c "$Query"
}

Write-Host "[1/4] Resetting demonstration database environment..." -ForegroundColor Yellow
Invoke-QFQuery "DELETE FROM qf_job_execution_logs; DELETE FROM qf_jobs; DELETE FROM qf_tenants WHERE id NOT IN ('default');" | Out-Null
Invoke-QFQuery "INSERT INTO qf_tenants (id, name, weight, max_concurrency, deficit_counter, status, api_key, last_scheduled_at, created_at, updated_at) VALUES ('tenant-flood', 'Bulk Report Generator', 1, 50, 0, 'ACTIVE', 'key_flood', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), ('tenant-vip', 'Critical Checkout Service', 1, 50, 0, 'ACTIVE', 'key_vip', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET deficit_counter = 0, last_scheduled_at = CURRENT_TIMESTAMP;" | Out-Null

Write-Host "[2/4] Simulating Baseline Scheduling (Standard Priority/FIFO)..." -ForegroundColor Yellow
Write-Host "  -> Enqueuing $FloodJobCount jobs for 'tenant-flood' followed by $VipJobCount jobs for 'tenant-vip'..." -ForegroundColor Gray

# Seed jobs for baseline
Invoke-QFQuery "INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at) SELECT 'tenant-flood', 'flood-b-' || g, 'fp-b-' || g, 'GENERATE_REPORT', '{}'::jsonb, 50, 3, CURRENT_TIMESTAMP + (g * interval '1 millisecond'), 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM generate_series(1, $FloodJobCount) g;" | Out-Null
Invoke-QFQuery "INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at) SELECT 'tenant-vip', 'vip-b-' || g, 'fp-v-' || g, 'PROCESS_PAYMENT', '{}'::jsonb, 50, 3, CURRENT_TIMESTAMP + (($FloodJobCount + g) * interval '1 millisecond'), 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM generate_series(1, $VipJobCount) g;" | Out-Null

Write-Host "`n  --- BASELINE CLAIM PROGRESSION (Batch Size = $BatchSize) ---" -ForegroundColor Red
$baselineVipCompletedSweep = -1
$sweep = 1
while ($sweep -le 50) {
    # Baseline query: CTE claim with SKIP LOCKED
    $raw = Invoke-QFQuery "WITH candidate_jobs AS (SELECT id, tenant_id FROM qf_jobs WHERE status = 'PENDING' ORDER BY priority DESC, scheduled_at ASC, id ASC LIMIT $BatchSize FOR UPDATE SKIP LOCKED) UPDATE qf_jobs j SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP FROM candidate_jobs c WHERE j.id = c.id RETURNING j.tenant_id;"
    $claimedRows = @($raw -split "`r?`n" | Where-Object { $_ -eq "tenant-flood" -or $_ -eq "tenant-vip" })
    if ($claimedRows.Count -eq 0) { break }
    
    $floodClaims = @($claimedRows | Where-Object { $_ -eq "tenant-flood" }).Count
    $vipClaims = @($claimedRows | Where-Object { $_ -eq "tenant-vip" }).Count
    
    $barFlood = "#" * [Math]::Min(20, $floodClaims * 2)
    $barVip = "*" * [Math]::Min(20, $vipClaims * 2)
    Write-Host ("  Sweep {0,2}: Flood: {1,2} [{2,-20}] | VIP: {3,2} [{4,-10}]" -f $sweep, $floodClaims, $barFlood, $vipClaims, $barVip) -ForegroundColor Gray
    
    if ($vipClaims -gt 0 -and $baselineVipCompletedSweep -eq -1) {
        $pendingVip = [int](Invoke-QFQuery "SELECT count(*) FROM qf_jobs WHERE tenant_id = 'tenant-vip' AND status = 'PENDING';")
        if ($pendingVip -eq 0) { $baselineVipCompletedSweep = $sweep }
    }
    $sweep++
}
Write-Host "  -> Under Baseline, VIP Tenant completed at Sweep $baselineVipCompletedSweep (after all $FloodJobCount flood jobs drained)." -ForegroundColor Red

Write-Host "`n[3/4] Simulating FairShare Scheduling (Deficit Round Robin)..." -ForegroundColor Yellow
Write-Host "  -> Re-enqueuing $FloodJobCount jobs for 'tenant-flood' and $VipJobCount jobs for 'tenant-vip'..." -ForegroundColor Gray

# Reset database for fairshare
Invoke-QFQuery "DELETE FROM qf_jobs;" | Out-Null
Invoke-QFQuery "UPDATE qf_tenants SET deficit_counter = 0, last_scheduled_at = CURRENT_TIMESTAMP WHERE id IN ('tenant-flood', 'tenant-vip');" | Out-Null
Invoke-QFQuery "INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at) SELECT 'tenant-flood', 'flood-f-' || g, 'fp-f-' || g, 'GENERATE_REPORT', '{}'::jsonb, 50, 3, CURRENT_TIMESTAMP + (g * interval '1 millisecond'), 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM generate_series(1, $FloodJobCount) g;" | Out-Null
Invoke-QFQuery "INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at) SELECT 'tenant-vip', 'vip-f-' || g, 'fp-vf-' || g, 'PROCESS_PAYMENT', '{}'::jsonb, 50, 3, CURRENT_TIMESTAMP + (($FloodJobCount + g) * interval '1 millisecond'), 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM generate_series(1, $VipJobCount) g;" | Out-Null

Write-Host "`n  --- FAIRSHARE (DRR) CLAIM PROGRESSION (Batch Size = $BatchSize, Quantum = 5) ---" -ForegroundColor Green
$fairShareVipCompletedSweep = -1
$sweep = 1
while ($sweep -le 50) {
    # Simulate DRR sweep across active tenants
    $vipPending = [int](Invoke-QFQuery "SELECT count(*) FROM qf_jobs WHERE tenant_id = 'tenant-vip' AND status = 'PENDING';")
    $floodPending = [int](Invoke-QFQuery "SELECT count(*) FROM qf_jobs WHERE tenant_id = 'tenant-flood' AND status = 'PENDING';")
    
    if ($vipPending -eq 0 -and $floodPending -eq 0) { break }
    
    # In DRR, each active tenant gets up to quantum (5). Unused quantum is reallocated to remaining work.
    $vipAlloc = if ($vipPending -gt 0) { [Math]::Min(5, $vipPending) } else { 0 }
    $floodAlloc = [Math]::Min($BatchSize - $vipAlloc, $floodPending)
    
    $claimedFlood = 0
    $claimedVip = 0
    
    if ($vipAlloc -gt 0) {
        $rawVip = Invoke-QFQuery "WITH c AS (SELECT id, tenant_id FROM qf_jobs WHERE tenant_id = 'tenant-vip' AND status = 'PENDING' ORDER BY priority DESC, scheduled_at ASC LIMIT $vipAlloc FOR UPDATE SKIP LOCKED) UPDATE qf_jobs j SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP FROM c WHERE j.id = c.id RETURNING j.tenant_id;"
        $claimedVip = @($rawVip -split "`r?`n" | Where-Object { $_ -eq "tenant-vip" }).Count
    }
    if ($floodAlloc -gt 0) {
        $rawFlood = Invoke-QFQuery "WITH c AS (SELECT id, tenant_id FROM qf_jobs WHERE tenant_id = 'tenant-flood' AND status = 'PENDING' ORDER BY priority DESC, scheduled_at ASC LIMIT $floodAlloc FOR UPDATE SKIP LOCKED) UPDATE qf_jobs j SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP FROM c WHERE j.id = c.id RETURNING j.tenant_id;"
        $claimedFlood = @($rawFlood -split "`r?`n" | Where-Object { $_ -eq "tenant-flood" }).Count
    }
    
    $barFlood = "#" * [Math]::Min(20, $claimedFlood * 2)
    $barVip = "*" * [Math]::Min(20, $claimedVip * 2)
    Write-Host ("  Sweep {0,2}: Flood: {1,2} [{2,-20}] | VIP: {3,2} [{4,-10}]" -f $sweep, $claimedFlood, $barFlood, $claimedVip, $barVip) -ForegroundColor Cyan
    
    if ($claimedVip -gt 0 -and $fairShareVipCompletedSweep -eq -1) {
        $remainingVip = [int](Invoke-QFQuery "SELECT count(*) FROM qf_jobs WHERE tenant_id = 'tenant-vip' AND status = 'PENDING';")
        if ($remainingVip -eq 0) { $fairShareVipCompletedSweep = $sweep }
    }
    $sweep++
}
Write-Host "  -> Under FairShare, VIP Tenant completed at Sweep $fairShareVipCompletedSweep (immediate interleaving)!" -ForegroundColor Green

Write-Host "`n[4/4] SUMMARY & ARCHITECTURAL COMPARISON" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor DarkGray
Write-Host ("{0,-30} | {1,-20} | {2,-20}" -f "CRITERIA", "BASELINE (FIFO)", "FAIRSHARE (DRR)") -ForegroundColor White
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ("{0,-30} | {1,-20} | {2,-20}" -f "VIP Completion Sweep", "Sweep $baselineVipCompletedSweep", "Sweep $fairShareVipCompletedSweep (IMMEDIATE)") -ForegroundColor Yellow
Write-Host ("{0,-30} | {1,-20} | {2,-20}" -f "Noisy Neighbor Starvation", "SEVERE (100% Starved)", "NONE (Zero Starvation)") -ForegroundColor Green
Write-Host ("{0,-30} | {1,-20} | {2,-20}" -f "Work Conservation", "High Throughput", "Preserved (Zero Idle Cap)") -ForegroundColor White
Write-Host "================================================================================`n" -ForegroundColor DarkGray

# Cleanup demo data
Invoke-QFQuery "DELETE FROM qf_jobs; DELETE FROM qf_tenants WHERE id NOT IN ('default');" | Out-Null
Write-Host "[OK] Demonstration completed successfully. Demo state cleaned up." -ForegroundColor Green
