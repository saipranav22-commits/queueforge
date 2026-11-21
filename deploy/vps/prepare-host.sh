#!/usr/bin/env bash
# ==============================================================================
# QueueForge V2 — Host System Preparation Script
# Target: Ubuntu 22.04 / 24.04 LTS (x86_64)
# ==============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
   echo "[ERROR] This script must be run as root (or via sudo)." >&2
   exit 1
fi

echo "================================================================="
echo " QueueForge V2 — Host Preparation"
echo "================================================================="

# 1. Update and Upgrade System Packages
echo "[1/6] Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl wget git jq ufw gzip openssl ca-certificates gnupg lsb-release

# 2. Configure UFW Firewall (Least-Privilege)
echo "[2/6] Configuring UFW firewall rules..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Let'\''s Encrypt & Redirect)'
ufw allow 443/tcp comment 'HTTPS (TLS Public Traffic)'
# Ensure database and backend ports are explicitly blocked from external interfaces
ufw status verbose
ufw --force enable

# 3. Configure 2 GB Swap Space (Essential Buffer for 4 GB RAM VPS)
echo "[3/6] Configuring 2 GB swapfile for memory pressure protection..."
if ! grep -q '/swapfile' /etc/fstab; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.d/99-queueforge.conf
    sysctl vm.vfs_cache_pressure=50
    echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.d/99-queueforge.conf
    echo "  -> Swapfile created and swappiness set to 10."
else
    echo "  -> Swapfile already configured. Skipping."
fi

# 4. Install Docker Engine & Docker Compose Plugin
echo "[4/6] Installing official Docker CE and Compose plugin..."
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
      
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "  -> Docker Engine installed: $(docker --version)"
else
    echo "  -> Docker already installed: $(docker --version)"
fi

# 5. Install Caddy for Automated TLS Termination
echo "[5/6] Installing Caddy reverse proxy for automated HTTPS..."
if ! command -v caddy &>/dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy
    systemctl enable caddy
    echo "  -> Caddy installed: $(caddy version)"
else
    echo "  -> Caddy already installed: $(caddy version)"
fi

# 6. Configure Deployment Directory and Ownership
echo "[6/6] Creating deployment root /opt/queueforge..."
mkdir -p /opt/queueforge/backups
mkdir -p /opt/queueforge/logs
chmod 750 /opt/queueforge

echo "================================================================="
echo " [SUCCESS] Host preparation complete!"
echo " Next step: Copy project files and run deploy/vps/preflight.sh"
echo "================================================================="
