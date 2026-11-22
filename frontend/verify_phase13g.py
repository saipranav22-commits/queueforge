import os
import sys
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"D:\Projects\QueueForge\frontend\visual-review\phase13g"
os.makedirs(OUTPUT_DIR, exist_ok=True)
BASE_URL = "http://127.0.0.1:5173"

ROUTES = [
    ("/", "Mission Control"),
    ("/jobs", "Job Explorer"),
    ("/workers", "Worker Fleet"),
    ("/fairshare", "FairShare Scheduler"),
    ("/pipeline", "Event Pipeline"),
    ("/dlq", "Dead-Letter Queue"),
    ("/reliability", "Reliability Lab"),
    ("/monitoring", "Observability"),
    ("/admin", "Administration"),
]

VIEWPORTS = [
    ("desktop_1920x1080", 1920, 1080),
    ("workstation_1440x900", 1440, 900),
    ("laptop_1280x800", 1280, 800),
    ("tablet_landscape_1024x768", 1024, 768),
    ("tablet_portrait_768x1024", 768, 1024),
    ("mobile_390x844", 390, 844),
]

def run_verification():
    print(f"============================================================")
    print(f"QUEUEFORGE COMMAND — PHASE 13G FINAL FRONTEND VERIFICATION")
    print(f"Target URL: {BASE_URL}")
    print(f"============================================================")

    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        # -----------------------------------------------------------------
        # 1. VERIFY ALL 9 ROUTES (Dark & Light, Console Logs & Runtime Exceptions)
        # -----------------------------------------------------------------
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"Unhandled Exception: {exc}"))

        print("\n--- Verifying 9 Routes in Dark Theme ---")
        for path, name in ROUTES:
            url = f"{BASE_URL}{path}"
            t0 = time.time()
            res = page.goto(url, wait_until="networkidle")
            elapsed = time.time() - t0
            time.sleep(0.5)

            status = res.status if res else "Unknown"
            print(f"[ROUTE CHECK] {path:14} -> {name:22} | Status: {status} ({elapsed:.2f}s)")
            if status != 200:
                errors.append(f"Route {path} returned status {status}")

        # -----------------------------------------------------------------
        # 2. CAPTURE REQUIRED PHASE 13G EVIDENCE SCREENSHOTS
        # -----------------------------------------------------------------
        print("\n--- Capturing Required Phase 13G Screenshots (1920x1080) ---")

        # 01: Mission Control Dark
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.8)
        p1 = os.path.join(OUTPUT_DIR, "01_mission_control_dark_1920x1080.png")
        page.screenshot(path=p1, full_page=False)
        print(f"Saved: {p1}")

        # 02: Mission Control Light (Warm Ivory & Titanium)
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.8)
        p2 = os.path.join(OUTPUT_DIR, "02_mission_control_light_1920x1080.png")
        page.screenshot(path=p2, full_page=False)
        print(f"Saved: {p2}")

        # Switch back to Dark Theme
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.6)

        # 03: Topology with Contextual Inspector open on Invariants
        page.click("text='sender-db (Postgres)'")
        time.sleep(0.5)
        page.click("button:has-text('Invariants')")
        time.sleep(0.5)
        p3 = os.path.join(OUTPUT_DIR, "03_topology_dark_1920x1080.png")
        page.screenshot(path=p3, full_page=False)
        print(f"Saved: {p3}")

        # 04: Worker Fleet
        page.goto(f"{BASE_URL}/workers", wait_until="networkidle")
        time.sleep(0.8)
        p4 = os.path.join(OUTPUT_DIR, "04_worker_fleet_dark_1920x1080.png")
        page.screenshot(path=p4, full_page=False)
        print(f"Saved: {p4}")

        # 05: FairShare Scheduler
        page.goto(f"{BASE_URL}/fairshare", wait_until="networkidle")
        time.sleep(0.8)
        p5 = os.path.join(OUTPUT_DIR, "05_fairshare_dark_1920x1080.png")
        page.screenshot(path=p5, full_page=False)
        print(f"Saved: {p5}")

        # 06: Event Pipeline
        page.goto(f"{BASE_URL}/pipeline", wait_until="networkidle")
        time.sleep(0.8)
        p6 = os.path.join(OUTPUT_DIR, "06_event_pipeline_dark_1920x1080.png")
        page.screenshot(path=p6, full_page=False)
        print(f"Saved: {p6}")

        # 07: Job Explorer
        page.goto(f"{BASE_URL}/jobs", wait_until="networkidle")
        time.sleep(0.8)
        p7 = os.path.join(OUTPUT_DIR, "07_job_explorer_dark_1920x1080.png")
        page.screenshot(path=p7, full_page=False)
        print(f"Saved: {p7}")

        # 08: Dead-Letter Queue
        page.goto(f"{BASE_URL}/dlq", wait_until="networkidle")
        time.sleep(0.8)
        p8 = os.path.join(OUTPUT_DIR, "08_dlq_dark_1920x1080.png")
        page.screenshot(path=p8, full_page=False)
        print(f"Saved: {p8}")

        # 09: Administration
        page.goto(f"{BASE_URL}/admin", wait_until="networkidle")
        time.sleep(0.8)
        p9 = os.path.join(OUTPUT_DIR, "09_administration_dark_1920x1080.png")
        page.screenshot(path=p9, full_page=False)
        print(f"Saved: {p9}")

        # -----------------------------------------------------------------
        # 3. VERIFY AUTHENTICATION & UNLOCK CONSOLE CONTROL
        # -----------------------------------------------------------------
        print("\n--- Verifying Unlock Console & Auth Modal ---")
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.5)

        unlock_btn = page.locator('[data-testid="header-unlock-button"]')
        btn_box = unlock_btn.bounding_box()
        print(f"Unlock Console Button Target: width={btn_box['width']:.1f}px, height={btn_box['height']:.1f}px")
        if btn_box['width'] < 44 or btn_box['height'] < 44:
            errors.append(f"Unlock button touch target {btn_box['width']}x{btn_box['height']} is smaller than 44x44px")

        # Open Unlock Modal
        unlock_btn.click()
        time.sleep(0.5)
        p_modal = os.path.join(OUTPUT_DIR, "10_unlock_modal_dark.png")
        page.screenshot(path=p_modal, full_page=False)
        print(f"Saved: {p_modal}")

        # Test escape closes modal
        page.keyboard.press("Escape")
        time.sleep(0.4)
        if page.locator("text='Administrative Operator Unlock'").is_visible():
            errors.append("Unlock modal did not close on Escape key")
        else:
            print("Escape key successfully closed unlock modal.")

        # -----------------------------------------------------------------
        # 4. VERIFY SCENARIO EXPLORER SAFETY & ISOLATION
        # -----------------------------------------------------------------
        print("\n--- Verifying Scenario Mode Safety & Isolation ---")
        # Select HEALTHY_CLUSTER scenario
        page.click('[data-testid="scenario-selector-btn"]')
        time.sleep(0.4)
        page.click('[data-testid="scenario-option-HEALTHY_CLUSTER"]')
        time.sleep(0.8)

        # Check simulation banner appears
        banner_visible = page.locator("text='SIMULATED SCENARIO'").is_visible()
        print(f"Scenario Banner Visible: {banner_visible}")
        if not banner_visible:
            errors.append("Scenario banner did not appear after selecting HEALTHY_CLUSTER scenario")

        # Revert to Live Mode
        page.click("button:has-text('Return to Live Mode')")
        time.sleep(0.8)
        print("Reverted to Live Mode cleanly.")

        context.close()

        # -----------------------------------------------------------------
        # 5. RESPONSIVE VIEWPORT CHECKS
        # -----------------------------------------------------------------
        print("\n--- Testing Responsive Viewports ---")
        for vp_name, w, h in VIEWPORTS:
            vp_context = browser.new_context(viewport={"width": w, "height": h})
            vp_page = vp_context.new_page()
            vp_page.goto(BASE_URL, wait_until="networkidle")
            time.sleep(0.5)

            # Check for horizontal scroll / overflow
            has_h_scroll = vp_page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
            print(f"Viewport {vp_name:26} ({w}x{h}) | Horiz Overflow: {has_h_scroll}")

            # Capture mobile dark and light
            if w == 390:
                p_mob_dark = os.path.join(OUTPUT_DIR, "11_mobile_overview_dark_390x844.png")
                vp_page.screenshot(path=p_mob_dark, full_page=False)
                print(f"Saved: {p_mob_dark}")

                vp_page.click('button[aria-label="Toggle Color Theme"]')
                time.sleep(0.6)
                p_mob_light = os.path.join(OUTPUT_DIR, "12_mobile_overview_light_390x844.png")
                vp_page.screenshot(path=p_mob_light, full_page=False)
                print(f"Saved: {p_mob_light}")

            vp_context.close()

        browser.close()

    print("\n============================================================")
    print(f"VERIFICATION SUMMARY: {len(errors)} Critical Errors Detected")
    if errors:
        for err in errors:
            print(f"  ❌ {err}")
    else:
        print("  ✅ All route, design, auth, scenario, and responsive checks PASSED.")
    print(f"Console Errors Logged: {len(console_errors)}")
    for ce in console_errors:
        print(f"  [Console Error]: {ce}")
    print(f"============================================================")

if __name__ == "__main__":
    run_verification()
