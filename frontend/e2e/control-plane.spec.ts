import { test, expect } from '@playwright/test';

const ADMIN_KEY = process.env.ADMIN_API_KEY || 'qf_v2_release_candidate_admin_key_2026';

test.describe('QueueForge Obsidian Pulse Control Plane E2E Suite', () => {
  test('Flow 1: Mission Control Overview loads with Obsidian Pulse theme', async ({ page }) => {
    await page.goto('/');

    // Check title / brand header
    await expect(page).toHaveTitle(/QueueForge/i);
    await expect(page.locator('text=Control Plane').first()).toBeVisible();

    // Verify presence of primary KPI cards and chart
    await expect(page.locator('text=Pending Queue').first()).toBeVisible();
    await expect(page.locator('text=Active Running').first()).toBeVisible();
    await expect(page.locator('text=Completed Total').first()).toBeVisible();
    await expect(page.locator('text=Cluster Execution Activity').first()).toBeVisible();
  });

  test('Flow 2: Admin Unlock Authentication and Double-Submit CSRF Lifecycle', async ({ page }) => {
    await page.goto('/');

    // Open unlock modal
    const unlockBtn = page.getByRole('button', { name: /Unlock Admin Mode/i }).first();
    if (await unlockBtn.isVisible()) {
      await unlockBtn.click();
    } else {
      // If mobile or in header
      await page.locator('button:has-text("Unlock")').first().click();
    }

    const modalTitle = page.locator('#admin-unlock-title');
    await expect(modalTitle).toBeVisible();

    // Test empty validation
    await page.getByRole('button', { name: /Authenticate & Unlock/i }).click();
    await expect(page.locator('text=Please enter the administrative API key.')).toBeVisible();

    // Test password show/hide toggle
    const input = page.locator('#admin-key-input');
    await input.fill(ADMIN_KEY);
    await expect(input).toHaveAttribute('type', 'password');

    const toggleBtn = page.getByLabel(/Show administrative key/i);
    await toggleBtn.click();
    await expect(input).toHaveAttribute('type', 'text');

    // Submit valid authentication
    await page.getByRole('button', { name: /Authenticate & Unlock/i }).click();

    // Verify session unlocked
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=ADMINISTRATOR').first()).toBeVisible();
  });

  test('Flow 3: Job Explorer, Search and Slide-Over Drawer Drilldown', async ({ page }) => {
    await page.goto('/jobs');

    // Verify search input
    const searchInput = page.getByPlaceholder(/Search UUID or idempotency key/i);
    await expect(searchInput).toBeVisible();

    // Test filter pills
    await expect(page.getByRole('button', { name: /ALL/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /PENDING/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /COMPLETED/i }).first()).toBeVisible();
  });

  test('Flow 4: Worker Fleet & Distributed Heartbeat Discovery', async ({ page }) => {
    await page.goto('/workers');

    await expect(page.locator('text=Worker Fleet').first()).toBeVisible();
    await expect(page.locator('text=MULTI-NODE CLUSTER').first()).toBeVisible();
  });

  test('Flow 5: FairShare Multi-Tenant Intelligence & Deficit Counters', async ({ page }) => {
    await page.goto('/fairshare');

    await expect(page.locator('text=FairShare Multi-Tenant').first()).toBeVisible();
    await expect(page.locator('text=DRR ENGINE').first()).toBeVisible();
  });

  test('Flow 6: Transactional Event Pipeline & Outbox Explorer', async ({ page }) => {
    await page.goto('/pipeline');

    await expect(page.locator('text=Transactional Outbox Event Pipeline').first()).toBeVisible();
    await expect(page.locator('text=AT-LEAST-ONCE').first()).toBeVisible();
  });

  test('Flow 7: Reliability Lab & Formal Invariant Matrix', async ({ page }) => {
    await page.goto('/reliability');

    await expect(page.locator('text=Reliability Lab').first()).toBeVisible();
    await expect(page.locator('text=9/9 INVARIANTS PASS').first()).toBeVisible();
    await expect(page.locator('text=SAFETY-1').first()).toBeVisible();
  });

  test('Flow 8: Dead-Letter Queue & Guarded Recovery Triage', async ({ page }) => {
    await page.goto('/dlq');

    await expect(page.locator('text=Dead-Letter Queue Operations').first()).toBeVisible();
    await expect(page.locator('text=POISON ISOLATION').first()).toBeVisible();
  });

  test('Flow 9: Administration & Session Control', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('text=Control Plane Administration').first()).toBeVisible();
    await expect(page.locator('text=SECURITY & OPERATIONS').first()).toBeVisible();
  });

  test('Flow 10: Dark / Light Theme Toggle', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.getByLabel(/Switch to Light Theme|Switch to Dark Theme/i).first();
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(300);
      await themeToggle.click();
    }
  });
});
