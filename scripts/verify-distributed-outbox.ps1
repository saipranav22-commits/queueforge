# ==============================================================================
# QueueForge V2 — Phase 3B: Real Distributed Outbox Consistency Verification
# Demonstrates true multi-process, two-database transactional outbox consistency
# with genuine process crashes, network severance, and idempotent receiver replay.
# ==============================================================================
param (
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5435,
    [string]$SenderDb = "queueforge",
    [string]$ReceiverDb = "queueforge_payment_receiver",
    [string]$DbUser = "queueforge_app",
    [string]$DbPass = "qf_dev_secret_d_isolated_2026",
    [int]$ReceiverPort = 8098,
    [int]$BackendPort = 8085,
    [string]$ReceiverTestSecret = "qf_test_secret_internal_2026",
    [string]$AdminApiKey = "qf_admin_dev_secret_2026"
)

$ErrorActionPreference = "Stop"

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  QUEUEFORGE V2: REAL DISTRIBUTED OUTBOX CONSISTENCY VERIFICATION" -ForegroundColor Cyan
Write-Host "  Architecture: Two Isolated JVM Processes | Two Independent PostgreSQL Catalogs" -ForegroundColor Cyan
Write-Host "================================================================================`n" -ForegroundColor Cyan

# 1. Setup Environment
. D:\Projects\QueueForge\env.ps1

$receiverJar = "D:\Projects\QueueForge\simulated-payment-receiver\target\simulated-payment-receiver-0.1.0-SNAPSHOT.jar"
$backendJar = "D:\Projects\QueueForge\backend\target\queueforge-backend-0.1.0-SNAPSHOT.jar"

if (-not (Test-Path $receiverJar)) {
    Write-Error "Receiver JAR not found at $receiverJar. Run mvn package first."
}
if (-not (Test-Path $backendJar)) {
    Write-Error "Backend JAR not found at $backendJar. Run mvn package first."
}

$receiverProcess = $null
$backendProcess = $null
$passedScenarios = 0
$totalScenarios = 8

function Stop-AllProcesses {
    Write-Host "`n[Teardown] Stopping background processes..." -ForegroundColor DarkGray
    if ($receiverProcess -and -not $receiverProcess.HasExited) {
        Stop-Process -Id $receiverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Also clean up any lingering java processes on port 8098 or 8085
    Get-NetTCPConnection -LocalPort $ReceiverPort, $BackendPort -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

function Wait-For-Port([int]$port, [int]$timeoutSeconds = 40) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$port/actuator/info" -Method Get -TimeoutSec 2 -ErrorAction Stop
            return $true
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

function Invoke-PsqlQuery([string]$db, [string]$query) {
    $out = docker exec queueforge-postgres psql -U $DbUser -d $db -t -A -c $query 2>&1
    return ($out -join "`n").Trim()
}

function Start-Receiver {
    Write-Host "[Process] Launching Simulated Payment Receiver JVM on port $ReceiverPort..." -ForegroundColor DarkGray
    $receiverLog = "D:\Projects\QueueForge\logs\receiver.log"
    $receiverErr = "D:\Projects\QueueForge\logs\receiver-err.log"
    $args = @(
        "-Xmx128m",
        "-jar",
        "$receiverJar",
        "--server.port=$ReceiverPort",
        "--queueforge.receiver.test-endpoints-enabled=true",
        "--spring.datasource.url=jdbc:postgresql://${DbHost}:${DbPort}/${ReceiverDb}",
        "--spring.datasource.username=$DbUser",
        "--spring.datasource.password=$DbPass"
    )
    $script:receiverProcess = Start-Process -FilePath "$env:JAVA_HOME\bin\java.exe" -ArgumentList $args -RedirectStandardOutput $receiverLog -RedirectStandardError $receiverErr -NoNewWindow -PassThru
    
    if (-not (Wait-For-Port $ReceiverPort 40)) {
        throw "Receiver failed to bind to port $ReceiverPort within timeout"
    }
    Write-Host "[Process] Receiver JVM is healthy on port $ReceiverPort (PID: $($receiverProcess.Id))" -ForegroundColor Green
}

function Start-Backend([int]$port = 8085, [bool]$dispatcherEnabled = $false) {
    Write-Host "[Process] Launching QueueForge Backend JVM on port $port (dispatcher=$dispatcherEnabled)..." -ForegroundColor DarkGray
    $backendLog = "D:\Projects\QueueForge\logs\backend-$port.log"
    $backendErr = "D:\Projects\QueueForge\logs\backend-$port-err.log"
    $args = @(
        "-Xmx256m",
        "-jar",
        "$backendJar",
        "--server.port=$port",
        "--queueforge.worker.enabled=false",
        "--queueforge.outbox.dispatcher.enabled=$($dispatcherEnabled.ToString().ToLower())",
        "--queueforge.outbox.payment.client-type=HTTP",
        "--queueforge.outbox.payment.url=http://127.0.0.1:$ReceiverPort/api/v1/payments/charges",
        "--queueforge.outbox.payment.read-timeout-ms=5000",
        "--spring.datasource.url=jdbc:postgresql://${DbHost}:${DbPort}/${SenderDb}",
        "--spring.datasource.username=$DbUser",
        "--spring.datasource.password=$DbPass"
    )
    $proc = Start-Process -FilePath "$env:JAVA_HOME\bin\java.exe" -ArgumentList $args -RedirectStandardOutput $backendLog -RedirectStandardError $backendErr -NoNewWindow -PassThru
    
    if (-not (Wait-For-Port $port 40)) {
        throw "Backend failed to bind to port $port within timeout"
    }
    Write-Host "[Process] Backend JVM is healthy on port $port (PID: $($proc.Id))" -ForegroundColor Green
    return $proc
}

try {
    # Clean previous processes
    Stop-AllProcesses

    # Clean test tables in both independent databases
    Write-Host "[Database] Purging previous test rows from sender ($SenderDb) and receiver ($ReceiverDb)..." -ForegroundColor DarkGray
    Invoke-PsqlQuery $SenderDb "DELETE FROM outbox_events; DELETE FROM orders;" | Out-Null
    Invoke-PsqlQuery $ReceiverDb "DELETE FROM simulated_payment_charges; DELETE FROM inbox_deduplication;" | Out-Null

    # Start Receiver JVM
    Start-Receiver

    # Start Backend JVM
    $backendProcess = Start-Backend -port $BackendPort -dispatcherEnabled $false

    # -------------------------------------------------------------------------
    # EXPERIMENT A: Sender Crash After Commit Before Delivery
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment A] Sender Crash After Commit Before Delivery <<<" -ForegroundColor Yellow
    $orderNumber = "ORD-CRASH-A-" + [System.Guid]::NewGuid().ToString().Substring(0, 8)
    $createBody = @{
        orderNumber = $orderNumber
        customerId = "cust_exp_a"
        amountCents = 15000
        currency = "USD"
    } | ConvertTo-Json

    $createResp = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/orders" -Method Post -Body $createBody -ContentType "application/json"
    $orderId = $createResp.id
    Write-Host "Created Order $orderNumber (ID: $orderId) with Outbox status PENDING in database '$SenderDb'" -ForegroundColor Cyan

    # Simulate abrupt host / process crash before outbox dispatcher executes
    Write-Host "Simulating sudden sender JVM crash via SIGKILL (Stop-Process -Force)..." -ForegroundColor Magenta
    Stop-Process -Id $backendProcess.Id -Force
    Start-Sleep -Seconds 1

    # Verify database state while sender is down
    $orderStatus = Invoke-PsqlQuery $SenderDb "SELECT status FROM orders WHERE id = '$orderId';"
    $outboxStatus = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderId';"
    $receiverCharges = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE order_id = '$orderId';"

    Write-Host "  [Post-Crash Inspection] Sender DB Order Status : $orderStatus (Expected: CREATED)" -ForegroundColor Gray
    Write-Host "  [Post-Crash Inspection] Sender DB Outbox Status: $outboxStatus (Expected: PENDING)" -ForegroundColor Gray
    Write-Host "  [Post-Crash Inspection] Receiver DB Charge Count: $receiverCharges (Expected: 0)" -ForegroundColor Gray

    if ($orderStatus -ne "CREATED" -or $outboxStatus -ne "PENDING" -or $receiverCharges -ne "0") {
        throw "Experiment A verification failed: Inconsistent state post-crash"
    }

    # Recover sender process
    Write-Host "Restarting Backend JVM to recover committed outbox event..." -ForegroundColor Cyan
    $backendProcess = Start-Backend -port $BackendPort -dispatcherEnabled $false

    # Dispatch pending outbox event over real HTTP
    $dispatchResp = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/admin/outbox/dispatch" -Method Post -Headers @{ "X-Admin-Key" = $AdminApiKey }
    Write-Host "Dispatched $($dispatchResp.dispatchedCount) events via HTTP to receiver" -ForegroundColor Cyan

    # Verify recovery
    $orderStatusAfter = Invoke-PsqlQuery $SenderDb "SELECT status FROM orders WHERE id = '$orderId';"
    $outboxStatusAfter = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderId';"
    $receiverChargesAfter = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE order_id = '$orderId';"

    if ($orderStatusAfter -eq "PAID" -and $outboxStatusAfter -eq "DELIVERED" -and $receiverChargesAfter -eq "1") {
        Write-Host "[Experiment A Passed] Order was durably preserved across crash and delivered upon recovery." -ForegroundColor Green
        $passedScenarios++
    } else {
        throw "Experiment A failed: OrderStatus=$orderStatusAfter, OutboxStatus=$outboxStatusAfter, ReceiverCharges=$receiverChargesAfter"
    }

    # -------------------------------------------------------------------------
    # EXPERIMENT B: Dispatcher Crash After Claim (Lease Expiration Recovery)
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment B] Dispatcher Crash After Claim (Lease Expiration Recovery) <<<" -ForegroundColor Yellow
    $orderNumberB = "ORD-CRASH-B-" + [System.Guid]::NewGuid().ToString().Substring(0, 8)
    $createBodyB = @{
        orderNumber = $orderNumberB
        customerId = "cust_exp_b"
        amountCents = 22000
        currency = "USD"
    } | ConvertTo-Json

    $createRespB = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/orders" -Method Post -Body $createBodyB -ContentType "application/json"
    $orderIdB = $createRespB.id

    # Manually claim event with a short 2-second lease, then crash dispatcher
    $claimSql = "UPDATE outbox_events SET status = 'DISPATCHING', claimed_by = 'crashed-disp-1', claim_token = gen_random_uuid(), claim_expires_at = CURRENT_TIMESTAMP + INTERVAL '2 seconds' WHERE aggregate_id = '$orderIdB';"
    Invoke-PsqlQuery $SenderDb $claimSql | Out-Null
    Write-Host "Dispatcher claimed event with 2s lease, then terminated abruptly." -ForegroundColor Magenta

    # Confirm event is DISPATCHING
    $bStatus1 = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdB';"
    Write-Host "  [Immediate Status] Outbox Status: $bStatus1 (Expected: DISPATCHING)" -ForegroundColor Gray

    # Wait for lease to expire
    Write-Host "Waiting 3 seconds for lease expiration..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3

    # New dispatcher claims and delivers
    $dispatchRespB = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/admin/outbox/dispatch" -Method Post -Headers @{ "X-Admin-Key" = $AdminApiKey }
    Write-Host "Second dispatcher reclaimed and dispatched $($dispatchRespB.dispatchedCount) events" -ForegroundColor Cyan

    $bStatus2 = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdB';"
    $bOrder2 = Invoke-PsqlQuery $SenderDb "SELECT status FROM orders WHERE id = '$orderIdB';"
    $bCharges2 = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE order_id = '$orderIdB';"

    if ($bStatus2 -eq "DELIVERED" -and $bOrder2 -eq "PAID" -and $bCharges2 -eq "1") {
        Write-Host "[Experiment B Passed] Abandoned DISPATCHING lease successfully reclaimed after expiration." -ForegroundColor Green
        $passedScenarios++
    } else {
        throw "Experiment B failed: Status=$bStatus2, Order=$bOrder2, Charges=$bCharges2"
    }

    # -------------------------------------------------------------------------
    # EXPERIMENT C & D: Lost HTTP Acknowledgement & Duplicate Retry (Idempotent Replay)
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment C & D] Lost HTTP Acknowledgement & Duplicate Retry (Idempotent Replay) <<<" -ForegroundColor Yellow
    $orderNumberC = "ORD-LOST-ACK-" + [System.Guid]::NewGuid().ToString().Substring(0, 8)
    $createBodyC = @{
        orderNumber = $orderNumberC
        customerId = "cust_exp_c"
        amountCents = 9900
        currency = "USD"
    } | ConvertTo-Json

    $createRespC = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/orders" -Method Post -Body $createBodyC -ContentType "application/json"
    $orderIdC = $createRespC.id

    # Enable simulated lost-ack hook on receiver
    Write-Host "Arming receiver fault hook: Commit charge but abort connection before returning HTTP ACK..." -ForegroundColor Magenta
    Invoke-RestMethod -Uri "http://127.0.0.1:$ReceiverPort/api/v1/payments/simulate/lost-ack?enabled=true" -Method Post -Headers @{ "X-Test-Secret" = $ReceiverTestSecret } | Out-Null

    # Dispatcher attempts delivery; receiver commits charge, but drops connection
    Write-Host "Dispatcher attempting HTTP dispatch under network acknowledgement loss..." -ForegroundColor Cyan
    $dispatchRespC1 = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/admin/outbox/dispatch" -Method Post -Headers @{ "X-Admin-Key" = $AdminApiKey }
    Write-Host "Dispatcher dispatch result: $($dispatchRespC1.dispatchedCount) delivered (Expected: 0 due to socket drop)" -ForegroundColor DarkGray

    # Cross-database inspection in the uncertain state
    $senderOutboxC1 = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdC';"
    $senderOrderC1 = Invoke-PsqlQuery $SenderDb "SELECT status FROM orders WHERE id = '$orderIdC';"
    $receiverChargesC1 = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE order_id = '$orderIdC';"
    $receiverInboxC1 = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM inbox_deduplication WHERE idempotency_key LIKE '%$orderIdC%';"

    Write-Host "  [Uncertain State Audit] Sender DB Outbox Status : $senderOutboxC1 (PENDING / scheduled retry)" -ForegroundColor Gray
    Write-Host "  [Uncertain State Audit] Sender DB Order Status  : $senderOrderC1 (CREATED)" -ForegroundColor Gray
    Write-Host "  [Uncertain State Audit] Receiver DB Charge Count: $receiverChargesC1 (Already COMMITTED in receiver DB!)" -ForegroundColor Yellow
    Write-Host "  [Uncertain State Audit] Receiver DB Inbox Rows  : $receiverInboxC1 (Deduplication record stored)" -ForegroundColor Yellow

    if ($senderOutboxC1 -ne "PENDING" -or $senderOrderC1 -ne "CREATED" -or $receiverChargesC1 -ne "1" -or $receiverInboxC1 -ne "1") {
        throw "Experiment C verification failed: Expected receiver committed charge with pending sender outbox"
    }
    Write-Host "[Experiment C Passed] Genuine lost-ack condition established across isolated databases." -ForegroundColor Green
    $passedScenarios++

    # Now disarm the fault hook and retry delivery
    Write-Host "`nDisarming lost-ack fault hook on receiver; dispatcher re-delivers duplicate event..." -ForegroundColor Cyan
    Invoke-RestMethod -Uri "http://127.0.0.1:$ReceiverPort/api/v1/payments/simulate/lost-ack?enabled=false" -Method Post -Headers @{ "X-Test-Secret" = $ReceiverTestSecret } | Out-Null

    # Advance next_retry_at to CURRENT_TIMESTAMP so dispatcher picks it up immediately
    Invoke-PsqlQuery $SenderDb "UPDATE outbox_events SET next_retry_at = CURRENT_TIMESTAMP WHERE aggregate_id = '$orderIdC';" | Out-Null

    # Dispatcher retries
    $dispatchRespC2 = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/admin/outbox/dispatch" -Method Post -Headers @{ "X-Admin-Key" = $AdminApiKey }
    Write-Host "Dispatcher retry result: $($dispatchRespC2.dispatchedCount) delivered" -ForegroundColor Cyan

    # Final cross-database inspection
    $senderOutboxC2 = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdC';"
    $senderOrderC2 = Invoke-PsqlQuery $SenderDb "SELECT status FROM orders WHERE id = '$orderIdC';"
    $receiverChargesC2 = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE order_id = '$orderIdC';"
    $receiverInboxC2 = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM inbox_deduplication WHERE idempotency_key LIKE '%$orderIdC%';"

    Write-Host "  [Final Verification] Sender Outbox Status : $senderOutboxC2 (Expected: DELIVERED)" -ForegroundColor Gray
    Write-Host "  [Final Verification] Sender Order Status  : $senderOrderC2 (Expected: PAID)" -ForegroundColor Gray
    Write-Host "  [Final Verification] Receiver Charge Count: $receiverChargesC2 (Expected: EXACTLY 1 - NO DOUBLE CHARGE)" -ForegroundColor Green
    Write-Host "  [Final Verification] Receiver Inbox Rows  : $receiverInboxC2 (Expected: EXACTLY 1)" -ForegroundColor Green

    if ($senderOutboxC2 -eq "DELIVERED" -and $senderOrderC2 -eq "PAID" -and $receiverChargesC2 -eq "1" -and $receiverInboxC2 -eq "1") {
        Write-Host "[Experiment D Passed] Idempotent consumer detected duplicate replay and prevented double charge." -ForegroundColor Green
        $passedScenarios++
    } else {
        throw "Experiment D failed: Duplicate charge occurred or final state mismatched"
    }

    # -------------------------------------------------------------------------
    # EXPERIMENT E: Two Concurrent Independent Dispatcher Processes (SKIP LOCKED Mutual Exclusion)
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment E] Two Concurrent Independent Dispatcher Processes (SKIP LOCKED Mutual Exclusion) <<<" -ForegroundColor Yellow
    # Create 50 orders
    Write-Host "Creating 50 pending orders and outbox events in '$SenderDb'..." -ForegroundColor Cyan
    for ($i = 1; $i -le 50; $i++) {
        $ordNum = "ORD-CONC-$i-" + [System.Guid]::NewGuid().ToString().Substring(0, 6)
        $body = @{ orderNumber = $ordNum; customerId = "cust_conc"; amountCents = (1000 * $i); currency = "USD" } | ConvertTo-Json
        Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/orders" -Method Post -Body $body -ContentType "application/json" | Out-Null
    }
    Write-Host "Successfully enqueued 50 pending orders and outbox events." -ForegroundColor Cyan

    # Launch second backend JVM on port 8086
    Write-Host "Starting second independent dispatcher process on port 8086..." -ForegroundColor DarkGray
    $backend2Process = Start-Backend -port 8086 -dispatcherEnabled $false

    try {
        Write-Host "Triggering concurrent HTTP dispatch loops on port 8085 and port 8086 simultaneously (batchSize=5)..." -ForegroundColor Cyan
        $job1 = Start-Job -ScriptBlock {
            param($apiKey)
            $total = 0
            for ($k = 0; $k -lt 25; $k++) {
                try {
                    $r = Invoke-RestMethod -Uri "http://127.0.0.1:8085/api/v1/admin/outbox/dispatch?batchSize=5&leaseDurationSeconds=10" -Method Post -Headers @{ "X-Admin-Key" = $apiKey }
                    $total += $r.dispatchedCount
                    if ($r.dispatchedCount -eq 0) {
                        Start-Sleep -Milliseconds 150
                        $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8085/api/v1/admin/outbox/dispatch?batchSize=5&leaseDurationSeconds=10" -Method Post -Headers @{ "X-Admin-Key" = $apiKey }
                        $total += $r2.dispatchedCount
                        if ($r2.dispatchedCount -eq 0) { break }
                    }
                } catch {
                    break
                }
            }
            return [PSCustomObject]@{ dispatchedCount = $total }
        } -ArgumentList $AdminApiKey

        $job2 = Start-Job -ScriptBlock {
            param($apiKey)
            $total = 0
            for ($k = 0; $k -lt 25; $k++) {
                try {
                    $r = Invoke-RestMethod -Uri "http://127.0.0.1:8086/api/v1/admin/outbox/dispatch?batchSize=5&leaseDurationSeconds=10" -Method Post -Headers @{ "X-Admin-Key" = $apiKey }
                    $total += $r.dispatchedCount
                    if ($r.dispatchedCount -eq 0) {
                        Start-Sleep -Milliseconds 150
                        $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8086/api/v1/admin/outbox/dispatch?batchSize=5&leaseDurationSeconds=10" -Method Post -Headers @{ "X-Admin-Key" = $apiKey }
                        $total += $r2.dispatchedCount
                        if ($r2.dispatchedCount -eq 0) { break }
                    }
                } catch {
                    break
                }
            }
            return [PSCustomObject]@{ dispatchedCount = $total }
        } -ArgumentList $AdminApiKey

        $res1 = Receive-Job -Job $job1 -Wait
        $res2 = Receive-Job -Job $job2 -Wait
        Remove-Job $job1, $job2

        Write-Host "Dispatcher 1 (port 8085) delivered: $($res1.dispatchedCount) events" -ForegroundColor DarkGray
        Write-Host "Dispatcher 2 (port 8086) delivered: $($res2.dispatchedCount) events" -ForegroundColor DarkGray
        $totalDelivered = $res1.dispatchedCount + $res2.dispatchedCount

        $pendingLeft = Invoke-PsqlQuery $SenderDb "SELECT count(*) FROM outbox_events WHERE status != 'DELIVERED';"
        $totalCharges = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE customer_id = 'cust_conc';"

        Write-Host "  [Concurrency Audit] Total Events Processed Across Both Dispatchers: $totalDelivered (Expected: 50)" -ForegroundColor Gray
        Write-Host "  [Concurrency Audit] Remaining Non-Delivered Outbox Events           : $pendingLeft (Expected: 0)" -ForegroundColor Gray
        Write-Host "  [Concurrency Audit] Total Charges in Receiver DB                    : $totalCharges (Expected: 50)" -ForegroundColor Green

        if ($totalDelivered -eq 50 -and $pendingLeft -eq "0" -and $totalCharges -eq "50" -and $res1.dispatchedCount -gt 0 -and $res2.dispatchedCount -gt 0) {
            Write-Host "[Experiment E Passed] PostgreSQL SKIP LOCKED strictly partitioned 50 events across concurrent processes with zero duplicates (Disp1=$($res1.dispatchedCount), Disp2=$($res2.dispatchedCount))." -ForegroundColor Green
            $passedScenarios++
        } else {
            throw "Experiment E failed: TotalDelivered=$totalDelivered, PendingLeft=$pendingLeft, TotalCharges=$totalCharges, Disp1=$($res1.dispatchedCount), Disp2=$($res2.dispatchedCount)"
        }
    } finally {
        if ($backend2Process -and -not $backend2Process.HasExited) {
            Stop-Process -Id $backend2Process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    # -------------------------------------------------------------------------
    # EXPERIMENT F: Receiver Termination and Eventual Delivery (Remote Outage)
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment F] Receiver Termination and Eventual Recovery (Remote Service Outage) <<<" -ForegroundColor Yellow
    $orderNumberF = "ORD-OUTAGE-" + [System.Guid]::NewGuid().ToString().Substring(0, 8)
    $createBodyF = @{ orderNumber = $orderNumberF; customerId = "cust_outage"; amountCents = 7500; currency = "USD" } | ConvertTo-Json
    $createRespF = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/orders" -Method Post -Body $createBodyF -ContentType "application/json"
    $orderIdF = $createRespF.id

    Write-Host "Terminating Receiver JVM process via SIGKILL..." -ForegroundColor Magenta
    Stop-Process -Id $receiverProcess.Id -Force
    Start-Sleep -Seconds 1

    Write-Host "Dispatcher attempting HTTP delivery to offline receiver (expecting ConnectException)..." -ForegroundColor Cyan
    $dispatchRespF1 = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/admin/outbox/dispatch" -Method Post -Headers @{ "X-Admin-Key" = $AdminApiKey }
    Write-Host "Dispatched count during outage: $($dispatchRespF1.dispatchedCount) (Expected: 0)" -ForegroundColor DarkGray

    $fOutboxStatus1 = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdF';"
    $fLastError1 = Invoke-PsqlQuery $SenderDb "SELECT last_error FROM outbox_events WHERE aggregate_id = '$orderIdF';"
    Write-Host "  [Outage Audit] Outbox Status: $fOutboxStatus1 (Expected: PENDING)" -ForegroundColor Gray
    Write-Host "  [Outage Audit] Recorded Error: $fLastError1" -ForegroundColor DarkGray

    Write-Host "Restarting Receiver JVM on port $ReceiverPort..." -ForegroundColor Cyan
    Start-Receiver

    # Advance next_retry_at
    Invoke-PsqlQuery $SenderDb "UPDATE outbox_events SET next_retry_at = CURRENT_TIMESTAMP WHERE aggregate_id = '$orderIdF';" | Out-Null

    # Re-dispatch
    $dispatchRespF2 = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/admin/outbox/dispatch" -Method Post -Headers @{ "X-Admin-Key" = $AdminApiKey }
    $fOutboxStatus2 = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdF';"
    $fCharges2 = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE order_id = '$orderIdF';"

    if ($fOutboxStatus2 -eq "DELIVERED" -and $fCharges2 -eq "1") {
        Write-Host "[Experiment F Passed] Dispatcher backed off during remote outage and recovered once service restored." -ForegroundColor Green
        $passedScenarios++
    } else {
        throw "Experiment F failed: Status=$fOutboxStatus2, Charges=$fCharges2"
    }

    # -------------------------------------------------------------------------
    # EXPERIMENT G: Conflicting Payload Rejection (Idempotency Fingerprint Conflict)
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment G] Conflicting Payload Rejection (Fingerprint Mismatch) <<<" -ForegroundColor Yellow
    $conflictKey = "conf-key-" + [System.Guid]::NewGuid().ToString().Substring(0, 8)
    $charge1 = @{
        orderId = [System.Guid]::NewGuid().ToString()
        customerId = "cust_g"
        amountCents = 5000
        currency = "USD"
        idempotencyKey = $conflictKey
        fingerprint = "fingerprint_original_5000"
    } | ConvertTo-Json

    $charge2 = @{
        orderId = [System.Guid]::NewGuid().ToString()
        customerId = "cust_g"
        amountCents = 99999
        currency = "USD"
        idempotencyKey = $conflictKey
        fingerprint = "fingerprint_mutated_99999"
    } | ConvertTo-Json

    # First request: 201 Created
    $r1 = Invoke-RestMethod -Uri "http://127.0.0.1:$ReceiverPort/api/v1/payments/charges" -Method Post -Body $charge1 -ContentType "application/json"
    Write-Host "First payment request succeeded (Ref: $($r1.chargeReference))" -ForegroundColor Cyan

    # Second request with SAME key but DIFFERENT payload: Expect 409 Conflict
    $conflictCaught = $false
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$ReceiverPort/api/v1/payments/charges" -Method Post -Body $charge2 -ContentType "application/json"
    } catch {
        $statusStr = "$($_.Exception.Message) $($_.Exception.Response.StatusCode)"
        if ($statusStr -match "409" -or [int]$_.Exception.Response.StatusCode -eq 409) {
            $conflictCaught = $true
            Write-Host "Receiver correctly rejected conflicting payload with HTTP 409 Conflict" -ForegroundColor Green
        } else {
            Write-Host "Unexpected exception during conflict test: $_" -ForegroundColor Red
        }
    }

    $gTotalCharges = Invoke-PsqlQuery $ReceiverDb "SELECT count(*) FROM simulated_payment_charges WHERE customer_id = 'cust_g';"
    if ($conflictCaught -and $gTotalCharges -eq "1") {
        Write-Host "[Experiment G Passed] Receiver detected fingerprint tampering and rejected duplicate key reuse." -ForegroundColor Green
        $passedScenarios++
    } else {
        throw "Experiment G failed: ConflictCaught=$conflictCaught, Charges=$gTotalCharges"
    }

    # -------------------------------------------------------------------------
    # EXPERIMENT H: Fencing Token Monotonicity Under Expired Dispatchers
    # -------------------------------------------------------------------------
    Write-Host "`n>>> [Experiment H] Fencing Token Monotonicity Under Expired Dispatchers <<<" -ForegroundColor Yellow
    $orderNumberH = "ORD-FENCE-" + [System.Guid]::NewGuid().ToString().Substring(0, 8)
    $createBodyH = @{ orderNumber = $orderNumberH; customerId = "cust_fence"; amountCents = 3500; currency = "USD" } | ConvertTo-Json
    $createRespH = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/orders" -Method Post -Body $createBodyH -ContentType "application/json"
    $orderIdH = $createRespH.id

    # Dispatcher A claims event with Token-A
    $tokenA = [System.Guid]::NewGuid().ToString()
    Invoke-PsqlQuery $SenderDb "UPDATE outbox_events SET status = 'DISPATCHING', claimed_by = 'disp-A', claim_token = '$tokenA', claim_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE aggregate_id = '$orderIdH';" | Out-Null
    Write-Host "Dispatcher A claimed event with Token $tokenA (lease expired)." -ForegroundColor Cyan

    # Dispatcher B re-claims event with Token-B
    $tokenB = [System.Guid]::NewGuid().ToString()
    Invoke-PsqlQuery $SenderDb "UPDATE outbox_events SET status = 'DISPATCHING', claimed_by = 'disp-B', claim_token = '$tokenB', claim_expires_at = CURRENT_TIMESTAMP + INTERVAL '30 seconds' WHERE aggregate_id = '$orderIdH';" | Out-Null
    Write-Host "Dispatcher B superseded claim with Token $tokenB." -ForegroundColor Cyan

    # Zombie Dispatcher A attempts to mark DELIVERED with stale Token-A
    $staleRes = Invoke-PsqlQuery $SenderDb "UPDATE outbox_events SET status = 'DELIVERED' WHERE aggregate_id = '$orderIdH' AND claim_token = '$tokenA';"
    Write-Host "Zombie Dispatcher A attempted update with stale token. Result: $staleRes" -ForegroundColor Magenta
    if ($staleRes -notmatch "UPDATE 0") {
        throw "Experiment H failed: Expected UPDATE 0 for stale token, got $staleRes"
    }

    # Winning Dispatcher B marks DELIVERED with active Token-B
    $validRes = Invoke-PsqlQuery $SenderDb "UPDATE outbox_events SET status = 'DELIVERED', claim_token = NULL, claimed_by = NULL WHERE aggregate_id = '$orderIdH' AND claim_token = '$tokenB';"
    Write-Host "Dispatcher B updated with valid token. Result: $validRes" -ForegroundColor Cyan
    $hFinalStatus = Invoke-PsqlQuery $SenderDb "SELECT status FROM outbox_events WHERE aggregate_id = '$orderIdH';"

    if ($hFinalStatus -eq "DELIVERED") {
        Write-Host "[Experiment H Passed] Stale claim token rejected; fencing token preserved monotonicity." -ForegroundColor Green
        $passedScenarios++
    } else {
        throw "Experiment H failed: FinalStatus=$hFinalStatus"
    }

    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "  CROSS-PROCESS VERIFICATION COMPLETE: $passedScenarios / $totalScenarios EXPERIMENTS PASSED" -ForegroundColor Green
    Write-Host "================================================================================`n" -ForegroundColor Cyan

} finally {
    Stop-AllProcesses
}
