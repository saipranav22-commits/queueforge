# QueueForge V2 — Technical Walkthrough Recording Checklist & Operator Guide

**Document Identifier:** `QF-DEMO-RECORDING-CHECKLIST`  
**Classification:** Standard Operating Procedure for Video Capture  
**Target Duration:** Exactly 180 Seconds (3 Minutes)  
**Operating Environment:** Windows 10 / Windows 11 (Zero Docker or Cloud Dependency)  
**Deliverable File:** `docs/portfolio/demo-video/QUEUEFORGE_WALKTHROUGH_PRESENTATION.html`  

---

## 1. Pre-Recording Environment Setup (Do Once)

- [ ] **1.1 Close Unnecessary Applications:** Close email clients, Slack/Discord, and secondary development tools to free system memory and eliminate notification popups.
- [ ] **1.2 Enable Windows Focus Assist (Do Not Disturb):**
  - Open Windows Action Center (`Win + A`) or Settings → System → Focus assist.
  - Set to **Alarms only** or **Priority only** to suppress banner toasts during capture.
- [ ] **1.3 Clean Desktop & Browser Chrome:**
  - Launch Google Chrome, Microsoft Edge, or Firefox.
  - If recording within a browser window, hide the bookmarks bar (`Ctrl + Shift + B`).
  - Open the offline presentation file directly:
    ```text
    D:\Projects\QueueForge\docs\portfolio\demo-video\QUEUEFORGE_WALKTHROUGH_PRESENTATION.html
    ```
- [ ] **1.4 Audio Preflight:**
  - Connect your external headset or USB microphone (avoid built-in laptop mic to minimize fan noise).
  - Open Windows Sound Settings and verify microphone input level (aim for -12 dB to -6 dB peak).
  - Take a 10-second test recording speaking the Scene 1 intro to check volume and background echo.

---

## 2. Choosing Your Screen Recording Tool

Choose one of the following lightweight, zero-cost options already available on Windows:

### Option A: Windows Snipping Tool (Built-in)
1. Press `Win + Shift + S` or open **Snipping Tool** from the Start Menu.
2. Click the **Video Camera icon** (Record mode).
3. Click **New** and draw a rectangle over the 16:9 presentation canvas, or select fullscreen.
4. Toggle **Microphone Audio: ON** (unmuted).
5. Click **Start** (a 3-second countdown will appear).

### Option B: Windows Game Bar (Built-in)
1. Focus your browser tab with the presentation open.
2. Press `Win + G` to summon the Xbox Game Bar overlay, or press `Win + Alt + R` directly to start recording.
3. Ensure the microphone toggle in the Capture widget is set to **ON**.

### Option C: OBS Studio (If Installed)
1. Launch OBS Studio.
2. Add a **Window Capture** source targeting your browser, or **Display Capture** on your primary monitor.
3. Set base canvas and output resolution to `1920x1080` (or `1440x900` matching native assets) at 30 fps or 60 fps.
4. Set audio bitrate to 160 kbps AAC.

---

## 3. Step-by-Step Recording Sequence (180 Seconds)

- [ ] **Step 1: Enter Fullscreen in Presentation:**
  - Press <kbd>F</kbd> (or click the **⛶ Fullscreen** button in the lower control bar).
  - Ensure the stage is centered with sharp typography and zero scrollbars.
- [ ] **Step 2: Practice with the Teleprompter Drawer:**
  - Press <kbd>N</kbd> (or click **🎙️ Script**) to preview the exact script for Slide 1.
  - Click the **⏱️ Stopwatch** button in the top right header to practice your delivery speed.
  - *Tip:* You can leave the teleprompter drawer closed during the recorded take if reading from a printed script or secondary phone/tablet display.
- [ ] **Step 3: Start Screen Recording:**
  - Trigger recording in Snipping Tool / Game Bar / OBS.
  - Allow a 2-second buffer before beginning speech.
- [ ] **Step 4: Execute the 7 Scenes According to Script:**

| Scene | Time Window | Action / Slide Key | Narration Anchor |
| :---: | :---: | :---: | :--- |
| **Scene 1** | **0:00 – 0:25** | Slide 1 (Active at start) | Dual-write problem, ACID PostgreSQL 16 platform, zero external brokers. |
| **Scene 2** | **0:25 – 0:50** | Press <kbd>Space</kbd> or <kbd>→</kbd> (Slide 2) | Obsidian Pulse, React 19 / TypeScript, 3s REST polling, public demo redaction. |
| **Scene 3** | **0:50 – 1:20** | Press <kbd>Space</kbd> or <kbd>→</kbd> (Slide 3) | Independent worker JVMs, `SELECT FOR UPDATE SKIP LOCKED`, 30s lease fencing. |
| **Scene 4** | **1:20 – 1:50** | Press <kbd>Space</kbd> or <kbd>→</kbd> (Slide 4) | FairShare DRR, 1,080 job benchmark, 89.8% wait reduction, 21.2% throughput tradeoff. |
| **Scene 5** | **1:50 – 2:15** | Press <kbd>Space</kbd> or <kbd>→</kbd> (Slide 5) | Transactional Outbox, single ACID transaction, SHA-256 idempotency key deduplication. |
| **Scene 6** | **2:15 – 2:40** | Press <kbd>Space</kbd> or <kbd>→</kbd> (Slide 6) | Transient vs permanent classification, exponential backoff, DLQ manual replay. |
| **Scene 7** | **2:40 – 3:00** | Press <kbd>Space</kbd> or <kbd>→</kbd> (Slide 7) | 264 automated tests, 8 smoke stages, 7 green CI jobs, GitHub repository. |

- [ ] **Step 5: Conclude & Buffer:**
  - After stating *"Thank you!"*, hold the closing slide for 2 seconds in silence.
  - Stop the screen recorder (`Win + Alt + R` or click Stop).

---

## 4. Post-Recording Review & Trimming

- [ ] **4.1 Video Playback Audit:**
  - Play back the captured file.
  - Did the audio come through cleanly without clipping or distortion?
  - Are all architecture diagrams and screenshot labels legible?
  - Is the total runtime between 2:50 and 3:10?
- [ ] **4.2 Lossless Trimming (Optional):**
  - Open the file in Windows **Clipchamp** (preinstalled in Windows 11) or Windows **Photos** → **Trim**.
  - Snip off the dead air before your first sentence and after your closing word.
  - Save as `QueueForge_V2_Technical_Walkthrough.mp4`.
- [ ] **4.3 Confirm Video Specifications:**
  - Container: `.mp4`
  - Codec: H.264 / AVC
  - Audio: AAC Stereo, 44.1 kHz or 48 kHz
  - Target Resolution: 1080p (1920 × 1080) or 720p minimum
  - Target File Size: Under 100 MB (typically 25–60 MB for a 3-minute screen recording).

---

## 5. Quality Acceptance Checklist

Before sharing with recruiters or engineering hiring managers:
- [x] Walkthrough is explicitly evidence-based (does not claim live local containers are executing).
- [x] Uses authentic, native 1440 × 900 screenshot telemetry (`docs/screenshots/`).
- [x] Accurately cites TanStack Query 3-second REST polling (not SSE).
- [x] Accurately cites `SELECT FOR UPDATE SKIP LOCKED` (not lock-free).
- [x] Accurately reports Profile 3 benchmark numbers: 89.8% p50 wait reduction with 21.2% throughput tradeoff.
- [x] Accurately reports passing test suite: 264 automated tests across 7 GitHub Actions CI jobs.
- [x] Zero exposed production credentials or personal API keys.
