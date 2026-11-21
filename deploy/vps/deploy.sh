#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — VPS Deployment Execution Script
# Supports both GHCR prebuilt image deployment (recommended for 4 GB VPS)
# and local image compilation. Reports deployed image digests.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

BASE_COMPOSE="docker-compose.prod.v2.yml"
GHCR_OVERRIDE="docker-compose.prod.ghcr.yml"

# Deployment mode: 'ghcr' (default, pulls prebuilt images) or 'build' (compiles locally)
DEPLOY_MODE="${DEPLOY_MODE:-ghcr}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

echo "================================================================="
echo " QueueForge V2 — Production Deployment"
echo " Mode:      ${DEPLOY_MODE}"
echo " Image Tag: ${IMAGE_TAG}"
echo "================================================================="

# Step 1: Run Preflight Checks
echo "[Step 1/5] Running preflight verification..."
"${SCRIPT_DIR}/preflight.sh"

COMPOSE_CMD=("docker" "compose" "-f" "${BASE_COMPOSE}")
if [[ "${DEPLOY_MODE}" == "ghcr" ]]; then
    COMPOSE_CMD+=("-f" "${GHCR_OVERRIDE}")
fi

# Step 2: Acquire Container Images
echo "[Step 2/5] Acquiring container images..."
if [[ "${DEPLOY_MODE}" == "ghcr" ]]; then
    echo "Pulling prebuilt container images from GitHub Container Registry (tag: ${IMAGE_TAG})..."
    "${COMPOSE_CMD[@]}" pull
else
    echo "Building container images locally (Sequential build to conserve RAM)..."
    "${COMPOSE_CMD[@]}" build api-server
    "${COMPOSE_CMD[@]}" build payment-receiver
    "${COMPOSE_CMD[@]}" build frontend
fi

# Step 3: Start Core Databases First
echo "[Step 3/5] Starting database tiers (sender-db, receiver-db)..."
"${COMPOSE_CMD[@]}" up -d sender-db receiver-db

echo "Waiting for PostgreSQL instances to pass healthchecks..."
timeout 60s bash -c "
until ${COMPOSE_CMD[*]} ps sender-db | grep -q 'healthy' && \
      ${COMPOSE_CMD[*]} ps receiver-db | grep -q 'healthy'; do
    sleep 3
done"
echo "  ✓ Both databases report healthy."

# Step 4: Start Ingestion API and Payment Receiver
echo "[Step 4/5] Starting api-server and payment-receiver..."
"${COMPOSE_CMD[@]}" up -d payment-receiver api-server

echo "Waiting for api-server and payment-receiver healthchecks..."
timeout 90s bash -c "
until ${COMPOSE_CMD[*]} ps api-server | grep -q 'healthy' && \
      ${COMPOSE_CMD[*]} ps payment-receiver | grep -q 'healthy'; do
    sleep 3
done"
echo "  ✓ API Server and Payment Receiver report healthy."

# Step 5: Start Worker Fleet and Frontend Console
echo "[Step 5/5] Starting worker fleet (worker-1, worker-2) and frontend..."
"${COMPOSE_CMD[@]}" up -d worker-1 worker-2 frontend

echo "================================================================="
echo " Verifying entire cluster status and deployed image digests..."
"${COMPOSE_CMD[@]}" ps

echo -e "\nDeployed Image Digests:"
docker inspect --format='{{.Name}}: {{.Config.Image}} (ID: {{printf "%.12s" .Image}})' \
    qf-prod-api-server qf-prod-worker-1 qf-prod-worker-2 qf-prod-payment-receiver qf-prod-frontend 2>/dev/null || true

echo "================================================================="

# Run post-deploy health check
"${SCRIPT_DIR}/healthcheck.sh"
