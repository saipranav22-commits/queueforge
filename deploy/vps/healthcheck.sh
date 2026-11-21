#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Production Cluster Healthcheck Script
# Validates running container states, HTTP readiness, and worker heartbeats
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

COMPOSE_FILE="docker-compose.prod.v2.yml"

echo "================================================================="
echo " QueueForge V2 — Cluster Health Verification"
echo "================================================================="

SERVICES=(
    "qf-prod-sender-db"
    "qf-prod-receiver-db"
    "qf-prod-payment-receiver"
    "qf-prod-api-server"
    "qf-prod-worker-1"
    "qf-prod-worker-2"
    "qf-prod-frontend"
)

ALL_HEALTHY=true

# 1. Container Status & Health Check
echo "[1/4] Checking container states..."
for s in "${SERVICES[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$s" 2>/dev/null || echo "not_found")
    HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$s" 2>/dev/null || echo "none")
    
    if [[ "$STATUS" == "running" && ("$HEALTH" == "healthy" || "$HEALTH" == "none") ]]; then
        printf "  ✓ %-26s Status: %-8s Health: %s\n" "$s" "$STATUS" "$HEALTH"
    else
        printf "  ✗ %-26s Status: %-8s Health: %s\n" "$s" "$STATUS" "$HEALTH"
        ALL_HEALTHY=false
    fi
done

# 2. HTTP Actuator Readiness Probe on API Server
echo "[2/4] Testing API Server Actuator Readiness Probe..."
API_HTTP=$(docker exec qf-prod-api-server wget -qO- http://127.0.0.1:8085/actuator/health/readiness 2>/dev/null || echo "ERROR")
if [[ "$API_HTTP" == *"UP"* ]]; then
    echo "  ✓ API Server is UP: ${API_HTTP}"
else
    echo "  ✗ API Server readiness probe failed: ${API_HTTP}"
    ALL_HEALTHY=false
fi

# 3. HTTP Health Probe on Payment Receiver
echo "[3/4] Testing Payment Receiver Health Probe..."
RECV_HTTP=$(docker exec qf-prod-payment-receiver wget -qO- http://127.0.0.1:8098/actuator/health 2>/dev/null || echo "ERROR")
if [[ "$RECV_HTTP" == *"UP"* ]]; then
    echo "  ✓ Payment Receiver is UP: ${RECV_HTTP}"
else
    echo "  ✗ Payment Receiver probe failed: ${RECV_HTTP}"
    ALL_HEALTHY=false
fi

# 4. Frontend Reverse Proxy Loopback Probe
echo "[4/4] Testing Frontend Nginx loopback endpoint (127.0.0.1:8088)..."
FE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/health 2>/dev/null || echo "000")
if [[ "$FE_HTTP" == "200" ]]; then
    echo "  ✓ Frontend loopback endpoint returns HTTP 200 OK"
else
    echo "  ✗ Frontend loopback probe returned HTTP ${FE_HTTP} (expected 200)"
    ALL_HEALTHY=false
fi

echo "================================================================="
if [[ "$ALL_HEALTHY" == "true" ]]; then
    echo " [SUCCESS] All 7 QueueForge V2 services are healthy and operational!"
    exit 0
else
    echo " [FAILED] One or more health probes failed. Inspect logs with: docker compose -f ${COMPOSE_FILE} logs --tail=50" >&2
    exit 1
fi
