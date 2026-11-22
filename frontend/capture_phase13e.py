import os
import sys
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"D:\Projects\QueueForge\frontend\visual-review\phase13e"
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = "http://127.0.0.1:5173"

def select_scenario(page, scenario_id):
    try:
        page.click('[data-testid="scenario-selector-btn"]')
        time.sleep(0.4)
        page.click(f'[data-testid="scenario-option-{scenario_id}"]')
        time.sleep(0.8)
    except Exception as e:
        print(f"Warning: could not select scenario {scenario_id}: {e}")

def run_captures():
    print(f"Starting Phase 13E Midnight Spectrum Visual Captures against {BASE_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        # -------------------------------------------------------------
        # Desktop Context (1920x1080)
        # -------------------------------------------------------------
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # 01: Mission Control Dark Theme
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)
        page.evaluate("() => { localStorage.setItem('queueforge_theme', 'dark'); document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }")
        time.sleep(0.6)
        p1 = os.path.join(OUTPUT_DIR, "01_mission_control_dark_1920x1080.png")
        page.screenshot(path=p1, full_page=False)
        print(f"Saved: {p1}")

        # 02: Mission Control Light Theme (Executive Pearl & Lavender)
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(1)
        p2 = os.path.join(OUTPUT_DIR, "02_mission_control_light_1920x1080.png")
        page.screenshot(path=p2, full_page=False)
        print(f"Saved: {p2}")

        # Switch back to dark mode for subsequent captures
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.8)

        # 03: Topology Dark with Active Node Inspector
        page.click("text='sender-db (Postgres)'")
        time.sleep(0.5)
        page.click("button:has-text('Invariants')")
        time.sleep(0.5)
        p3 = os.path.join(OUTPUT_DIR, "03_topology_dark_1920x1080.png")
        page.screenshot(path=p3, full_page=False)
        print(f"Saved: {p3}")

        # 04: FairShare DRR Scheduler Studio
        page.goto(f"{BASE_URL}/fairshare", wait_until="networkidle")
        time.sleep(0.8)
        p4 = os.path.join(OUTPUT_DIR, "04_fairshare_dark_1920x1080.png")
        page.screenshot(path=p4, full_page=False)
        print(f"Saved: {p4}")

        # 05: Transactional Outbox Event Pipeline
        page.goto(f"{BASE_URL}/pipeline", wait_until="networkidle")
        time.sleep(0.8)
        p5 = os.path.join(OUTPUT_DIR, "05_event_pipeline_dark_1920x1080.png")
        page.screenshot(path=p5, full_page=False)
        print(f"Saved: {p5}")

        # 06: Worker Fleet Health & Heartbeats
        page.goto(f"{BASE_URL}/workers", wait_until="networkidle")
        time.sleep(0.8)
        p6 = os.path.join(OUTPUT_DIR, "06_worker_fleet_dark_1920x1080.png")
        page.screenshot(path=p6, full_page=False)
        print(f"Saved: {p6}")

        # 07: Job Explorer & Multi-Tenant Query
        page.goto(f"{BASE_URL}/jobs", wait_until="networkidle")
        time.sleep(0.8)
        p7 = os.path.join(OUTPUT_DIR, "07_job_explorer_dark_1920x1080.png")
        page.screenshot(path=p7, full_page=False)
        print(f"Saved: {p7}")

        context.close()

        # -------------------------------------------------------------
        # Mobile Context (390x844)
        # -------------------------------------------------------------
        mobile_context = browser.new_context(viewport={"width": 390, "height": 844})
        mobile_page = mobile_context.new_page()

        # 08: Mobile Dark Viewport
        mobile_page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.8)
        p8 = os.path.join(OUTPUT_DIR, "08_mobile_dark_390x844.png")
        mobile_page.screenshot(path=p8, full_page=False)
        print(f"Saved: {p8}")

        # 09: Mobile Light Viewport
        mobile_page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.8)
        p9 = os.path.join(OUTPUT_DIR, "09_mobile_light_390x844.png")
        mobile_page.screenshot(path=p9, full_page=False)
        print(f"Saved: {p9}")

        mobile_context.close()
        browser.close()

    print("All Phase 13E Midnight Spectrum screenshots captured successfully!")

if __name__ == "__main__":
    run_captures()
