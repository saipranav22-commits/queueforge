import os
import sys
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"D:\Projects\QueueForge\frontend\visual-review\phase13f"
os.makedirs(OUTPUT_DIR, exist_ok=True)
BASE_URL = "http://127.0.0.1:5173"

def run_captures():
    print(f"Starting Phase 13F Titanium x Ember Visual Captures against {BASE_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        # -------------------------------------------------------------
        # Desktop 1920x1080 Context
        # -------------------------------------------------------------
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # 01: Final Mission Control Dark
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)
        # Ensure dark theme
        page.evaluate("() => { localStorage.setItem('qf_theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); }")
        time.sleep(0.5)
        p1 = os.path.join(OUTPUT_DIR, "01_mission_control_dark_1920x1080.png")
        page.screenshot(path=p1, full_page=False)
        print(f"Captured: {p1}")

        # 02: Final Mission Control Light (Warm Ivory & Titanium)
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(1)
        p2 = os.path.join(OUTPUT_DIR, "02_mission_control_light_1920x1080.png")
        page.screenshot(path=p2, full_page=False)
        print(f"Captured: {p2}")

        # Switch back to dark mode
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.8)

        # 03: Final Topology Dark with Inspector
        page.click("text='sender-db (Postgres)'")
        time.sleep(0.5)
        page.click("button:has-text('Invariants')")
        time.sleep(0.5)
        p3 = os.path.join(OUTPUT_DIR, "03_topology_dark_1920x1080.png")
        page.screenshot(path=p3, full_page=False)
        print(f"Captured: {p3}")

        # 04: FairShare Scheduler Studio
        page.goto(f"{BASE_URL}/fairshare", wait_until="networkidle")
        time.sleep(0.8)
        p4 = os.path.join(OUTPUT_DIR, "04_fairshare_dark_1920x1080.png")
        page.screenshot(path=p4, full_page=False)
        print(f"Captured: {p4}")

        # 05: Event Pipeline
        page.goto(f"{BASE_URL}/pipeline", wait_until="networkidle")
        time.sleep(0.8)
        p5 = os.path.join(OUTPUT_DIR, "05_event_pipeline_dark_1920x1080.png")
        page.screenshot(path=p5, full_page=False)
        print(f"Captured: {p5}")

        # 06: Worker Fleet
        page.goto(f"{BASE_URL}/workers", wait_until="networkidle")
        time.sleep(0.8)
        p6 = os.path.join(OUTPUT_DIR, "06_worker_fleet_dark_1920x1080.png")
        page.screenshot(path=p6, full_page=False)
        print(f"Captured: {p6}")

        # 07: Job Explorer
        page.goto(f"{BASE_URL}/jobs", wait_until="networkidle")
        time.sleep(0.8)
        p7 = os.path.join(OUTPUT_DIR, "07_job_explorer_dark_1920x1080.png")
        page.screenshot(path=p7, full_page=False)
        print(f"Captured: {p7}")

        # 10: Unlock Console Modal Dark
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.5)
        page.click('[data-testid="header-unlock-button"]')
        time.sleep(0.6)
        p10 = os.path.join(OUTPUT_DIR, "10_unlock_console_modal_dark.png")
        page.screenshot(path=p10, full_page=False)
        print(f"Captured: {p10}")

        # Close modal
        page.keyboard.press("Escape")
        time.sleep(0.4)

        # 11: Unlock Console Modal Light
        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.6)
        page.click('[data-testid="header-unlock-button"]')
        time.sleep(0.6)
        p11 = os.path.join(OUTPUT_DIR, "11_unlock_console_modal_light.png")
        page.screenshot(path=p11, full_page=False)
        print(f"Captured: {p11}")

        context.close()

        # -------------------------------------------------------------
        # Mobile 390x844 Context
        # -------------------------------------------------------------
        mobile_context = browser.new_context(viewport={"width": 390, "height": 844})
        mobile_page = mobile_context.new_page()

        # 08: Mobile Dark Viewport
        mobile_page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.8)
        mobile_page.evaluate("() => { localStorage.setItem('qf_theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); }")
        time.sleep(0.5)
        p8 = os.path.join(OUTPUT_DIR, "08_mobile_dark_390x844.png")
        mobile_page.screenshot(path=p8, full_page=False)
        print(f"Captured: {p8}")

        # 09: Mobile Light Viewport
        mobile_page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(0.8)
        p9 = os.path.join(OUTPUT_DIR, "09_mobile_light_390x844.png")
        mobile_page.screenshot(path=p9, full_page=False)
        print(f"Captured: {p9}")

        mobile_context.close()
        browser.close()

    print("All Phase 13F Titanium x Ember screenshots captured successfully!")

if __name__ == "__main__":
    run_captures()
