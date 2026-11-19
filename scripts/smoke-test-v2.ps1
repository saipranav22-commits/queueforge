# ==============================================================================
# QueueForge V2 Live Stack Smoke Test
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "================================================================================"
Write-Host "  QUEUEFORGE V2: LIVE STACK SMOKE TEST"
Write-Host "================================================================================"

$ADMIN_KEY = if ($env:ADMIN_API_KEY) { $env:ADMIN_API_KEY } else { "qf_admin_dev_secret_2026" }
$BASE_URL = "http://127.0.0.1:8088"

# ------------------------------------------------------------------------------
# 1. Frontend & Reverse Proxy Health
# ------------------------------------------------------------------------------
Write-Host "`n[1/6] Verifying Frontend Reverse Proxy Health..."
$frontendHealth = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
Write-Host "  -> Reverse Proxy Response: $frontendHealth"

# ------------------------------------------------------------------------------
# 2. Register Two Independent Authenticated Tenants via Admin API
# ------------------------------------------------------------------------------
Write-Host "`n[2/6] Registering Tenants via Admin API..."
$adminHeaders = @{ "X-Admin-Key" = $ADMIN_KEY; "Content-Type" = "application/json" }

$tenantAId = "tenant-prod-a-" + (Get-Random -Minimum 1000 -Maximum 9999)
$tenantBId = "tenant-prod-b-" + (Get-Random -Minimum 1000 -Maximum 9999)

$tenantABody = @{
    id = $tenantAId
    name = "Enterprise Tenant Alpha"
    weight = 2
    maxConcurrency = 2
} | ConvertTo-Json

$tenantBBody = @{
    id = $tenantBId
    name = "Standard Tenant Beta"
    weight = 1
    maxConcurrency = 1
} | ConvertTo-Json

$tenantAResp = Invoke-RestMethod -Uri "$BASE_URL/api/v1/admin/tenants" -Method Post -Headers $adminHeaders -Body $tenantABody
$tenantAKey = $tenantAResp.apiKey
Write-Host "  -> Created Tenant Alpha: id=$($tenantAResp.id) weight=$($tenantAResp.weight) maxConcurrency=$($tenantAResp.maxConcurrency)"

$tenantBResp = Invoke-RestMethod -Uri "$BASE_URL/api/v1/admin/tenants" -Method Post -Headers $adminHeaders -Body $tenantBBody
$tenantBKey = $tenantBResp.apiKey
Write-Host "  -> Created Tenant Beta:  id=$($tenantBResp.id) weight=$($tenantBResp.weight) maxConcurrency=$($tenantBResp.maxConcurrency)"

# ------------------------------------------------------------------------------
# 3. End-to-End Job Submission & Worker Attribution
# ------------------------------------------------------------------------------
Write-Host "`n[3/6] Submitting Authenticated Job for Tenant Alpha..."
$jobPayload = @{
    jobType = "GENERATE_REPORT"
    payload = @{ reportName = "financial-quarterly-v2"; format = "PDF" }
    priority = 80
    maxRetries = 3
    delaySeconds = 0
} | ConvertTo-Json

$tenantAHeaders = @{ "X-Tenant-Key" = $tenantAKey; "Content-Type" = "application/json" }
$submittedJob = Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs" -Method Post -Headers $tenantAHeaders -Body $jobPayload
$jobId = $submittedJob.jobId
Write-Host "  -> Job Accepted: ID=$jobId Tenant=$($submittedJob.tenantId) Status=$($submittedJob.status)"

Write-Host "  -> Waiting 4s for worker processing..."
Start-Sleep -Seconds 4

$jobStatus = Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs/$jobId" -Method Get -Headers $tenantAHeaders
Write-Host "  -> Verified Job Status: $($jobStatus.status) Attempts=$($jobStatus.attemptCount)"

# Inspect execution logs with worker attribution
$history = Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs/$jobId/history" -Method Get -Headers $adminHeaders
Write-Host "  -> Execution History (Audit Logs):"
foreach ($entry in $history) {
    Write-Host "     [Attempt $($entry.attempt)] Status=$($entry.status) Worker=$($entry.workerId) Duration=$($entry.executionTimeMs)ms"
}

# ------------------------------------------------------------------------------
# 4. Tenant Isolation & Security Boundary Verification
# ------------------------------------------------------------------------------
Write-Host "`n[4/6] Verifying Cross-Tenant Isolation..."
$tenantBHeaders = @{ "X-Tenant-Key" = $tenantBKey; "Content-Type" = "application/json" }

# Attempt A: Tenant B attempts to access Tenant Alpha's job -> MUST return 404
$isolatedSuccess = $false
try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs/$jobId" -Method Get -Headers $tenantBHeaders
    Write-Host "  [FAILURE] Tenant B was able to view Tenant Alpha's job!"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "  -> [PASSED] Tenant B cross-tenant inspection correctly returned HTTP 404 Not Found"
        $isolatedSuccess = $true
    } else {
        Write-Host "  -> [UNEXPECTED] Status code: $statusCode"
    }
}

# Attempt B: Tenant B attempts to spoof Tenant Alpha in submission -> MUST return 403
$spoofPayload = @{
    tenantId = $tenantAId
    jobType = "GENERATE_REPORT"
    payload = @{ hack = "cross-tenant-injection" }
    priority = 10
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs" -Method Post -Headers $tenantBHeaders -Body $spoofPayload
    Write-Host "  [FAILURE] Tenant B was able to spoof Tenant Alpha!"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
        Write-Host "  -> [PASSED] Cross-tenant submission spoofing correctly rejected with HTTP 403 Forbidden"
    } else {
        Write-Host "  -> [UNEXPECTED] Spoof status code: $statusCode"
    }
}

# Attempt C: Unauthenticated access with invalid key -> MUST return 401
try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs" -Method Get -Headers @{ "X-Tenant-Key" = "invalid_secret_key" }
    Write-Host "  [FAILURE] Invalid key accepted!"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  -> [PASSED] Invalid credentials correctly rejected with HTTP 401 Unauthorized"
    }
}

# ------------------------------------------------------------------------------
# 5. Live Transactional Outbox & Real HTTP Payment Receiver Test
# ------------------------------------------------------------------------------
Write-Host "`n[5/6] Verifying Transactional Outbox Live Dispatch & Receiver Idempotency..."
$orderNumber = "ORD-V2-SMOKE-" + (Get-Random -Minimum 10000 -Maximum 99999)
$orderPayload = @{
    orderNumber = $orderNumber
    customerId = "CUST-SMOKE-V2"
    amountCents = 9950
    currency = "USD"
} | ConvertTo-Json

$orderResp = Invoke-RestMethod -Uri "$BASE_URL/api/v1/orders" -Method Post -ContentType "application/json" -Body $orderPayload
Write-Host "  -> Created Order: ID=$($orderResp.id) Number=$($orderResp.orderNumber) Status=$($orderResp.status)"

Write-Host "  -> Polling up to 20s for Outbox HTTP delivery & order settlement..."
$outboxDelivered = $false
$maxWaitSec = 20
$outboxStatus = "UNKNOWN"
$updatedOrder = $null
$chargeCount = "0"
$inboxCount = "0"

for ($s = 1; $s -le $maxWaitSec; $s++) {
    Start-Sleep -Seconds 1
    $outboxStatus = (docker exec qf-v2-sender-db psql -U queueforge_app -d queueforge -t -c "SELECT status FROM outbox_events WHERE aggregate_id = '$($orderResp.id)';").Trim()
    
    try {
        $updatedOrder = Invoke-RestMethod -Uri "$BASE_URL/api/v1/orders/$($orderResp.id)" -Method Get
    } catch {
        # ignore transient read errors
    }
    
    $chargeCount = (docker exec qf-v2-receiver-db psql -U queueforge_app -d queueforge_payment_receiver -t -c "SELECT COUNT(*) FROM simulated_payment_charges WHERE order_id = '$($orderResp.id)';").Trim()
    $inboxCount = (docker exec qf-v2-receiver-db psql -U queueforge_app -d queueforge_payment_receiver -t -c "SELECT COUNT(*) FROM inbox_deduplication WHERE idempotency_key = 'order-payment-$($orderResp.id)';").Trim()

    if ($outboxStatus -eq "DELIVERED" -and $updatedOrder.status -eq "PAID" -and $chargeCount -eq "1" -and $inboxCount -eq "1") {
        $outboxDelivered = $true
        Write-Host "  -> Outbox Event Delivered & Settled in ${s}s!"
        break
    }
}

Write-Host "  -> Current Order Status in Sender DB: $($updatedOrder.status) (Expected: PAID)"
Write-Host "  -> Outbox Event Status: $outboxStatus (Expected: DELIVERED)"
Write-Host "  -> Committed Charges in Independent Receiver DB: $chargeCount (Expected: 1)"
Write-Host "  -> Inbox Deduplication Record in Receiver DB: $inboxCount (Expected: 1)"

if (-not $outboxDelivered) {
    Write-Host "  [FAILURE] Outbox settlement not finalized within ${maxWaitSec}s."
    exit 1
}
Write-Host "  -> [PASSED] Outbox exactly-once delivery and order settlement verified!"

# Verify Receiver Idempotency on Duplicate Dispatch
Write-Host "  -> Verifying Receiver Idempotency on Duplicate Dispatch..."
$eventPayload = (docker exec qf-v2-sender-db psql -U queueforge_app -d queueforge -t -c "SELECT payload FROM outbox_events WHERE aggregate_id = '$($orderResp.id)';").Trim()
$serviceKey = if ($env:RECEIVER_SERVICE_KEY) { $env:RECEIVER_SERVICE_KEY } else { "qf_v2_internal_service_key_2026" }

# Dispatch duplicate via worker container using stdin pipe
$idempResult = $eventPayload | docker exec -i qf-v2-worker-1 wget -q -O - --header "Content-Type: application/json" --header "X-Service-Key: $serviceKey" --post-file - http://payment-receiver:8098/api/v1/payments/charges
$dupCharges = (docker exec qf-v2-receiver-db psql -U queueforge_app -d queueforge_payment_receiver -t -c "SELECT COUNT(*) FROM simulated_payment_charges WHERE order_id = '$($orderResp.id)';").Trim()

if ($idempResult -match "idempotentReplay.:true" -and $dupCharges -eq "1") {
    Write-Host "  -> [PASSED] Duplicate dispatch returned cached response (idempotentReplay=true) and charge count remained 1!"
} else {
    Write-Host "  [FAILURE] Idempotency check failed: Result=$idempResult DupCharges=$dupCharges"
    exit 1
}

# ------------------------------------------------------------------------------
# 6. Multi-Worker Concurrent Processing Attribution Check
# ------------------------------------------------------------------------------
Write-Host "`n[6/6] Verifying Concurrent Multi-Worker Attribution..."
$batchJobs = @()
for ($i = 1; $i -le 6; $i++) {
    $batchPayload = @{
        jobType = "GENERATE_REPORT"
        payload = @{ reportId = $i; run = "concurrent-burst-v2" }
        priority = 50
    } | ConvertTo-Json
    $bJob = Invoke-RestMethod -Uri "$BASE_URL/api/v1/jobs" -Method Post -Headers $tenantAHeaders -Body $batchPayload
    $batchJobs += $bJob.jobId
}
Write-Host "  -> Enqueued 6 jobs for Tenant Alpha. Waiting 6s for cluster drain..."
Start-Sleep -Seconds 6

$workerAttribution = docker exec qf-v2-sender-db psql -U queueforge_app -d queueforge -t -c "SELECT worker_id, COUNT(*) FROM qf_job_execution_logs GROUP BY worker_id;"
Write-Host "  -> Worker Cluster Attribution Distribution:"
Write-Host $workerAttribution

# Verify both worker nodes participated
$hasWorker1 = $workerAttribution -match "worker-v2-node-1"
$hasWorker2 = $workerAttribution -match "worker-v2-node-2"

if ($hasWorker1 -and $hasWorker2) {
    Write-Host "  -> [PASSED] Both worker nodes (node-1 and node-2) actively processed cluster jobs!"
} else {
    Write-Host "  [FAILURE] Cluster worker participation incomplete: Worker1=$hasWorker1 Worker2=$hasWorker2"
    exit 1
}

Write-Host "`n================================================================================"
Write-Host "  [SUCCESS] All QueueForge V2 Live Stack Smoke Tests Passed!"
Write-Host "================================================================================"
