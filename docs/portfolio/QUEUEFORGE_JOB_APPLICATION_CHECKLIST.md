# QueueForge V2 — Job Application & Portfolio Submission Checklist

**Document Identifier:** `QF-PORTFOLIO-JOB-APPLICATION-CHECKLIST`  
**Classification:** Pre-Submission Verification & Career Readiness Audit  
**Repository:** `https://github.com/saipranav22-commits/queueforge`  
**Target Roles:** Java Backend Developer, Full-Stack Software Engineer, Systems Engineer  
**Live Demo Status:** **DEFERRED / UNAVAILABLE** (Hosted deployment gated by owner; local execution via GHCR images or GitHub CI evidence)

---

## 1. Application Assets Pre-Submission Checklist

Use this checklist before submitting QueueForge V2 in off-campus job applications, ATS portals, or email outreaches to engineering hiring managers.

### A. Repository & Code Presentation
- [x] **Repository URL:** `https://github.com/saipranav22-commits/queueforge` (Public, accessible).
- [x] **Primary Branch:** `main` (Verified at commit `6f9d971b3c560aa8fb575aef86d1a806771f06a2`).
- [x] **README Integrity:** High-signal badges (CI passing, Docker, Spring Boot 3.4.1, Java 21, Vite, React 19, PostgreSQL 16).
- [x] **Link Validation:** 33 out of 33 relative links in `README.md` verified and working with zero 404s.
- [x] **Architecture Specifications:** Deep technical documentation available:
  - [`QUEUEFORGE_V2_ARCHITECTURE.md`](../architecture/QUEUEFORGE_V2_ARCHITECTURE.md) (7-service topology)
  - [`QUEUEFORGE_JOB_LIFECYCLE.md`](../architecture/QUEUEFORGE_JOB_LIFECYCLE.md) (8-state machine & fencing)
  - [`TRANSACTIONAL_OUTBOX_FLOW.md`](../architecture/TRANSACTIONAL_OUTBOX_FLOW.md) (Atomic commit & idempotency)
- [x] **Benchmark Artifact:** [`fairshare_benchmark_chart.svg`](../benchmark/fairshare_benchmark_chart.svg) demonstrating 89.8% latency reduction.
- [x] **Visual Screenshots:** 9 authentic PNG screenshots in [`docs/screenshots/`](../screenshots/).

---

### B. Automated Test & CI Verification
- [x] **Hosted GitHub Actions CI:** [Run #44935616424](https://github.com/saipranav22-commits/queueforge/actions/runs/44935616424) (100% Green).
- [x] **Backend Integration Tests:** 187 JUnit 5 tests passing against real PostgreSQL instances.
- [x] **Simulated Payment Receiver Tests:** 13 tests passing.
- [x] **Frontend Tests:** 44 Vitest unit and component tests passing.
- [x] **Browser E2E Tests:** 20 Playwright scenarios passing across desktop and mobile viewports.
- [x] **Docker Smoke Stages:** 8 multi-container cluster health and functional stages passing.
- [x] **Total Automated Test Count:** **264 automated tests** (+ 8 smoke stages across 7 CI jobs).

---

### C. Resume & Social Presence
- [x] **Resume Bullets Selected:** Selected 3 ATS-friendly bullets from [`QUEUEFORGE_FINAL_RESUME_BULLETS.md`](QUEUEFORGE_FINAL_RESUME_BULLETS.md) tailored to target role (Java Backend, Full-Stack, or SDE).
- [x] **Metric Integrity Checked:** The 89.8% latency reduction is strictly described as measured under synthetic 1,000-job flood contention with a ~21% throughput trade-off.
- [x] **Receiver Wording Checked:** The payment receiver is accurately identified as simulated.
- [x] **LinkedIn Profile Updated:** LinkedIn Featured section description copied from [`QUEUEFORGE_LINKEDIN_AND_PORTFOLIO_COPY.md`](QUEUEFORGE_LINKEDIN_AND_PORTFOLIO_COPY.md).
- [x] **Personal Website Updated:** Portfolio card description added.

---

### D. Live Demo & Video Status (Explicit Disclosures)
- [x] **Live Public Cloud Demo:** **DEFERRED / UNAVAILABLE**  
  *Disclosure:* Cloud VPS deployment is gated pending owner account setup. Local reproducibility is provided via immutable GHCR container images (`docker compose -f docker-compose.prod.v2.yml -f docker-compose.prod.ghcr.yml up -d --no-build`). Do not provide fictitious URLs.
- [ ] **Demonstration Video:** **MANUAL RECORDING PENDING**  
  *Action:* Record a 3-minute screen walkthrough following [`QUEUEFORGE_FINAL_VIDEO_SCRIPT.md`](QUEUEFORGE_FINAL_VIDEO_SCRIPT.md) using the recording guidelines below.

---

## 2. Free Windows Screen Recording Guide & Quality Checklist

Do not purchase any recording software. Excellent free tools are built into Windows or available as open source:

### Recommended Free Recording Software
1. **OBS Studio (Open Broadcaster Software):**
   - *Cost:* 100% Free, Open Source (no watermarks, no time limits).
   - *Download:* `https://obsproject.com/`
   - *Best For:* Crisp 1080p 60fps recording, customizable audio filters, noise suppression.
2. **Windows Snipping Tool (Built into Windows 11):**
   - *Cost:* Free (pre-installed).
   - *Shortcut:* Press `Windows Key + Shift + R`.
   - *Best For:* Quick, zero-install window recording.
3. **Windows Xbox Game Bar (Built into Windows 10 & 11):**
   - *Cost:* Free (pre-installed).
   - *Shortcut:* Press `Windows Key + Alt + R` to start/stop recording.
   - *Best For:* Single-window browser capture.

---

### Video Quality & Privacy Checklist
- [ ] **Display Resolution:** Set monitor to 1920x1080.
- [ ] **Browser Zoom:** Set browser zoom to 125% so UI text and code are easily legible on mobile screens.
- [ ] **Notification Hygiene:** Turn on Windows Focus Assist / Do Not Disturb.
- [ ] **Tab & Bookmark Cleanliness:** Hide the Chrome bookmarks bar (`Ctrl+Shift+B`). Close unrelated tabs, Discord, Slack, and email clients.
- [ ] **Dark Mode:** Ensure Obsidian Pulse dark mode is enabled.
- [ ] **No Secret Exposure:** Only enter demo keys (`demo_admin_api_key_2026`). Never expose actual personal emails, database passwords, or cloud credentials.
- [ ] **Audio Clarity:** Use a headset or external microphone in a quiet room. Speak at a measured, confident pace matching the 3-minute script.
- [ ] **Cursor Control:** Move the mouse smoothly to guide the viewer's eye; avoid erratic rapid circling.
- [ ] **Video File Naming:** Save the output as `queueforge-v2-demo-walkthrough.mp4`.
- [ ] **Hosting / Sharing:** Upload as an unlisted video on YouTube or Loom, and add the link to the README once recorded.

---

## 3. Interview Readiness Check
- [x] Prepared 30-second elevator pitch for recruiter phone screens.
- [x] Prepared 2-minute technical explanation for hiring manager round.
- [x] Prepared 5-minute deep distributed-systems architecture breakdown for system design rounds.
- [x] Reviewed all 16 technical Q&As in [`QUEUEFORGE_FINAL_INTERVIEW_PLAYBOOK.md`](QUEUEFORGE_FINAL_INTERVIEW_PLAYBOOK.md) (covering `SKIP LOCKED`, DRR fairness, lease fencing, outbox pattern, idempotency, and scaling considerations).
