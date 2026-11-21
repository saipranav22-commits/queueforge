#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Safe Demonstration Data Seeding Script
# Populates synthetic demonstration tenants, jobs, outbox events, and DLQ records
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

# 1. Provision Demo Tenants
echo "[1/4] Provisioning synthetic demonstration tenants..."
curl -s -X POST "${API_URL}/api/v1/admin/tenants" \
    -H "X-Admin-Key: ${ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "tenant-fintech",
        "name": "NovaPay Global (FinTech)",
        "weight": 3,
        "maxConcurrency": 4
    }' >/dev/null || true

curl -s -X POST "${API_URL}/api/v1/admin/tenants" \
    -H "X-Admin-Key: ${ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "tenant-ecommerce",
        "name": "Starlight Retail (E-Commerce)",
        "weight": 1,
        "maxConcurrency": 2
    }' >/dev/null || true

echo "  ✓ Provisioned NovaPay Global (weight=3) and Starlight Retail (weight=1)"

# 2. Submit Sample Jobs across Priorities
echo "[2/4] Submitting sample synthetic workloads..."
for i in {1..5}; do
    curl -s -X POST "${API_URL}/api/v1/jobs" \
        -H "X-Tenant-Key: default" \
        -H "Content-Type: application/json" \
        -d "{
            \"jobType\": \"PAYMENT_SETTLEMENT\",
            \"priority\": 1,
            \"payload\": {\"demo\": true, \"batch\": $i, \"amount\": 150.00, \"currency\": \"USD\"}
        }" >/dev/null || true
done

for i in {1..3}; do
    curl -s -X POST "${API_URL}/api/v1/jobs" \
        -H "X-Tenant-Key: default" \
        -H "Content-Type: application/json" \
        -d "{
            \"jobType\": \"INVOICE_GENERATION\",
            \"priority\": 2,
            \"payload\": {\"demo\": true, \"account\": \"ACC-$i\"}
        }" >/dev/null || true
done

echo "  ✓ Submitted 8 demonstration jobs across priority queues."

# 3. Trigger Outbox Dispatch Sweep
echo "[3/4] Triggering transactional outbox event delivery sweep..."
curl -s -X POST "${API_URL}/api/v1/admin/outbox/dispatch?batchSize=10&leaseDurationSeconds=10" \
    -H "X-Admin-Key: ${ADMIN_KEY}" >/dev/null || true
echo "  ✓ Outbox event dispatch sweep complete."

# 4. Verify Anonymous Read-Only Demo Access
echo "[4/4] Verifying anonymous read-only access to demonstration telemetry..."
DLQ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/admin/dlq")
OUTBOX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/admin/outbox/stats")
TENANTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/admin/tenants")

echo "  Anonymous DLQ summary status:    HTTP ${DLQ_STATUS}"
echo "  Anonymous Outbox stats status:   HTTP ${OUTBOX_STATUS}"
echo "  Anonymous Tenants status:        HTTP ${TENANTS_STATUS}"

echo "================================================================="
echo " [SUCCESS] Demonstration data successfully seeded!"
echo "================================================================="
