import os
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"D:\Projects\QueueForge\frontend\visual-review\phase13f\prototypes"
os.makedirs(OUTPUT_DIR, exist_ok=True)
BASE_URL = "http://127.0.0.1:5173"

def capture_prototypes():
    print(f"Capturing Phase 13F Prototypes against {BASE_URL} at 1440x900...")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Prototype A: Precision Command
        page.goto(f"{BASE_URL}/?proto=a", wait_until="networkidle")
        time.sleep(1)
        p_a = os.path.join(OUTPUT_DIR, "prototype_a_precision_command_1440x900.png")
        page.screenshot(path=p_a, full_page=False)
        print(f"Captured: {p_a}")

        # Prototype B: Industrial Cockpit
        page.goto(f"{BASE_URL}/?proto=b", wait_until="networkidle")
        time.sleep(1)
        p_b = os.path.join(OUTPUT_DIR, "prototype_b_industrial_cockpit_1440x900.png")
        page.screenshot(path=p_b, full_page=False)
        print(f"Captured: {p_b}")

        context.close()
        browser.close()

if __name__ == "__main__":
    capture_prototypes()
