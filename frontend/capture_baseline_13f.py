import os
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"D:\Projects\QueueForge\frontend\visual-review\phase13f\baseline"
os.makedirs(OUTPUT_DIR, exist_ok=True)
BASE_URL = "http://127.0.0.1:5173"

def capture_baseline():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)
        p_dark = os.path.join(OUTPUT_DIR, "baseline_dark_1440x900.png")
        page.screenshot(path=p_dark, full_page=False)
        print(f"Captured: {p_dark}")

        page.click('button[aria-label="Toggle Color Theme"]')
        time.sleep(1)
        p_light = os.path.join(OUTPUT_DIR, "baseline_light_1440x900.png")
        page.screenshot(path=p_light, full_page=False)
        print(f"Captured: {p_light}")

        context.close()
        browser.close()

if __name__ == "__main__":
    capture_baseline()
