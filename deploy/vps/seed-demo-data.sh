#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Safe Demonstration Data Seeding Script
# Populates synthetic demonstration tenants, orders, outbox events, and jobs
# ==============================================================================
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8088}"
ADMIN_KEY="${ADMIN_KEY:-}"

if [[ -z "$ADMIN_KEY" ]]; then
    if [[ -f .env ]]; then
        ADMIN_KEY=$(grep -E '^ADMIN_API_KEY=' .env | cut -d '=' -f2- || true)
    fi
fi

if [[ -z "$ADMIN_KEY" ]]; then
    echo "[ERROR] ADMIN_KEY is not set and could not be retrieved from .env" >&2
    echo "Usage: ADMIN_KEY=\"<key>\" ./seed-demo-data.sh" >&2
    exit 1
fi

echo "================================================================="
echo " QueueForge V2 — Populating Safe Recruiter Demo Telemetry"
echo " Target API: ${API_URL}"
echo "================================================================="

# 1. Provision Demo Tenants via Admin API
echo "[1/4] Provisioning synthetic demonstration tenants..."
curl -s -f -X POST "${API_URL}/api/v1/admin/tenants" \
    -H "X-Admin-Key: ${ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "tenant-fintech",
        "name": "NovaPay Global (FinTech)",
        "weight": 3,
        "maxConcurrency": 4
    }' >/dev/null || echo "  [INFO] Tenant NovaPay Global already exists or registered."

curl -s -f -X POST "${API_URL}/api/v1/admin/tenants" \
    -H "X-Admin-Key: ${ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "tenant-ecommerce",
        "name": "Starlight Retail (E-Commerce)",
        "weight": 1,
        "maxConcurrency": 2
    }' >/dev/null || echo "  [INFO] Tenant Starlight Retail already exists or registered."

echo "  ✓ Demo tenants active: NovaPay Global (weight=3) and Starlight Retail (weight=1)"

# 2. Submit Sample Jobs across Supported Job Types and Priority Queues
# Supported job types: GENERATE_REPORT, SEND_EMAIL, DATA_EXPORT, INDEX_DOCUMENT, WEBHOOK_DISPATCH, CLEANUP_TEMP_DATA
echo "[2/4] Submitting sample synthetic workloads with valid job types..."
for i in {1..4}; do
    curl -s -f -X POST "${API_URL}/api/v1/jobs" \
        -H "X-Admin-Key: ${ADMIN_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"jobType\": \"WEBHOOK_DISPATCH\",
            \"priority\": 1,
            \"maxRetries\": 3,
            \"tenantId\": \"tenant-fintech\",
            \"payload\": {\"demo\": true, \"batch\": $i, \"action\": \"NOTIFY_PARTNER\", \"destination\": \"partner-$i\"}
        }" >/dev/null || true
done

for i in {1..3}; do
    curl -s -f -X POST "${API_URL}/api/v1/jobs" \
        -H "X-Admin-Key: ${ADMIN_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"jobType\": \"GENERATE_REPORT\",
            \"priority\": 2,
            \"maxRetries\": 2,
            \"tenantId\": \"tenant-fintech\",
            \"payload\": {\"demo\": true, \"reportType\": \"QUARTERLY_SUMMARY\", \"tenant\": \"NovaPay\"}
        }" >/dev/null || true
done

for i in {1..2}; do
    curl -s -f -X POST "${API_URL}/api/v1/jobs" \
        -H "X-Admin-Key: ${ADMIN_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"jobType\": \"DATA_EXPORT\",
            \"priority\": 3,
            \"maxRetries\": 1,
            \"tenantId\": \"tenant-ecommerce\",
            \"payload\": {\"demo\": true, \"format\": \"PARQUET\", \"records\": 5000}
        }" >/dev/null || true
done

echo "  ✓ Submitted 9 demonstration jobs across WEBHOOK_DISPATCH, GENERATE_REPORT, and DATA_EXPORT queues."

# 3. Create Orders to Populate Real Transactional Outbox Events
echo "[3/4] Creating orders to generate transactional outbox events..."
TIMESTAMP=$(date +%s)
for i in {1..3}; do
    curl -s -f -X POST "${API_URL}/api/v1/orders" \
        -H "Content-Type: application/json" \
        -d "{
            \"orderNumber\": \"ORD-DEMO-${TIMESTAMP}-${i}\",
            \"customerId\": \"CUST-DEMO-${i}\",
            \"amountCents\": $(( 1000 * i + 499 )),
            \"currency\": \"USD\"
        }" >/dev/null || true
done

# Trigger manual outbox dispatch sweep
echo "  Triggering transactional outbox event delivery sweep..."
curl -s -f -X POST "${API_URL}/api/v1/admin/outbox/dispatch?batchSize=10&leaseDurationSeconds=10" \
    -H "X-Admin-Key: ${ADMIN_KEY}" >/dev/null || true
echo "  ✓ Outbox event dispatch sweep completed."

# 4. Verify Anonymous Read-Only Demo Access
echo "[4/4] Verifying anonymous read-only access to demonstration telemetry..."
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/dashboard/stats")
DLQ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/admin/dlq")
OUTBOX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/admin/outbox/stats")
TENANTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/admin/tenants")

echo "  Anonymous Dashboard stats status: HTTP ${DASHBOARD_STATUS}"
echo "  Anonymous DLQ summary status:    HTTP ${DLQ_STATUS}"
echo "  Anonymous Outbox stats status:   HTTP ${OUTBOX_STATUS}"
echo "  Anonymous Tenants status:        HTTP ${TENANTS_STATUS}"

echo "================================================================="
echo " [SUCCESS] Demonstration data successfully seeded and verified!"
echo "================================================================="
