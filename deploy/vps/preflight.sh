#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Preflight Verification Script
# Validates host readiness, environment configuration, and security gates
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

echo "================================================================="
echo " QueueForge V2 — Deployment Preflight Verification"
echo "================================================================="

FAILED=0

# 1. Verify Docker and Compose
echo -n "[1/7] Checking Docker and Compose plugins... "
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    echo "OK ($(docker --version), $(docker compose version --short))"
else
    echo "FAILED"
    echo "  [ERROR] docker or docker compose is not installed or not in PATH."
    FAILED=1
fi

# 2. Verify Available Memory & Swap
echo -n "[2/7] Checking system memory and swap... "
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
if [[ $TOTAL_RAM_MB -ge 3500 ]]; then
    echo "OK (RAM: ${TOTAL_RAM_MB} MB, Swap: ${TOTAL_SWAP_MB} MB)"
else
    echo "WARNING"
    echo "  [WARN] Total RAM (${TOTAL_RAM_MB} MB) is below recommended 4 GB. Ensure swap is active."
fi

# 3. Verify Disk Space (Need >= 10 GB free)
echo -n "[3/7] Checking available disk space... "
FREE_DISK_GB=$(df -BG "${PROJECT_ROOT}" | awk 'NR==2 {gsub("G","",$4); print $4}')
if [[ $FREE_DISK_GB -ge 10 ]]; then
    echo "OK (${FREE_DISK_GB} GB available)"
else
    echo "FAILED"
    echo "  [ERROR] Insufficient disk space: ${FREE_DISK_GB} GB available (minimum 10 GB required)."
    FAILED=1
fi

# 4. Verify .env Existence and Permissions
echo -n "[4/7] Checking production .env file... "
if [[ -f .env ]]; then
    PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%OLp" .env 2>/dev/null || echo "unknown")
    if [[ "$PERMS" == "600" || "$PERMS" == "400" ]]; then
        echo "OK (Permissions: ${PERMS})"
    else
        echo "WARNING"
        echo "  [WARN] .env permissions are ${PERMS}. Recommend: chmod 600 .env"
    fi
else
    echo "FAILED"
    echo "  [ERROR] .env file not found in ${PROJECT_ROOT}."
    echo "  Run: cp .env.production.example .env && chmod 600 .env"
    FAILED=1
fi

# 5. Verify Mandatory Production Secrets in .env
echo -n "[5/7] Checking required cryptographic secrets in .env... "
if [[ -f .env ]]; then
    set +e
    DB_PASS=$(grep -E '^DB_PASSWORD=' .env | cut -d '=' -f2-)
    ADMIN_KEY=$(grep -E '^ADMIN_API_KEY=' .env | cut -d '=' -f2-)
    RECV_KEY=$(grep -E '^RECEIVER_SERVICE_KEY=' .env | cut -d '=' -f2-)
    set -e

    if [[ -z "$DB_PASS" || "$DB_PASS" == *"REPLACE_"* || ${#DB_PASS} -lt 16 ]]; then
        echo "FAILED"
        echo "  [ERROR] DB_PASSWORD is missing, placeholder, or too short (< 16 chars)."
        FAILED=1
    elif [[ -z "$ADMIN_KEY" || "$ADMIN_KEY" == *"REPLACE_"* || ${#ADMIN_KEY} -lt 32 ]]; then
        echo "FAILED"
        echo "  [ERROR] ADMIN_API_KEY is missing, placeholder, or too short (< 32 chars)."
        FAILED=1
    elif [[ -z "$RECV_KEY" || "$RECV_KEY" == *"REPLACE_"* || ${#RECV_KEY} -lt 32 ]]; then
        echo "FAILED"
        echo "  [ERROR] RECEIVER_SERVICE_KEY is missing, placeholder, or too short (< 32 chars)."
        FAILED=1
    else
        echo "OK (Cryptographic secrets configured with sufficient entropy)"
    fi
fi

# 6. Validate Compose Syntax (Zero Output on Success)
echo -n "[6/7] Validating docker-compose.prod.v2.yml schema... "
if docker compose -f docker-compose.prod.v2.yml config --quiet 2>/dev/null; then
    echo "OK (Compose schema and variable interpolation valid)"
else
    echo "FAILED"
    echo "  [ERROR] docker-compose.prod.v2.yml syntax or variable validation failed:"
    docker compose -f docker-compose.prod.v2.yml config --quiet || true
    FAILED=1
fi

# 7. Check Loopback Port Availability (8088)
echo -n "[7/7] Checking loopback port 8088 availability... "
if ! ss -tuln 2>/dev/null | grep -q ':8088 '; then
    echo "OK (Port 8088 is free)"
else
    echo "WARNING"
    echo "  [WARN] Port 8088 is already bound. Check existing services: ss -tuln | grep 8088"
fi

echo "================================================================="
if [[ $FAILED -eq 0 ]]; then
    echo " [SUCCESS] All preflight checks passed. Host is ready for deployment."
    exit 0
else
    echo " [FAILED] Preflight checks failed. Correct errors before deploying." >&2
    exit 1
fi
