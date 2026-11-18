# ==============================================================================
# QueueForge V2 — Phase 4B: Cross-Process Concurrency Quota Verification
# Proves cluster-wide quota enforcement across multiple independent JVM processes
# ==============================================================================
param (
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5435,
    [string]$DbName = "queueforge_quota_test",
    [string]$DbUser = "queueforge_app",
    [string]$DbPass = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  QUEUEFORGE V2: REAL CROSS-PROCESS CONCURRENCY QUOTA VERIFICATION" -ForegroundColor Cyan
Write-Host "  Independent Worker JVMs (PID 1 & PID 2) against Isolated DB ($DbName)" -ForegroundColor Cyan
Write-Host "================================================================================`n" -ForegroundColor Cyan

$projectRoot = "D:\Projects\QueueForge"
. "$projectRoot\env.ps1"

if (-not $DbPass -and $env:DB_PASSWORD) {
    $DbPass = $env:DB_PASSWORD
}

$logDir = "$projectRoot\temp"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$evidenceFile = "$logDir\cross-process-quota-evidence.log"
Set-Content -Path $evidenceFile -Value "--- Cross-Process Concurrency Quota Verification Log ---`n"

function Log-Evidence($msg) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $evidenceFile -Value $line
}

function Invoke-QuotaDbQuery {
    param ([string]$Query)
    docker exec queueforge-postgres psql -U $DbUser -d $DbName -t -A -c "$Query"
}

# 1. Reset / Initialize Isolated Database
Log-Evidence "[1/6] Initializing isolated database '$DbName'..."
docker exec queueforge-postgres psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $DbName;" | Out-Null
docker exec queueforge-postgres psql -U $DbUser -d postgres -c "CREATE DATABASE $DbName;" | Out-Null

$jarPath = "$projectRoot\backend\target\queueforge-backend-0.1.0-SNAPSHOT.jar"
$javaExe = "$env:JAVA_HOME\bin\java.exe"

# 2. Launch Worker JVM Process 1
Log-Evidence "[2/6] Launching Worker JVM Process 1 (instance=worker-jvm-1, port=8095)..."
$p1Log = "$logDir\worker-jvm-1.log"
$p1Args = @(
    "-Dserver.port=8095",
    "-Dqueueforge.mode=WORKER_ONLY",
    "-Dqueueforge.instance-id=worker-jvm-1",
    "-Dspring.datasource.url=jdbc:postgresql://$DbHost`:$DbPort/$DbName",
    "-Dspring.datasource.username=$DbUser",
    "-Dspring.datasource.password=$DbPass",
    "-Dqueueforge.worker.concurrency=3",
    "-Dqueueforge.worker.poll-interval-ms=100",
    "-Dqueueforge.worker.lease-duration-seconds=10",
    "-Dqueueforge.worker.heartbeat-interval-seconds=3",
    "-Dqueueforge.worker.recovery-poll-interval-ms=2000",
    "-Dqueueforge.worker.chaos-payloads-enabled=true",
    "-XX:+UseSerialGC",
    "-Xmx160m",
    "-Xms32m",
    "-Xss256k",
    "-XX:TieredStopAtLevel=1",
    "-jar", $jarPath
)
$proc1 = Start-Process -FilePath $javaExe -ArgumentList $p1Args -PassThru -RedirectStandardOutput $p1Log -RedirectStandardError "$logDir\worker-jvm-1-err.log"
Log-Evidence "  -> Worker 1 started with PID=$($proc1.Id)"

# 3. Wait for Worker 1 to run Flyway and report healthy
Log-Evidence "Waiting for Worker 1 (PID=$($proc1.Id)) to complete migrations and report UP..."
$p1Ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8095/actuator/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp -and $resp.status -eq "UP") {
            $p1Ready = $true
            Log-Evidence "[OK] Worker 1 (PID=$($proc1.Id)) is UP and healthy on port 8095 after ${i}s."
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $p1Ready) {
    if ($proc1 -and -not $proc1.HasExited) { Stop-Process -Id $proc1.Id -Force }
    throw "Worker 1 failed to become healthy within 60 seconds."
}

# 4. Launch Worker JVM Process 2
Log-Evidence "[3/6] Launching Worker JVM Process 2 (instance=worker-jvm-2, port=8096)..."
$p2Log = "$logDir\worker-jvm-2.log"
$p2Args = @(
    "-Dserver.port=8096",
    "-Dqueueforge.mode=WORKER_ONLY",
    "-Dqueueforge.instance-id=worker-jvm-2",
    "-Dspring.datasource.url=jdbc:postgresql://$DbHost`:$DbPort/$DbName",
    "-Dspring.datasource.username=$DbUser",
    "-Dspring.datasource.password=$DbPass",
    "-Dqueueforge.worker.concurrency=3",
    "-Dqueueforge.worker.poll-interval-ms=100",
    "-Dqueueforge.worker.lease-duration-seconds=10",
    "-Dqueueforge.worker.heartbeat-interval-seconds=3",
    "-Dqueueforge.worker.recovery-poll-interval-ms=2000",
    "-Dqueueforge.worker.chaos-payloads-enabled=true",
    "-XX:+UseSerialGC",
    "-Xmx160m",
    "-Xms32m",
    "-Xss256k",
    "-XX:TieredStopAtLevel=1",
    "-jar", $jarPath
)
$proc2 = Start-Process -FilePath $javaExe -ArgumentList $p2Args -PassThru -RedirectStandardOutput $p2Log -RedirectStandardError "$logDir\worker-jvm-2-err.log"
Log-Evidence "  -> Worker 2 started with PID=$($proc2.Id)"

Log-Evidence "Waiting for Worker 2 (PID=$($proc2.Id)) to report UP..."
$p2Ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8096/actuator/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp -and $resp.status -eq "UP") {
            $p2Ready = $true
            Log-Evidence "[OK] Worker 2 (PID=$($proc2.Id)) is UP and healthy on port 8096 after ${i}s."
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $p2Ready) {
    if ($proc1 -and -not $proc1.HasExited) { Stop-Process -Id $proc1.Id -Force }
    if ($proc2 -and -not $proc2.HasExited) { Stop-Process -Id $proc2.Id -Force }
    throw "Worker 2 failed to become healthy within 60 seconds."
}

try {
    # 5. Configure Tenant Quotas & Seed Workload
    Log-Evidence "[4/6] Seeding tenants with strict concurrency quotas:"
    Log-Evidence "  -> Tenant Alpha: max_concurrency = 2, weight = 1"
    Log-Evidence "  -> Tenant Beta:  max_concurrency = 1, weight = 1"

    Invoke-QuotaDbQuery "
        INSERT INTO qf_tenants (id, name, status, weight, max_concurrency, deficit_counter, api_key_hash, api_key_prefix, last_scheduled_at, created_at, updated_at)
        VALUES 
          ('tenant-alpha', 'Alpha Services', 'ACTIVE', 1, 2, 0, encode(sha256('key-alpha'::bytea), 'hex'), 'key-alph', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          ('tenant-beta',  'Beta Services',  'ACTIVE', 1, 1, 0, encode(sha256('key-beta'::bytea), 'hex'),  'key-beta', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET max_concurrency = EXCLUDED.max_concurrency;
    " | Out-Null

    # Seed 8 long-running jobs for Alpha (delay 2500ms) and 4 long-running jobs for Beta (delay 2500ms)
    Log-Evidence "Enqueuing 8 jobs for Tenant Alpha and 4 jobs for Tenant Beta (delayMs=2500)..."
    Invoke-QuotaDbQuery "
        INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at)
        SELECT 'tenant-alpha', 'alpha-quota-' || g, 'fp-a-' || g, 'CHAOS_TEST', '{\""delayMs\"":2500}'::jsonb, 50, 3, CURRENT_TIMESTAMP, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM generate_series(1, 8) g;

        INSERT INTO qf_jobs (tenant_id, idempotency_key, idempotency_fingerprint, job_type, payload, priority, max_retries, scheduled_at, status, created_at, updated_at)
        SELECT 'tenant-beta', 'beta-quota-' || g, 'fp-b-' || g, 'CHAOS_TEST', '{\""delayMs\"":2500}'::jsonb, 50, 3, CURRENT_TIMESTAMP, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM generate_series(1, 4) g;
    " | Out-Null

    # 6. High-Frequency Sampling of Cluster Concurrency State
    Log-Evidence "[5/6] High-frequency concurrency quota monitoring across both JVMs..."
    Log-Evidence ("{0,-12} | {1,-14} | {2,-14} | {3,-32} | {4,-10}" -f "SAMPLE", "ALPHA RUNNING", "BETA RUNNING", "ACTIVE WORKER CLAIMS", "ASSERTION")

    $maxAlphaObserved = 0
    $maxBetaObserved = 0
    $worker1Seen = $false
    $worker2Seen = $false
    $killedWorker1 = $false

    for ($s = 1; $s -le 35; $s++) {
        Start-Sleep -Milliseconds 300

        # Inject crash of Worker 1 halfway through (at sample 10)
        if ($s -eq 10 -and -not $killedWorker1) {
            Log-Evidence "`n>>> [FAULT INJECTION] Crashing Worker JVM 1 (PID=$($proc1.Id)) to test lease recovery and quota preservation! <<<"
            Stop-Process -Id $proc1.Id -Force
            $killedWorker1 = $true
        }

        # Query database for active running counts
        $alphaRunning = [int](Invoke-QuotaDbQuery "SELECT count(*) FROM qf_jobs WHERE tenant_id = 'tenant-alpha' AND status = 'RUNNING';")
        $betaRunning = [int](Invoke-QuotaDbQuery "SELECT count(*) FROM qf_jobs WHERE tenant_id = 'tenant-beta' AND status = 'RUNNING';")
        
        $workersRaw = Invoke-QuotaDbQuery "SELECT DISTINCT locked_by FROM qf_jobs WHERE status = 'RUNNING' AND locked_by IS NOT NULL;"
        $activeWorkers = ($workersRaw -split "`r?`n" | Where-Object { $_ -ne "" }) -join ", "

        if ($activeWorkers -like "*worker-jvm-1*") { $worker1Seen = $true }
        if ($activeWorkers -like "*worker-jvm-2*") { $worker2Seen = $true }

        if ($alphaRunning -gt $maxAlphaObserved) { $maxAlphaObserved = $alphaRunning }
        if ($betaRunning -gt $maxBetaObserved) { $maxBetaObserved = $betaRunning }

        # STRICT ASSERTIONS: Quota must NEVER be violated
        if ($alphaRunning -gt 2) {
            throw "[QUOTA VIOLATION] Tenant Alpha running count ($alphaRunning) exceeded max_concurrency ceiling of 2!"
        }
        if ($betaRunning -gt 1) {
            throw "[QUOTA VIOLATION] Tenant Beta running count ($betaRunning) exceeded max_concurrency ceiling of 1!"
        }

        $assertionStatus = if ($alphaRunning -le 2 -and $betaRunning -le 1) { "PASS (<=2, <=1)" } else { "FAIL" }
        Write-Host ("Sample {0,4} | Alpha: {1,2} / 2 | Beta: {2,2} / 1  | {3,-32} | {4}" -f $s, $alphaRunning, $betaRunning, $activeWorkers, $assertionStatus) -ForegroundColor Cyan
    }

    # 7. Final Drain & Recovery Verification
    Log-Evidence "`n[6/6] Verifying eventual consistency, lease recovery, and zero quota leaks..."
    
    # Wait for remaining jobs to be reclaimed by Worker 2 and completed
    $allCompleted = $false
    for ($wait = 0; $wait -lt 50; $wait++) {
        $pending = [int](Invoke-QuotaDbQuery "SELECT count(*) FROM qf_jobs WHERE status IN ('PENDING', 'RUNNING');")
        if ($pending -eq 0) {
            $allCompleted = $true
            break
        }
        Start-Sleep -Seconds 1
    }

    $completedCount = [int](Invoke-QuotaDbQuery "SELECT count(*) FROM qf_jobs WHERE status = 'COMPLETED';")
    $activeLeaks = [int](Invoke-QuotaDbQuery "SELECT count(*) FROM qf_jobs WHERE status = 'RUNNING';")

    Log-Evidence "Final Verification State:"
    Log-Evidence "  - Total Jobs Completed: $completedCount / 12"
    Log-Evidence "  - Active RUNNING Jobs (Quota Leak Check): $activeLeaks (Expected: 0)"
    Log-Evidence "  - Max Alpha Running Concurrency Observed: $maxAlphaObserved (Ceiling: 2)"
    Log-Evidence "  - Max Beta Running Concurrency Observed:  $maxBetaObserved (Ceiling: 1)"
    Log-Evidence "  - Worker 1 (PID=$($proc1.Id)) Made Progress: $worker1Seen"
    Log-Evidence "  - Worker 2 (PID=$($proc2.Id)) Made Progress: $worker2Seen"

    if ($completedCount -ne 12 -or $activeLeaks -ne 0 -or $maxAlphaObserved -gt 2 -or $maxBetaObserved -gt 1) {
        throw "Cross-process quota test verification failed!"
    }

    Log-Evidence "`n[SUCCESS] Cross-process quota enforcement verified across independent JVM processes with zero quota leaks!"

} finally {
    # Cleanup processes
    Log-Evidence "Cleaning up background worker JVM processes..."
    if ($proc1 -and -not $proc1.HasExited) {
        Stop-Process -Id $proc1.Id -Force
        Log-Evidence "Stopped Worker 1 (PID=$($proc1.Id))"
    }
    if ($proc2 -and -not $proc2.HasExited) {
        Stop-Process -Id $proc2.Id -Force
        Log-Evidence "Stopped Worker 2 (PID=$($proc2.Id))"
    }
}
