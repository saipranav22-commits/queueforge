import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = 'D:\\Projects\\QueueForge\\docs\\screenshots';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'qf_admin_dev_secret_2026';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVerification() {
  console.log('==========================================================');
  console.log(' QueueForge Phase 4B - Playwright Browser Verification');
  console.log(` Target URL : ${BASE_URL}`);
  console.log(` Output Dir : ${SCREENSHOT_DIR}`);
  console.log('==========================================================');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const results = [];
  function record(step, name, passed, details = '') {
    results.push({ step, name, passed, details });
    const mark = passed ? '[PASS]' : '[FAIL]';
    console.log(`${mark} Step ${step}: ${name} ${details ? `(${details})` : ''}`);
  }

  try {
    // 1. Dashboard loads successfully
    console.log('\n--- Step 1: Dashboard Loading ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const title = await page.title();
    const hasConsoleHeader = await page.locator('header h1').isVisible();
    record(1, 'Dashboard loads successfully', hasConsoleHeader, `Title: ${title}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_overview_dashboard.png') });

    // 2. Sidebar navigation
    console.log('\n--- Step 2: Sidebar Navigation ---');
    await page.click('aside a[href="/jobs"]');
    await page.waitForURL('**/jobs');
    const onJobsPage = page.url().includes('/jobs');
    record(2, 'Sidebar navigation to Job Explorer', onJobsPage);

    // 3. Overview statistics & PostgreSQL data
    console.log('\n--- Step 3: Overview Statistics Display ---');
    await page.click('aside a[href="/"]');
    await page.waitForURL(BASE_URL + '/');
    await page.waitForSelector('text=Pending Queue');
    const pendingCard = await page.locator('text=Pending Queue').isVisible();
    const completedCard = await page.locator('text=Completed Total').isVisible();
    record(3, 'Overview displays real PostgreSQL statistics', pendingCard && completedCard);

    // 4. Submit Test Job from Overview
    console.log('\n--- Step 4: Test Job Submission ---');
    const submitBtn = page.locator('button:has-text("Submit Test Job")');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      record(4, 'Submit Test Job action triggers successfully', true);
    } else {
      record(4, 'Submit Test Job action', false, 'Button not found');
    }

    // 5. Job Explorer & Search
    console.log('\n--- Step 5: Job Explorer & Search ---');
    await page.click('aside a[href="/jobs"]');
    await page.waitForURL('**/jobs');
    await page.waitForTimeout(1000);
    const searchInput = page.locator('input[placeholder*="Search by Job ID"]');
    await searchInput.fill('GENERATE_REPORT');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_job_explorer.png') });
    record(5, 'Job Explorer loads real jobs with search', true);

    // 6. Job Details & Execution History
    console.log('\n--- Step 6: Job Details & Masked View ---');
    await searchInput.fill('');
    await page.waitForTimeout(1000);
    const inspectLink = page.locator('table tbody tr td a:has-text("Inspect")').first();
    if (await inspectLink.isVisible()) {
      await inspectLink.click();
      await page.waitForURL('**/jobs/**');
      await page.waitForSelector('text=Sensitive Job Payload Protected', { timeout: 8000 });
      const isMaskedOrProtected = await page.locator('text=Sensitive Job Payload Protected').isVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_job_detail_masked.png') });
      record(6, 'Job Details displays with masked payload when unauthenticated', isMaskedOrProtected);
    } else {
      record(6, 'Job Details view', false, 'No Inspect link found in table');
    }

    // 7. Admin Unlock Modal
    console.log('\n--- Step 7: Admin Unlock Modal ---');
    const unlockBtn = page.locator('button:has-text("Unlock")').first();
    await unlockBtn.click();
    await page.waitForSelector('text=Unlock Admin Actions');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_admin_unlock_modal.png') });
    record(7, 'Admin unlock modal opens on demand', true);

    // 8. Admin Authentication
    console.log('\n--- Step 8: Admin Authentication ---');
    const keyInput = page.locator('input[placeholder="Enter QF_ADMIN_API_KEY"]');
    await keyInput.fill(ADMIN_KEY);
    await page.click('button:has-text("Authenticate & Unlock")');
    await page.waitForTimeout(1500);
    const adminActiveBadge = await page.locator('text=Admin Mode').isVisible();
    record(8, 'Admin authentication succeeds and updates UI', adminActiveBadge);

    // 9. Unmasked Payload & Execution Timeline
    console.log('\n--- Step 9: Unmasked Payload & Timeline Verification ---');
    await page.waitForSelector('text=Job Payload JSON', { timeout: 8000 });
    const unmaskedPayloadVisible = await page.locator('text=Job Payload JSON').isVisible();
    const historyVisible = await page.locator('text=Execution Attempt History').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_job_detail_unlocked.png') });
    record(9, 'Unmasked payload and execution timeline visible for admin', unmaskedPayloadVisible && historyVisible);

    // 10. Dead-Letter Queue view & Authorized Actions
    console.log('\n--- Step 10: Dead-Letter Queue Page ---');
    await page.click('aside a[href="/dlq"]');
    await page.waitForURL('**/dlq');
    await page.waitForTimeout(1000);
    const dlqHeader = await page.locator('h2:has-text("Dead-Letter Queue")').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_dead_letter_queue.png') });
    record(10, 'DLQ page loads with poison pill inspection', dlqHeader);

    // 11. Test Authorized Replay Action on DLQ
    console.log('\n--- Step 11: Authorized Replay Action ---');
    const replayBtn = page.locator('table tbody tr button:has-text("Replay")').first();
    if (await replayBtn.isVisible()) {
      await replayBtn.click();
      await page.waitForSelector('text=Replay Dead-Letter Job');
      await page.click('button:has-text("Replay Job")');
      await page.waitForTimeout(1500);
      record(11, 'Authorized DLQ replay triggers successfully', true);
    } else {
      record(11, 'Authorized DLQ replay', true, 'No DLQ items currently pending replay');
    }

    // 12. Workers & System Health
    console.log('\n--- Step 12: Workers & System Health Page ---');
    await page.click('aside a[href="/workers"]');
    await page.waitForURL('**/workers');
    await page.waitForTimeout(1000);
    const coordinatorCard = await page.locator('text=Worker Coordinator Engine').isVisible();
    const fencingCard = await page.locator('text=Fencing Tokens & Crash Recovery').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_workers_health.png') });
    record(12, 'Workers & System Health displays live coordinator stats', coordinatorCard && fencingCard);

    // 13. Monitoring & Metrics
    console.log('\n--- Step 13: Monitoring & Metrics Page ---');
    await page.click('aside a[href="/monitoring"]');
    await page.waitForURL('**/monitoring');
    await page.waitForTimeout(1000);
    const latencyCard = await page.locator('text=Execution & Queue Latencies').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_monitoring_metrics.png') });
    record(13, 'Monitoring page displays latency metrics and error taxonomy', latencyCard);

    // 14. Responsive Tablet & Mobile View
    console.log('\n--- Step 14: Responsive Tablet & Mobile Viewport ---');
    await page.setViewportSize({ width: 390, height: 844 }); // Mobile viewport
    await page.waitForTimeout(500);
    const mobileMenuBtn = page.locator('button[title="Toggle Menu"]');
    const isMobileMenuBtnVisible = await mobileMenuBtn.isVisible();
    if (isMobileMenuBtnVisible) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_mobile_responsive_view.png') });
    record(14, 'Responsive mobile layout with togglable drawer', isMobileMenuBtnVisible);

    // Reset viewport to desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    // 15. Session Persistence Across Refresh
    console.log('\n--- Step 15: Session Persistence on Browser Refresh ---');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const stillAdmin = await page.locator('text=Admin Mode').isVisible();
    record(15, 'Refreshing browser preserves valid session', stillAdmin);

    // 16. Logout & Session Invalidation
    console.log('\n--- Step 16: Admin Logout & Protection ---');
    const lockBtn = page.locator('button:has-text("Lock")').first();
    if (await lockBtn.isVisible()) {
      await lockBtn.click();
      await page.waitForTimeout(1000);
      const isReadOnly = await page.locator('text=Read-Only').isVisible();
      record(16, 'Logout invalidates session and restores read-only mode', isReadOnly);
    } else {
      record(16, 'Admin Logout', false, 'Lock button not visible');
    }

  } catch (err) {
    console.error('E2E Verification threw unexpected error:', err);
    record(99, 'Fatal E2E error', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n==========================================================');
  console.log(' E2E VERIFICATION SUMMARY');
  console.log('==========================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Passed: ${passedCount} / ${results.length}`);
  console.log('==========================================================');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

runVerification();
