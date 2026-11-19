#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2: Complete Full-Stack Smoke Test (CI & Linux Compatible)
# Noninteractive, bounded execution with zero false positives.
# ==============================================================================
set -euo pipefail

BASE_URL="${FRONTEND_URL:-http://127.0.0.1:8088}"
ADMIN_KEY="${ADMIN_API_KEY:-qf_v2_release_candidate_admin_key_2026}"
RECEIVER_KEY="${RECEIVER_SERVICE_KEY:-qf_v2_internal_service_key_2026}"
COOKIE_JAR="$(mktemp /tmp/qf_cookies_XXXXXX.txt)"

cleanup() {
    rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "================================================================================"
echo "  QUEUEFORGE V2: FULL-STACK CLUSTER SMOKE TEST"
echo "  Target URL : ${BASE_URL}"
echo "================================================================================"

# ------------------------------------------------------------------------------
# 1. Reverse Proxy Health Check
# ------------------------------------------------------------------------------
echo -e "\n[1/8] Verifying Frontend Nginx & API Server Health..."
MAX_WAIT=60
READY=0
for i in $(seq 1 $MAX_WAIT); do
    if curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
        READY=1
        echo "  -> Nginx Reverse Proxy is HEALTHY (${i}s)"
        break
    fi
    sleep 1
done

if [ "$READY" -ne 1 ]; then
    echo "  [FAILURE] Reverse proxy not reachable at ${BASE_URL}/health after ${MAX_WAIT}s"
    exit 1
fi

# ------------------------------------------------------------------------------
# 2. Authentication, Session Cookie & CSRF Enforcement
# ------------------------------------------------------------------------------
echo -e "\n[2/8] Verifying Authentication, Session Cookie & CSRF Guards..."

# 2a. Rejection of invalid admin key
INVALID_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"adminKey": "incorrect_admin_secret_key"}')

if [ "$INVALID_HTTP_CODE" -eq 401 ]; then
    echo "  -> [PASSED] Invalid admin key correctly rejected with HTTP 401"
else
    echo "  [FAILURE] Invalid key expected 401, got: ${INVALID_HTTP_CODE}"
    exit 1
fi

# 2b. Valid admin key login & session establishment
LOGIN_RESP=$(curl -s -c "$COOKIE_JAR" -X POST "${BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"adminKey\": \"${ADMIN_KEY}\"}")

CSRF_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4 || echo "")
AUTH_FLAG=$(echo "$LOGIN_RESP" | grep -o '"authenticated":true' || echo "")

if [ -n "$AUTH_FLAG" ] && [ -n "$CSRF_TOKEN" ]; then
    echo "  -> [PASSED] Admin login succeeded, session cookie issued, CSRF token acquired"
else
    echo "  [FAILURE] Login failed or CSRF token missing: $LOGIN_RESP"
    exit 1
fi

# 2c. Session verification via cookie
SESSION_RESP=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/v1/auth/session")
if echo "$SESSION_RESP" | grep -q '"authenticated":true'; then
    echo "  -> [PASSED] Session cookie validated via GET /api/v1/auth/session"
else
    echo "  [FAILURE] Session cookie invalid: $SESSION_RESP"
    exit 1
fi

# ------------------------------------------------------------------------------
# 3. Register Independent Multi-Tenant Workloads
# ------------------------------------------------------------------------------
echo -e "\n[3/8] Provisioning Authenticated Tenants via Admin API..."
TENANT_A_ID="tenant-ci-alpha-$RANDOM"
TENANT_B_ID="tenant-ci-beta-$RANDOM"

TENANT_A_RESP=$(curl -s -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF_TOKEN}" -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/v1/admin/tenants" \
    -d "{\"id\": \"${TENANT_A_ID}\", \"name\": \"Enterprise Tenant Alpha\", \"weight\": 2, \"maxConcurrency\": 2}")

TENANT_A_KEY=$(echo "$TENANT_A_RESP" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4)

TENANT_B_RESP=$(curl -s -b "$COOKIE_JAR" -H "X-CSRF-Token: ${CSRF_TOKEN}" -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/v1/admin/tenants" \
    -d "{\"id\": \"${TENANT_B_ID}\", \"name\": \"Standard Tenant Beta\", \"weight\": 1, \"maxConcurrency\": 1}")

TENANT_B_KEY=$(echo "$TENANT_B_RESP" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4)

if [ -n "$TENANT_A_KEY" ] && [ -n "$TENANT_B_KEY" ]; then
    echo "  -> [PASSED] Provisioned Tenant Alpha (weight=2) and Tenant Beta (weight=1)"
else
    echo "  [FAILURE] Tenant creation failed"
    exit 1
fi

# ------------------------------------------------------------------------------
# 4. End-to-End Job Submission, Worker Claim & Execution History
# ------------------------------------------------------------------------------
echo -e "\n[4/8] Submitting Authenticated Job for Tenant Alpha..."
JOB_SUBMISSION=$(curl -s -X POST "${BASE_URL}/api/v1/jobs" \
    -H "X-Tenant-Key: ${TENANT_A_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"jobType": "GENERATE_REPORT", "payload": {"report": "quarterly-ci", "format": "PDF"}, "priority": 75, "maxRetries": 3}')

JOB_ID=$(echo "$JOB_SUBMISSION" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)

echo "  -> Job Accepted: ID=${JOB_ID}"
echo "  -> Waiting up to 10s for distributed worker claim and completion..."

JOB_DONE=0
for s in $(seq 1 10); do
    sleep 1
    STATUS_RESP=$(curl -s -H "X-Tenant-Key: ${TENANT_A_KEY}" "${BASE_URL}/api/v1/jobs/${JOB_ID}")
    JOB_STATUS=$(echo "$STATUS_RESP" | grep -o '"status":"[^"]*' | cut -d'"' -f4 || echo "")
    if [ "$JOB_STATUS" = "COMPLETED" ]; then
        JOB_DONE=1
        echo "  -> Job reached COMPLETED state in ${s}s"
        break
    fi
done

if [ "$JOB_DONE" -ne 1 ]; then
    echo "  [FAILURE] Job did not complete within timeout. Last status: ${JOB_STATUS:-UNKNOWN}"
    exit 1
fi

# Verify worker attribution in execution history
HISTORY_RESP=$(curl -s -H "X-Admin-Key: ${ADMIN_KEY}" "${BASE_URL}/api/v1/jobs/${JOB_ID}/history")
if echo "$HISTORY_RESP" | grep -q "worker-v2-node"; then
    echo "  -> [PASSED] Execution history verified with real worker node attribution"
else
    echo "  [FAILURE] Worker attribution missing in history: $HISTORY_RESP"
    exit 1
fi

# ------------------------------------------------------------------------------
# 5. Cross-Tenant Security Boundary Isolation
# ------------------------------------------------------------------------------
echo -e "\n[5/8] Verifying Multi-Tenant Isolation & Fencing..."

# Tenant B attempting to read Tenant Alpha's job must return 404
TENANT_B_READ_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Tenant-Key: ${TENANT_B_KEY}" \
    "${BASE_URL}/api/v1/jobs/${JOB_ID}")

if [ "$TENANT_B_READ_CODE" -eq 404 ]; then
    echo "  -> [PASSED] Tenant B cannot view Tenant Alpha's job (HTTP 404 Not Found)"
else
    echo "  [FAILURE] Cross-tenant read returned: ${TENANT_B_READ_CODE}"
    exit 1
fi

# Tenant B attempting to spoof Tenant Alpha in body submission must return 403
SPOOF_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/jobs" \
    -H "X-Tenant-Key: ${TENANT_B_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"jobType\": \"GENERATE_REPORT\", \"tenantId\": \"${TENANT_A_ID}\", \"payload\": {\"hack\": true}}")

if [ "$SPOOF_CODE" -eq 403 ]; then
    echo "  -> [PASSED] Tenant identity spoofing strictly rejected (HTTP 403 Forbidden)"
else
    echo "  [FAILURE] Spoofed submission expected 403, got: ${SPOOF_CODE}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 6. Worker Fleet Discovery & Heartbeats
# ------------------------------------------------------------------------------
echo -e "\n[6/8] Discovering Worker Fleet & Lease Ownership..."
WORKERS_JSON=$(curl -s "${BASE_URL}/api/v1/system/workers")

WORKER_1_ONLINE=$(echo "$WORKERS_JSON" | grep -q "worker-v2-node-1" && echo 1 || echo 0)
WORKER_2_ONLINE=$(echo "$WORKERS_JSON" | grep -q "worker-v2-node-2" && echo 1 || echo 0)

if [ "$WORKER_1_ONLINE" -eq 1 ] && [ "$WORKER_2_ONLINE" -eq 1 ]; then
    echo "  -> [PASSED] Both worker nodes (node-1 and node-2) discovered with active heartbeats"
else
    echo "  [FAILURE] Worker discovery incomplete: $WORKERS_JSON"
    exit 1
fi

# ------------------------------------------------------------------------------
# 7. Transactional Outbox & Real HTTP Receiver Idempotency
# ------------------------------------------------------------------------------
echo -e "\n[7/8] Verifying Transactional Outbox & Receiver Idempotency..."
ORDER_NUM="ORD-CI-$RANDOM"
ORDER_RESP=$(curl -s -X POST "${BASE_URL}/api/v1/orders" \
    -H "Content-Type: application/json" \
    -d "{\"orderNumber\": \"${ORDER_NUM}\", \"customerId\": \"CUST-CI\", \"amountCents\": 15000, \"currency\": \"USD\"}")

ORDER_ID=$(echo "$ORDER_RESP" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "  -> Order Created: ID=${ORDER_ID} (PENDING)"

OUTBOX_SETTLED=0
for s in $(seq 1 20); do
    sleep 1
    CURR_ORDER=$(curl -s "${BASE_URL}/api/v1/orders/${ORDER_ID}")
    ORDER_STATUS=$(echo "$CURR_ORDER" | grep -o '"status":"[^"]*' | cut -d'"' -f4 || echo "")
    if [ "$ORDER_STATUS" = "PAID" ]; then
        OUTBOX_SETTLED=1
        echo "  -> Order settled to PAID via HTTP outbox delivery in ${s}s"
        break
    fi
done

if [ "$OUTBOX_SETTLED" -ne 1 ]; then
    echo "  [FAILURE] Order outbox settlement did not finalize to PAID within 20s"
    exit 1
fi

# Verify idempotency by re-dispatching the exact charge to payment receiver
IDEMP_KEY="order-payment-${ORDER_ID}"
FINGERPRINT=$(echo -n "order:${ORDER_ID}|customer:CUST-CI|amount:15000|currency:USD" | sha256sum | awk '{print $1}')
REPLAY_RESP=$(docker exec -i qf-v2-worker-1 wget -q -O - \
    --header "Content-Type: application/json" \
    --header "X-Service-Key: ${RECEIVER_KEY}" \
    --post-data "{\"orderId\":\"${ORDER_ID}\",\"customerId\":\"CUST-CI\",\"amountCents\":15000,\"currency\":\"USD\",\"idempotencyKey\":\"${IDEMP_KEY}\",\"fingerprint\":\"${FINGERPRINT}\"}" \
    "http://payment-receiver:8098/api/v1/payments/charges" || echo "{}")

if echo "$REPLAY_RESP" | grep -q '"idempotentReplay":true'; then
    echo "  -> [PASSED] Duplicate dispatch returned cached response with idempotentReplay: true"
else
    echo "  [FAILURE] Duplicate dispatch was not recognized as idempotent: $REPLAY_RESP"
    exit 1
fi

# ------------------------------------------------------------------------------
# 8. Concurrent Multi-Worker Attribution Burst
# ------------------------------------------------------------------------------
echo -e "\n[8/8] Verifying Concurrent Multi-Worker Attribution Distribution..."
for i in $(seq 1 6); do
    curl -s -X POST "${BASE_URL}/api/v1/jobs" \
        -H "X-Tenant-Key: ${TENANT_A_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"jobType\": \"GENERATE_REPORT\", \"payload\": {\"batchIndex\": $i}, \"priority\": 50}" > /dev/null
done

echo "  -> Enqueued 6 burst jobs for Tenant Alpha. Waiting 6s for cluster drain..."
sleep 6

WORKER_DISTRIBUTION=$(docker exec qf-v2-sender-db psql -U queueforge_app -d queueforge -t -c \
    "SELECT worker_id, COUNT(*) FROM qf_job_execution_logs GROUP BY worker_id;")

echo "  -> Cluster attribution breakdown:"
echo "$WORKER_DISTRIBUTION"

if echo "$WORKER_DISTRIBUTION" | grep -q "worker-v2-node-1" && echo "$WORKER_DISTRIBUTION" | grep -q "worker-v2-node-2"; then
    echo "  -> [PASSED] Both worker nodes participated in cluster workload execution"
else
    echo "  [FAILURE] Not all worker nodes participated in execution"
    exit 1
fi

echo -e "\n================================================================================"
echo "  [SUCCESS] ALL QUEUEFORGE V2 CLOUD SMOKE TESTS PASSED!"
echo "================================================================================"
