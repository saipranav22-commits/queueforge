import os
import sys
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"D:\Projects\QueueForge\frontend\visual-review\phase13d"
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = "http://127.0.0.1:5173"

def select_scenario(page, scenario_id):
    page.click('[data-testid="scenario-selector-btn"]')
    time.sleep(0.4)
    page.click(f'[data-testid="scenario-option-{scenario_id}"]')
    time.sleep(0.8)

def run_captures():
    print(f"Starting Phase 13D Visual QA Captures against {BASE_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        # -------------------------------------------------------------
        # 01: Mission Control Live Offline (1920x1080)
        # -------------------------------------------------------------
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)
        # Ensure dark theme and live mode
        page.evaluate("() => { localStorage.setItem('queueforge_theme', 'dark'); document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }")
        time.sleep(0.5)

        p1 = os.path.join(OUTPUT_DIR, "01_mission_control_live_offline_1920x1080.png")
        page.screenshot(path=p1, full_page=False)
        print(f"Saved: {p1}")

        # -------------------------------------------------------------
        # 02: Mission Control Healthy Cluster Scenario (1920x1080)
        # -------------------------------------------------------------
        select_scenario(page, "HEALTHY_CLUSTER")

        p2 = os.path.join(OUTPUT_DIR, "02_mission_control_healthy_scenario_1920x1080.png")
        page.screenshot(path=p2, full_page=False)
        print(f"Saved: {p2}")

        # -------------------------------------------------------------
        # 03: Topology Workspace Inspector (1920x1080)
        # -------------------------------------------------------------
        # Click sender-db or worker-1 in SVG and select Invariants tab
        page.click("text='sender-db (Postgres)'")
        time.sleep(0.5)
        # Click Invariants tab in inspector
        page.click("button:has-text('Invariants')")
        time.sleep(0.5)

        p3 = os.path.join(OUTPUT_DIR, "03_topology_workspace_inspector_1920x1080.png")
        page.screenshot(path=p3, full_page=False)
        print(f"Saved: {p3}")

        # -------------------------------------------------------------
        # 04: Worker Failure Scenario (1920x1080)
        # -------------------------------------------------------------
        select_scenario(page, "WORKER_FAILURE")

        p4 = os.path.join(OUTPUT_DIR, "04_worker_failure_scenario_1920x1080.png")
        page.screenshot(path=p4, full_page=False)
        print(f"Saved: {p4}")

        # -------------------------------------------------------------
        # 05: Noisy Neighbor FairShare Scenario (1920x1080)
        # -------------------------------------------------------------
        page.goto(f"{BASE_URL}/fairshare", wait_until="networkidle")
        time.sleep(0.5)
        select_scenario(page, "NOISY_NEIGHBOR")

        p5 = os.path.join(OUTPUT_DIR, "05_noisy_neighbor_fairshare_scenario_1920x1080.png")
        page.screenshot(path=p5, full_page=False)
        print(f"Saved: {p5}")

        # -------------------------------------------------------------
        # 06: Outbox Retry Scenario (1920x1080)
        # -------------------------------------------------------------
        page.goto(f"{BASE_URL}/pipeline", wait_until="networkidle")
        time.sleep(0.5)
        select_scenario(page, "OUTBOX_RETRY")

        p6 = os.path.join(OUTPUT_DIR, "06_outbox_retry_scenario_1920x1080.png")
        page.screenshot(path=p6, full_page=False)
        print(f"Saved: {p6}")

        # -------------------------------------------------------------
        # 07: DLQ Poison Recovery Scenario (1920x1080)
        # -------------------------------------------------------------
        page.goto(f"{BASE_URL}/dlq", wait_until="networkidle")
        time.sleep(0.5)
        select_scenario(page, "DLQ_POISON_RECOVERY")

        p7 = os.path.join(OUTPUT_DIR, "07_dlq_poison_recovery_scenario_1920x1080.png")
        page.screenshot(path=p7, full_page=False)
        print(f"Saved: {p7}")

        # -------------------------------------------------------------
        # 08: Mission Control Light Theme Scenario (1920x1080)
        # -------------------------------------------------------------
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.5)
        page.evaluate("() => { localStorage.setItem('queueforge_theme', 'light'); document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); }")
        time.sleep(1)

        p8 = os.path.join(OUTPUT_DIR, "08_mission_control_light_scenario_1920x1080.png")
        page.screenshot(path=p8, full_page=False)
        print(f"Saved: {p8}")

        context.close()

        # -------------------------------------------------------------
        # 09 & 10: Mobile Viewport (390x844) Dark Theme
        # -------------------------------------------------------------
        mobile_context = browser.new_context(viewport={"width": 390, "height": 844})
        mobile_page = mobile_context.new_page()
        mobile_page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(0.5)
        mobile_page.evaluate("() => { localStorage.setItem('queueforge_theme', 'dark'); document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }")
        time.sleep(0.5)

        # 09: Mobile Overview
        p9 = os.path.join(OUTPUT_DIR, "09_mobile_mission_control_dark_390x844.png")
        mobile_page.screenshot(path=p9, full_page=False)
        print(f"Saved: {p9}")

        # 10: Mobile with Scenario Banner & Unlock Button
        select_scenario(mobile_page, "HEALTHY_CLUSTER")

        p10 = os.path.join(OUTPUT_DIR, "10_mobile_scenario_banner_unlock_390x844.png")
        mobile_page.screenshot(path=p10, full_page=False)
        print(f"Saved: {p10}")

        mobile_context.close()
        browser.close()

    print("All 10 Phase 13D screenshots captured successfully!")

if __name__ == "__main__":
    run_captures()
