# QueueForge V2 — VPS Hosting Research & Operating Cost Comparison

**Author:** Principal Cloud Infrastructure Architect & DevOps Lead  
**Date:** November 2026  
**Status:** APPROVED FOR OPERATOR DECISION  
**Target Architecture:** 7 Docker containers (~2.3 GB configured memory ceiling, 2 vCPUs)  

---

## 1. Executive Summary

QueueForge V2 (Obsidian Pulse) requires a dedicated Linux host capable of running 7 Docker containers:
- 2 PostgreSQL instances (`sender-db`, `receiver-db`)
- 3 Java 21 Spring Boot JVMs (`api-server`, `worker-1`, `worker-2`)
- 1 Spring Boot Payment Receiver JVM (`payment-receiver`)
- 1 Nginx Reverse Proxy & UI container (`frontend`)

A minimum configuration of **2 vCPUs and 4 GB RAM** is required to run the runtime cluster comfortably with an active 2 GB swapfile. Based on current official cloud pricing, **Hetzner Cloud (CX23)** provides the highest price-to-performance ratio at **~€5.49/month ($6.00 USD/month)**, representing a **75% cost savings** over DigitalOcean's comparable $24.00/month droplet.

---

## 2. Itemized Provider Comparison Matrix

| Specification / Attribute | **Hetzner Cloud (CX23)** *(Recommended)* | **DigitalOcean (Basic Droplet)** | **Linode / Akamai (Shared 4GB)** |
| :--- | :--- | :--- | :--- |
| **vCPU** | **2 vCPUs** (Shared x86) | **2 vCPUs** (Shared AMD/Intel) | **2 vCPUs** (Shared) |
| **Memory (RAM)** | **4 GB** | **4 GB** | **4 GB** |
| **Disk Storage** | **40 GB NVMe SSD** | **80 GB SSD** | **80 GB SSD** |
| **Included Bandwidth** | **20 TB / month** | **4 TB / month** | **4 TB / month** |
| **Base Monthly Cost** | **€5.49 / mo** (~$6.00 USD) | **$24.00 / mo** | **$24.00 / mo** |
| **Hourly Rate** | **€0.009 / hr** | **$0.0357 / hr** | **$0.036 / hr** |
| **Primary IPv4 Address** | Included / €0.50/mo depending on location | Included in base Droplet | Included in base Linode |
| **Automated Backups** | **+20% base** (~€1.10 / mo) | **+20% base** (+$4.80 / mo) | **+$5.00 / mo** |
| **Snapshots** | **€0.012 / GB / mo** | **$0.06 / GB / mo** | **$0.05 / GB / mo** |
| **Applicable Regions** | Germany (FSN1, NBG1), Finland (HEL1), USA (Ashburn, Hillsboro) | NYC, SFO, AMS, FRA, LON, SGP, BLR | Newark, Atlanta, Frankfurt, London, Tokyo |
| **Server Shutdown Billing** | **Billed while stopped** (CPU/RAM/Disk slots reserved) | **Billed while stopped** (Hypervisor slot reserved) | **Billed while stopped** (Slot reserved) |
| **Payment Methods** | Credit Card, PayPal, SEPA | Credit Card, PayPal, Google Pay | Credit Card, PayPal |

---

## 3. Financial Ceiling & Itemized Monthly Budget

### Recommended Configuration: Hetzner Cloud CX23 (Falkenstein or Ashburn)

```text
Item                                          Monthly Cost (USD)
──────────────────────────────────────────────────────────────────
Hetzner CX23 (2 vCPU, 4 GB RAM, 40 GB NVMe)       $6.00
Primary IPv4 (if applicable)                      $0.55
Automated Host Backups (20% add-on)               $1.20
Custom Domain (e.g. .xyz / .dev amortized)        $1.00 - $1.25
──────────────────────────────────────────────────────────────────
TOTAL MONTHLY OPERATING CEILING:                  $8.75 - $9.00 USD
```

### Alternative Configuration: DigitalOcean 2 vCPU / 4 GB Droplet (NYC3 or FRA1)

```text
Item                                          Monthly Cost (USD)
──────────────────────────────────────────────────────────────────
Basic Droplet (2 vCPU, 4 GB RAM, 80 GB SSD)      $24.00
DigitalOcean Automated Backups (20% add-on)       $4.80
Custom Domain amortized                           $1.00 - $1.25
──────────────────────────────────────────────────────────────────
TOTAL MONTHLY OPERATING CEILING:                 $29.80 - $30.05 USD
```

---

## 4. Key Operational Insights & Constraints

1. **Shutdown Billing Behavior:**
   On both Hetzner and DigitalOcean, **shutting down the operating system via `halt` or powering down the VM does NOT stop billing**. Providers bill for the allocated hypervisor slice, IP address, and NVMe disk until the server is explicitly **destroyed / deleted**.
2. **Local Build vs. Registry Pulls:**
   Building Maven and Node.js artifacts directly on a 4 GB VPS will exhaust system memory. The recommended deployment strategy relies on building container images in GitHub Actions and publishing them to GitHub Container Registry (`ghcr.io`), so the VPS performs only lightweight `docker compose pull` operations.
3. **Swapfile Requirement:**
   Even though container memory limits total ~2.3 GB, a **2 GB host swapfile** (`vm.swappiness=10`) is mandatory to absorb temporary buffer cache spikes during database checkpointing and container restarts.
