# QueueForge V2 — Video Publishing, Sharing & Career Integration Guide

**Document Identifier:** `QF-PORTFOLIO-PUBLISHING-GUIDE`  
**Classification:** Distribution & Career Collateral Integration  
**Target Audience:** Recruiters, Engineering Managers, Distributed Systems Leads  

---

## 1. Hosting Options for Zero-Cost Public Video Sharing

To share your 3-minute technical walkthrough without paid hosting or server overhead, use one of the following industry-standard platforms:

### Option 1: YouTube (Unlisted) — *Recommended for Recruiters*
- **Why it works best:** Fast multi-device streaming, high-definition 1080p playback, instant loading on mobile, built-in chapter navigation, and zero bandwidth throttling.
- **Privacy Setting:** **Unlisted**. Anyone with the link can watch; it will *not* appear in public search results or your channel feed.
- **Upload Instructions:**
  1. Go to [studio.youtube.com](https://studio.youtube.com).
  2. Click **Create** → **Upload Videos** and select your `.mp4` file.
  3. Set Title: `QueueForge V2 — Distributed Systems Architecture Walkthrough (3-Min Demo)`
  4. Paste the Video Description and Chapter Timestamps (see Section 2 below).
  5. Under **Audience**, select "No, it's not made for kids".
  6. Under **Visibility**, select **Unlisted**.
  7. Copy your video URL (e.g., `https://youtu.be/EXAMPLE_ID`).

### Option 2: Google Drive Share Link
- **Why it works:** Convenient if you already manage job application documents in Google Drive.
- **Privacy Setting:** Share permissions set to **"Anyone with the link can view"**.
- **Upload Instructions:**
  1. Upload `QueueForge_V2_Technical_Walkthrough.mp4` to your Google Drive.
  2. Right-click the file → **Share** → **Share**.
  3. Under General access, change from "Restricted" to **"Anyone with the link"** with role **"Viewer"**.
  4. Copy the link.
  5. *Test:* Paste the link into an Incognito browser window to confirm it plays immediately without requesting a Google login.

### Option 3: LinkedIn Featured Media
- **Why it works:** Direct recruiter visibility when technical recruiters review your LinkedIn profile.
- **Instructions:**
  1. Navigate to your LinkedIn profile.
  2. Scroll to the **Featured** section (click **Add profile section** → **Recommended** → **Add featured** if not yet visible).
  3. Click the **+** button → **Add media** or **Add a link**.
  4. If adding media: upload your MP4 directly.
  5. If adding a link: paste your Unlisted YouTube URL.
  6. Title: `QueueForge V2: 3-Minute Distributed Systems Architecture Walkthrough`
  7. Description: Copy the summary text from Section 2 below.

---

## 2. Standard Video Description & Chapter Template

Copy and paste this structured metadata into your YouTube or video description:

```text
QueueForge V2 is an ACID-durable distributed task processing platform and transactional outbox engine built with Java 21, Spring Boot 3, and PostgreSQL 16.

This 3-minute technical walkthrough demonstrates:
1. Contention-free concurrent worker claiming via PostgreSQL SELECT FOR UPDATE SKIP LOCKED
2. Starvation-resistant multi-tenant scheduling via Deficit Round Robin (DRR)
3. Cryptographic lease fencing preventing zombie worker split-brain writes
4. Atomic domain events and durable inbox deduplication (Transactional Outbox)
5. Comprehensive test suite: 264 automated tests across 7 GitHub Actions CI jobs

CHAPTER TIMESTAMPS:
0:00 - Problem Statement & 7-Service Architecture
0:25 - Obsidian Pulse Real-Time Operational Dashboard
0:50 - Distributed Workers, SKIP LOCKED & Lease Fencing
1:20 - FairShare Deficit Round Robin Benchmark (89.8% Latency Reduction)
1:50 - Transactional Outbox Pattern & Durable Inbox Deduplication
2:15 - Dead-Letter Queue & Authenticated Failure Recovery
2:40 - 264 Automated Tests & Open-Source Closing

Repository & Architecture Specs:
https://github.com/saipranav22-commits/queueforge

Author: Sai Pranav
Engineering Focus: Distributed Systems, Java/Spring Boot, Backend Platforms
```

---

## 3. Resume Placement Guidance

Place the video link prominently alongside the GitHub repository in your resume to maximize recruiter engagement.

### Format A: In Project Header (Clean & Direct)
```text
QueueForge V2 — Distributed Job Platform [GitHub | 3-Min Architecture Video]
Java 21, Spring Boot 3, PostgreSQL 16, React 19, Docker, GitHub Actions
• Architected an ACID-durable multi-tenant task queue using PostgreSQL SELECT FOR UPDATE SKIP LOCKED, eliminating external broker dependencies (Kafka/RabbitMQ) with 2 independent worker instances.
• Engineered FairShare Deficit Round Robin (DRR) scheduler, reducing quiet-tenant median queue wait by 89.8% (11.8s to 1.2s) under a 1,080-job noisy-neighbor benchmark while preventing starvation.
• Implemented Transactional Outbox pattern with atomic dual-writes and SHA-256 inbox deduplication, guaranteeing zero ghost records or double-processing during network retries.
• Established CI/CD pipeline executing 264 automated tests (unit, integration, Playwright E2E) and 8 Docker smoke stages across 7 parallel GitHub Actions workflows.
```

### Format B: Hyperlinked Action Callout
If your resume format supports clickable PDF hyperlinks:
> *Watch the 3-Minute Technical Walkthrough: [youtu.be/YOUR_LINK_HERE](https://github.com/saipranav22-commits/queueforge)*

---

## 4. GitHub README Integration

Once the video is published, embed a prominent banner in the root `README.md` right beneath the project badges:

```markdown
[![Watch QueueForge V2 Architecture Walkthrough](https://img.shields.io/badge/Demo_Video-3--Min_Architecture_Walkthrough-red?style=for-the-badge&logo=youtube)](https://youtu.be/YOUR_VIDEO_ID)
```

Or use an interactive screenshot card:

```markdown
[<img src="docs/screenshots/01_overview_dashboard.png" width="700" alt="Watch 3-Min Architecture Walkthrough"/>](https://youtu.be/YOUR_VIDEO_ID)
*Click above to watch the 3-minute evidence-based architecture and telemetry walkthrough.*
```

---

## 5. Pre-Sharing Verification Checklist

Before sending application links to recruiters:
- [ ] Test video link in a Private / Incognito browser window without being logged in.
- [ ] Verify playback starts within 2 seconds without buffering.
- [ ] Check mobile viewing: open on a smartphone and ensure all architecture diagrams and metrics are readable.
- [ ] Confirm video audio is clear and audible on default laptop speakers.
- [ ] Confirm GitHub repository link in video description works and points to `https://github.com/saipranav22-commits/queueforge`.
