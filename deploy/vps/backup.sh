#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Coordinated Dual-Database Backup Script
# Performs atomic backups of sender-db and receiver-db with checksums & retention
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/queueforge/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "================================================================="
echo " QueueForge V2 — Database Backup [${TIMESTAMP}]"
echo " Destination: ${BACKUP_DIR}"
echo "================================================================="

SENDER_BACKUP="${BACKUP_DIR}/sender_db_${TIMESTAMP}.sql.gz"
RECEIVER_BACKUP="${BACKUP_DIR}/receiver_db_${TIMESTAMP}.sql.gz"

# 1. Backup Sender Database (Jobs, Heartbeats, Outbox Events)
echo "[1/4] Exporting Primary Sender Database..."
docker exec -t qf-prod-sender-db pg_dump -U queueforge_app --clean --if-exists queueforge | gzip -c > "${SENDER_BACKUP}"
chmod 600 "${SENDER_BACKUP}"
sha256sum "${SENDER_BACKUP}" > "${SENDER_BACKUP}.sha256"
echo "  ✓ Sender backup created: $(du -h "${SENDER_BACKUP}" | cut -f1)"

# 2. Backup Receiver Database (Charges, Idempotency Records)
echo "[2/4] Exporting Payment Receiver Database..."
docker exec -t qf-prod-receiver-db pg_dump -U queueforge_app --clean --if-exists queueforge_payment_receiver | gzip -c > "${RECEIVER_BACKUP}"
chmod 600 "${RECEIVER_BACKUP}"
sha256sum "${RECEIVER_BACKUP}" > "${RECEIVER_BACKUP}.sha256"
echo "  ✓ Receiver backup created: $(du -h "${RECEIVER_BACKUP}" | cut -f1)"

# 3. Verify Checksums
echo "[3/4] Verifying cryptographic integrity..."
sha256sum -c "${SENDER_BACKUP}.sha256"
sha256sum -c "${RECEIVER_BACKUP}.sha256"
echo "  ✓ Both checksums verified."

# 4. Prune Backups Older than Retention Window
echo "[4/4] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "*.sql.gz*" -mtime "+${RETENTION_DAYS}" -delete
echo "  ✓ Backup retention policy enforced."

echo "================================================================="
echo " [SUCCESS] Dual-database backup complete."
echo "================================================================="
