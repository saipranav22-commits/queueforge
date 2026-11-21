#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — VPS Deployment Execution Script
# Builds/Pulls images and brings up the 7-service production topology safely
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

COMPOSE_FILE="docker-compose.prod.v2.yml"

echo "================================================================="
echo " QueueForge V2 — Production Deployment"
echo "================================================================="

# Step 1: Run Preflight Checks
echo "[Step 1/5] Running preflight verification..."
"${SCRIPT_DIR}/preflight.sh"

# Step 2: Build / Pull Container Images
echo "[Step 2/5] Building or pulling container images..."
# Note: Building sequentially to avoid memory spikes on low-RAM VPS
docker compose -f "${COMPOSE_FILE}" build --pull api-server
docker compose -f "${COMPOSE_FILE}" build payment-receiver
docker compose -f "${COMPOSE_FILE}" build frontend

# Step 3: Start Core Databases First
echo "[Step 3/5] Starting database tiers (sender-db, receiver-db)..."
docker compose -f "${COMPOSE_FILE}" up -d sender-db receiver-db

echo "Waiting for PostgreSQL instances to pass healthchecks..."
timeout 60s bash -c "
until docker compose -f '${COMPOSE_FILE}' ps sender-db | grep -q 'healthy' && \
      docker compose -f '${COMPOSE_FILE}' ps receiver-db | grep -q 'healthy'; do
    sleep 3
done"
echo "  -> Both databases report healthy."

# Step 4: Start Ingestion API and Payment Receiver
echo "[Step 4/5] Starting api-server and payment-receiver..."
docker compose -f "${COMPOSE_FILE}" up -d payment-receiver api-server

echo "Waiting for api-server and payment-receiver healthchecks..."
timeout 90s bash -c "
until docker compose -f '${COMPOSE_FILE}' ps api-server | grep -q 'healthy' && \
      docker compose -f '${COMPOSE_FILE}' ps payment-receiver | grep -q 'healthy'; do
    sleep 3
done"
echo "  -> API and Payment Receiver report healthy."

# Step 5: Start Worker Fleet and Frontend Console
echo "[Step 5/5] Starting worker fleet (worker-1, worker-2) and frontend..."
docker compose -f "${COMPOSE_FILE}" up -d worker-1 worker-2 frontend

echo "================================================================="
echo " Verifying entire cluster status..."
docker compose -f "${COMPOSE_FILE}" ps
echo "================================================================="

# Run post-deploy health check
"${SCRIPT_DIR}/healthcheck.sh"
