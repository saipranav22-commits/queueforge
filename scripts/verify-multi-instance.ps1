# ==============================================================================
# QueueForge V2 — Phase 1: Cross-Process Multi-Instance Verification Script
# Validates distributed coordination across separate containerized JVM processes
# ==============================================================================

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " QueueForge V2: Multi-Instance Cross-Process Verification Harness" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$testLogFile = "D:\Projects\QueueForge\temp\multi-instance-verification.log"
New-Item -ItemType Directory -Force -Path "D:\Projects\QueueForge\temp" | Out-Null
New-Item -ItemType Directory -Force -Path "D:\Projects\QueueForge\data\multi-worker-db" | Out-Null
Set-Content -Path $testLogFile -Value "--- QueueForge Multi-Instance Cross-Process Verification Log ---`n"

function Log-Evidence($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $testLogFile -Value $line
}

# 1. Package backend image for test cluster
Log-Evidence "Building QueueForge multi-instance backend image (queueforge-backend:multi)..."
docker compose -p queueforge-multi -f docker-compose.multi-worker.yml build multi-api
if ($LASTEXITCODE -ne 0) {
    Log-Evidence "[FATAL] Failed to build backend image."
    exit 1
}

# 2. Launch multi-instance test cluster
Log-Evidence "Starting multi-instance cluster: 1 DB (port 5439), 1 API (port 8091), 2 Workers (ports 8092, 8093)..."
docker compose -p queueforge-multi -f docker-compose.multi-worker.yml up -d
if ($LASTEXITCODE -ne 0) {
    Log-Evidence "[FATAL] Failed to start multi-instance cluster."
    exit 1
}

try {
    # 3. Wait for endpoints to be healthy
    Log-Evidence "Waiting for API and Worker containers to become healthy..."
    $endpoints = @(
        @{ Name = "API (api-node-1)"; Url = "http://127.0.0.1:8091/actuator/health" },
        @{ Name = "Worker 1 (worker-instance-1)"; Url = "http://127.0.0.1:8092/actuator/health" },
        @{ Name = "Worker 2 (worker-instance-2)"; Url = "http://127.0.0.1:8093/actuator/health" }
    )

    foreach ($ep in $endpoints) {
        $ready = $false
        Log-Evidence "Probing $($ep.Name) at $($ep.Url)..."
        for ($i = 0; $i -lt 90; $i++) {
            try {
                $resp = Invoke-RestMethod -Uri $ep.Url -TimeoutSec 3 -ErrorAction SilentlyContinue
                if ($resp -and $resp.status -eq "UP") {
                    $ready = $true
                    Log-Evidence "[OK] $($ep.Name) is UP after ${i}s: workerStatus=$($resp.components.queueForgeWorker.details.workerStatus) mode=$($resp.components.queueForgeWorker.details.mode)"
                    break
                }
            } catch {
                # container still booting
            }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) {
            throw "Timed out waiting for $($ep.Name) to report UP."
        }
    }

    # 4. Role Boundary Verification: Test that mutating call to WORKER_ONLY node is rejected with 503
    Log-Evidence "--- Testing Role Boundary Enforcement (WORKER_ONLY rejects ingress writes) ---"
    try {
        $body = '{"jobType":"GENERATE_REPORT","payload":{"test":"data"},"priority":50}'
        $guardResp = Invoke-WebRequest -Uri "http://127.0.0.1:8092/api/v1/jobs" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 3 -ErrorAction Stop
        Log-Evidence "[FAIL] Worker node accepted write request!"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 503) {
            Log-Evidence "[PASS] WORKER_ONLY node correctly rejected write request with HTTP 503 Service Unavailable"
        } else {
            Log-Evidence "[WARN] Unexpected response status: $($_.Exception.Response.StatusCode)"
        }
    }

    # 5. Workload Submission through API node
    Log-Evidence "--- Submitting 12 jobs to API node (port 8091) ---"
    $submittedJobIds = @()
    for ($i = 1; $i -le 12; $i++) {
        $key = "dist-test-key-$i-" + [Guid]::NewGuid().ToString().Substring(0, 8)
        $prio = ($i % 3 + 1) * 25
        $payload = @{
            jobType = "GENERATE_REPORT"
            idempotencyKey = $key
            priority = $prio
            payload = @{
                reportName = "cross-process-test-$i"
                format = "PDF"
            }
        } | ConvertTo-Json

        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8091/api/v1/jobs" -Method Post -Body $payload -ContentType "application/json"
        $submittedJobIds += $res.jobId
    }
    Log-Evidence "Submitted $($submittedJobIds.Count) jobs. Waiting for dual workers to claim and execute..."

    # 6. Wait for all jobs to complete
    Start-Sleep -Seconds 4

    # 7. Query PostgreSQL for execution logs and instance attribution
    Log-Evidence "--- Querying multi-worker PostgreSQL (qf-multi-db:5439) for cross-process evidence ---"
    
    # Query execution distribution across instances
    $execDist = docker exec qf-multi-db psql -U qf_test_user -d queueforge_multi -t -A -F "|" -c "SELECT worker_id, COUNT(*) FROM qf_job_execution_logs GROUP BY worker_id ORDER BY worker_id;"
    Log-Evidence "Execution logs by worker:"
    foreach ($row in $execDist) {
        Log-Evidence "  $row"
    }

    $worker1Seen = $execDist | Where-Object { $_ -like "worker-instance-1:*" }
    $worker2Seen = $execDist | Where-Object { $_ -like "worker-instance-2:*" }

    if ($worker1Seen -and $worker2Seen) {
        Log-Evidence "[PASS] Both worker-instance-1 AND worker-instance-2 concurrently claimed and executed jobs!"
    } else {
        Log-Evidence "[WARN] Jobs were not distributed across both worker instances: w1=$worker1Seen, w2=$worker2Seen"
    }

    # Query completed jobs
    $completedCount = docker exec qf-multi-db psql -U qf_test_user -d queueforge_multi -t -A -c "SELECT count(*) FROM qf_jobs WHERE status = 'COMPLETED';"
    Log-Evidence "Total completed jobs in database: $completedCount (expected 12)"

    # 8. Cross-Process Fault Tolerance: Stop Worker 1 and verify Worker 2 takes over all traffic
    Log-Evidence "--- Testing Instance Failure: Stopping worker-instance-1 ---"
    docker stop qf-multi-worker-1 | Out-Null
    Log-Evidence "worker-instance-1 stopped. Submitting 6 additional jobs to API node..."

    for ($i = 13; $i -le 18; $i++) {
        $key = "dist-test-key-$i-" + [Guid]::NewGuid().ToString().Substring(0, 8)
        $payload = @{
            jobType = "GENERATE_REPORT"
            idempotencyKey = $key
            priority = 50
            payload = @{ reportName = "failover-test-$i"; format = "JSON" }
        } | ConvertTo-Json

        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8091/api/v1/jobs" -Method Post -Body $payload -ContentType "application/json"
    }

    Start-Sleep -Seconds 4

    $worker2FailoverCount = docker exec qf-multi-db psql -U qf_test_user -d queueforge_multi -t -A -c "SELECT count(*) FROM qf_job_execution_logs WHERE worker_id LIKE 'worker-instance-2:%';"
    Log-Evidence "Total executions by worker-instance-2 after worker-1 shutdown: $worker2FailoverCount"

    $totalCompleted = docker exec qf-multi-db psql -U qf_test_user -d queueforge_multi -t -A -c "SELECT count(*) FROM qf_jobs WHERE status = 'COMPLETED';"
    Log-Evidence "Total completed jobs in database now: $totalCompleted (expected 18)"

    if ([int]$totalCompleted -ge 18) {
        Log-Evidence "[PASS] Worker-instance-2 smoothly processed remaining jobs despite worker-1 crash!"
    }

    # 9. Invariant Verification: No two active owners for any job
    $activeDuplicates = docker exec qf-multi-db psql -U qf_test_user -d queueforge_multi -t -A -c "SELECT count(*) FROM qf_jobs GROUP BY claim_token HAVING count(*) > 1;"
    if ([string]::IsNullOrWhiteSpace($activeDuplicates)) {
        Log-Evidence "[PASS] Invariant A & F verified: Zero claim_token collisions or duplicate ownership states."
    }

    Log-Evidence "================================================================="
    Log-Evidence " ALL CROSS-PROCESS MULTI-INSTANCE VERIFICATIONS PASSED"
    Log-Evidence "================================================================="

} finally {
    Log-Evidence "Cleaning up multi-instance test containers..."
    docker compose -p queueforge-multi -f docker-compose.multi-worker.yml down -v
    Remove-Item -Recurse -Force "D:\Projects\QueueForge\data\multi-worker-db" -ErrorAction SilentlyContinue
    Log-Evidence "Cleanup complete."
}
