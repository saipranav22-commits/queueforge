#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Non-Destructive Backup Restoration Test Script
# Verifies database backup integrity in ephemeral scratch containers
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/queueforge/backups}"

echo "================================================================="
echo " QueueForge V2 — Non-Destructive Restore Test"
echo "================================================================="

# Find latest backups
LATEST_SENDER=$(find "${BACKUP_DIR}" -name "sender_db_*.sql.gz" | sort | tail -n 1 || true)
LATEST_RECEIVER=$(find "${BACKUP_DIR}" -name "receiver_db_*.sql.gz" | sort | tail -n 1 || true)

if [[ -z "$LATEST_SENDER" || -z "$LATEST_RECEIVER" ]]; then
    echo "[ERROR] Could not find both sender and receiver backup files in ${BACKUP_DIR}." >&2
    exit 1
fi

echo "Testing Sender backup:   ${LATEST_SENDER}"
echo "Testing Receiver backup: ${LATEST_RECEIVER}"

TEST_NETWORK="qf-restore-test-net"
docker network create "${TEST_NETWORK}" >/dev/null 2>&1 || true

cleanup() {
    echo "Cleaning up ephemeral test containers and network..."
    docker rm -f qf-restore-test-sender qf-restore-test-receiver >/dev/null 2>&1 || true
    docker network rm "${TEST_NETWORK}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 1. Test Sender DB Restore
echo "[1/2] Launching ephemeral PostgreSQL container for Sender DB restore..."
docker run -d --name qf-restore-test-sender \
    --network "${TEST_NETWORK}" \
    -e POSTGRES_DB=queueforge \
    -e POSTGRES_USER=queueforge_app \
    -e POSTGRES_PASSWORD=test_restore_password \
    postgres:16.8-alpine >/dev/null

echo "Waiting for test sender container to become ready..."
until docker exec qf-restore-test-sender pg_isready -U queueforge_app -d queueforge >/dev/null 2>&1; do
    sleep 2
done

echo "Restoring ${LATEST_SENDER} into ephemeral test database..."
gunzip -c "${LATEST_SENDER}" | docker exec -i qf-restore-test-sender psql -U queueforge_app -d queueforge >/dev/null
TABLE_COUNT=$(docker exec qf-restore-test-sender psql -U queueforge_app -d queueforge -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "  ✓ Sender restore successful. Table count: $(echo "${TABLE_COUNT}" | tr -d ' ')"

# 2. Test Receiver DB Restore
echo "[2/2] Launching ephemeral PostgreSQL container for Receiver DB restore..."
docker run -d --name qf-restore-test-receiver \
    --network "${TEST_NETWORK}" \
    -e POSTGRES_DB=queueforge_payment_receiver \
    -e POSTGRES_USER=queueforge_app \
    -e POSTGRES_PASSWORD=test_restore_password \
    postgres:16.8-alpine >/dev/null

echo "Waiting for test receiver container to become ready..."
until docker exec qf-restore-test-receiver pg_isready -U queueforge_app -d queueforge_payment_receiver >/dev/null 2>&1; do
    sleep 2
done

echo "Restoring ${LATEST_RECEIVER} into ephemeral test database..."
gunzip -c "${LATEST_RECEIVER}" | docker exec -i qf-restore-test-receiver psql -U queueforge_app -d queueforge_payment_receiver >/dev/null
RECV_TABLES=$(docker exec qf-restore-test-receiver psql -U queueforge_app -d queueforge_payment_receiver -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "  ✓ Receiver restore successful. Table count: $(echo "${RECV_TABLES}" | tr -d ' ')"

echo "================================================================="
echo " [SUCCESS] Both database backups verified healthy and restorable!"
echo "================================================================="
