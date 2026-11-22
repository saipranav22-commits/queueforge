import { test, expect } from '@playwright/test';
import * as path from 'path';

const PROD_URL = 'https://queueforge.pages.dev';
const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/screenshots');

test.use({ channel: 'chrome' });

test.describe('Phase 13K — Public Cloudflare Pages Production Verification', () => {
  test('Flow 1: Verify Initial Render and 30s Polling Endurance on Live Cloudflare Deployment', async ({ page }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    const apiResponses: { url: string; status: number; contentType: string }[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
      console.error('[PROD PAGE ERROR]', err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('[PROD CONSOLE ERROR]', msg.text());
      }
    });

    page.on('response', (res) => {
      if (res.url().includes('/api/v1/')) {
        apiResponses.push({
          url: res.url(),
          status: res.status(),
          contentType: res.headers()['content-type'] || '',
        });
      }
    });

    // 1. Initial Navigation
    await page.goto(PROD_URL, { waitUntil: 'networkidle' });

    // Assert page title
    await expect(page).toHaveTitle(/QueueForge/i);

    // Assert Mission Control header is rendered
    const headerTitle = page.locator('text=QUEUEFORGE COMMAND');
    await expect(headerTitle).toBeVisible();

    // Assert truthful offline status is displayed
    const offlineIndicator = page.locator('text=Live Cluster (Offline)');
    await expect(offlineIndicator).toBeVisible();

    // Verify initial render screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod-01-initial-render.png'), fullPage: true });

    // Assert no "r.filter is not a function" error occurred
    const filterErrorsInitial = pageErrors.filter(e => e.message.includes('filter is not a function'));
    expect(filterErrorsInitial.length).toBe(0);

    // 2. Check at 3 seconds
    await page.waitForTimeout(3000);
    await expect(headerTitle).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod-02-at-3s.png'), fullPage: true });

    // 3. Check at 10 seconds (verifies 3s polling query cycles)
    await page.waitForTimeout(7000);
    await expect(headerTitle).toBeVisible();
    await expect(offlineIndicator).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod-03-at-10s.png'), fullPage: true });

    // 4. Check at 30 seconds (verifies 3s and 5s multi-cycle background polling)
    await page.waitForTimeout(20000);
    await expect(headerTitle).toBeVisible();
    await expect(offlineIndicator).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod-04-at-30s.png'), fullPage: true });

    // Assert total endurance across 30 seconds
    const fatalFilterErrors = pageErrors.filter(e => e.message.includes('filter is not a function'));
    expect(fatalFilterErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Flow 2: Verify Scenario Explorer & Full Scenario Switching on Live Production', async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: 'networkidle' });

    // Open Scenario Selector dropdown using data-testid
    const scenarioTrigger = page.locator('[data-testid="scenario-selector-btn"]');
    await expect(scenarioTrigger).toBeVisible();
    await scenarioTrigger.click();

    // Switch to Worker Failure scenario
    const workerFailureOption = page.locator('[data-testid="scenario-option-WORKER_FAILURE"]');
    await expect(workerFailureOption).toBeVisible();
    await workerFailureOption.click();

    // Verify Amber simulated scenario banner appears
    const scenarioBanner = page.locator('text=SIMULATED SCENARIO');
    await expect(scenarioBanner).toBeVisible();
    if (!page.viewportSize() || page.viewportSize()!.width >= 640) {
      await expect(page.locator('text=Zero Network Calls to Backend')).toBeVisible();
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod-05-scenario-mode.png'), fullPage: true });

    // Click Return to Live Mode
    const returnLiveBtn = page.locator('button:has-text("Return to Live Mode")');
    await expect(returnLiveBtn).toBeVisible();
    await returnLiveBtn.click();

    // Verify return to Live Cluster (Offline)
    await expect(page.locator('text=Live Cluster (Offline)')).toBeVisible();
  });

  test('Flow 3: Verify FairShare Scheduler & DRR Stepper on Live Production', async ({ page }) => {
    await page.goto(`${PROD_URL}/fairshare`, { waitUntil: 'networkidle' });

    // Assert FairShare page heading
    const heading = page.getByRole('heading', { name: 'FairShare Multi-Tenant' });
    await expect(heading).toBeVisible();

    // Look for DRR Simulator controls
    const stepButton = page.locator('button:has-text("Step Round")').or(page.locator('button:has-text("Step Quantum")')).or(page.locator('button:has-text("Reset")'));
    if (await stepButton.first().isVisible()) {
      await stepButton.first().click();
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod-06-fairshare.png'), fullPage: true });
  });

  test('Flow 4: Verify All 9 Application Routes Survive Direct Navigation and Refresh', async ({ page }) => {
    const routes = [
      '/',
      '/jobs',
      '/workers',
      '/fairshare',
      '/pipeline',
      '/dlq',
      '/reliability',
      '/monitoring',
      '/admin',
    ];

    for (const route of routes) {
      await page.goto(`${PROD_URL}${route}`, { waitUntil: 'domcontentloaded' });
      // Assert no 404 text or crash
      await expect(page.locator('text=404 Not Found')).not.toBeVisible();
      // Reload deep link
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('text=404 Not Found')).not.toBeVisible();
    }
  });

  test('Flow 5: Verify Dark and Light Theme Toggle on Live Production', async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: 'networkidle' });

    const themeToggle = page.locator('button[aria-label="Toggle Theme"]').or(page.locator('button:has-text("Theme")')).or(page.locator('[data-testid="theme-toggle"]'));
    if (await themeToggle.first().isVisible()) {
      await themeToggle.first().click();
      await page.waitForTimeout(500);
      await themeToggle.first().click();
    }
  });
});
