import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@sigmaalutech.in';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'sigma-admin-2026';

// Playwright runs from the app root.
const FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/salary-sample.xlsx');

// A month of its own so the suite never collides with seeded data.
const PERIOD = '2029-03';
const PERIOD_LABEL = 'March 2029';

async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin/products');
}

/** Remove the run this spec creates, so re-runs start clean. */
async function cleanup(page: Page) {
  const runs = await (await page.request.get('/api/payroll')).json();
  for (const run of runs.runs ?? []) {
    if (run.period.startsWith(PERIOD)) {
      await page.request.delete(`/api/payroll/${run.id}`);
    }
  }
}

test.describe('Payroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page);
    await cleanup(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test('employees page lists staff and flags missing phone numbers', async ({ page }) => {
    await page.goto('/admin/employees');
    await expect(page.locator('.admin-head__title')).toHaveText('Employees');
    await expect(page.locator('.rec-table .rec-row--emp').first()).toBeVisible();
    // The seeded register deliberately includes someone without a number.
    await expect(page.locator('.admin-head__meta')).toContainText('without a usable phone');
  });

  test('adding an employee normalises the phone number', async ({ page }) => {
    await page.goto('/admin/employees');
    const name = `E2E TEMP ${Date.now()}`;
    await page.getByTestId('add-employee').click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('WhatsApp number').fill('98765 43210');
    await page.getByLabel('Monthly gross (₹)').fill('21000');
    await page
      .getByTestId('employee-editor')
      .getByRole('button', { name: 'Add employee' })
      .click();
    await expect(page.locator('.form-success')).toContainText('added');

    // Stored with the country code so WhatsApp can address it.
    const row = page.locator('.rec-row--emp', { hasText: name });
    await expect(row).toContainText('919876543210');

    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.rec-row--emp', { hasText: name })).toHaveCount(0);
  });

  test('full run: upload → review → generate → simulated send', async ({ page }) => {
    // ---- start the month ----
    await page.goto('/admin/payroll');
    await page.getByLabel('Pay month').fill(PERIOD);
    await page.getByTestId('start-run').click();
    await page.waitForURL('**/admin/payroll/**');
    await expect(page.locator('.editor__title')).toHaveText(PERIOD_LABEL);

    // WhatsApp is not configured in test, so the warning must be visible.
    await expect(page.locator('.notice').first()).toContainText('WhatsApp is not connected');
    await expect(page.locator('.notice__sample')).toContainText('salary statement for');

    // ---- upload the sheet ----
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(page.getByTestId('import-notice')).toContainText('Read 8 rows', {
      timeout: 15000,
    });
    await expect(page.locator('.pay-grid tbody tr')).toHaveCount(8);
    await expect(page.getByTestId('dirty-state')).toContainText('Unsaved changes');

    // Net recalculates live: 30000 gross over 30 days, 30 worked, +1200 bus pass
    await expect(page.getByTestId('net-0')).toHaveText('31,200.00');

    // The grid carries only what changes month to month; the rest of the
    // line opens underneath, with the arithmetic spelled out.
    await expect(page.getByTestId('gross-0')).toBeHidden();
    await page.getByTestId('expand-3').click();
    const detail = page.getByTestId('detail-3');
    await expect(detail).toContainText('How this was worked out');
    // 23000 over 30 days, 30 worked, 34 OT hrs at 766.67/8.5 an hour.
    await expect(detail).toContainText('23,000.00 ÷ 30 days');
    await expect(detail).toContainText('OT 34 hrs ÷ 8.5');
    await expect(page.getByTestId('earnings-3')).toHaveText('30,016.67');
    // Advance is editable there too: 2000 pending less 1000 taken.
    await expect(page.getByTestId('advpending-3')).toHaveValue('2000');
    await expect(page.getByTestId('advbal-3')).toHaveText('1,000.00');
    await page.getByTestId('expand-3').click();
    await expect(page.getByTestId('detail-3')).toHaveCount(0);

    // The full sheet view is one toggle away, for reconciling at month end.
    await page.getByTestId('toggle-workings').click();
    await expect(page.getByTestId('perday-0')).toHaveText('1,000.00');
    await expect(page.getByTestId('earned-0')).toHaveText('30,000.00');
    await expect(page.getByTestId('otamt-3')).toHaveText('3,066.67');
    await expect(page.getByTestId('total-3')).toHaveText('28,816.67');
    await page.getByTestId('toggle-workings').click();
    await expect(page.getByTestId('perday-0')).toHaveCount(0);

    // ---- edit a cell and watch the total move ----
    const before = await page.getByTestId('total-net').innerText();
    await page.getByTestId('days-0').fill('15');
    await expect(page.getByTestId('net-0')).toHaveText('16,200.00'); // 15000 + 1200
    await expect(page.getByTestId('total-net')).not.toHaveText(before);
    await page.getByTestId('days-0').fill('30');
    await expect(page.getByTestId('net-0')).toHaveText('31,200.00');

    // ---- save ----
    await page.getByTestId('save-draft').click();
    await expect(page.locator('.form-success')).toContainText('Draft saved');
    await expect(page.getByTestId('dirty-state')).toHaveText('Saved');

    // ---- generate ----
    await page.getByTestId('generate-payslips').click();
    await expect(page.locator('.form-success')).toContainText('Generated 8', {
      timeout: 30000,
    });
    await expect(page.locator('.chip-idle', { hasText: 'Ready' }).first()).toBeVisible();

    // ---- send (simulated) ----
    page.once('dialog', (d) => {
      expect(d.message()).toContain('simulation');
      d.accept();
    });
    await page.getByTestId('send-payslips').click();
    await expect(page.locator('.form-success')).toContainText('Simulated:', {
      timeout: 30000,
    });
    // Seven have numbers; the eighth is skipped for the right reason.
    // Scoped to the desktop grid — the mobile cards render the same
    // people again, hidden by CSS but still in the DOM.
    await expect(page.locator('.pay-grid .chip-ok')).toHaveCount(7);
    await expect(page.locator('.pay-grid .chip-warn')).toHaveCount(1);
    await expect(page.locator('.pay-grid .chip-warn')).toHaveAttribute(
      'title',
      /No phone number/
    );
  });

  test('generated payslips download as a zip', async ({ page }) => {
    await page.goto('/admin/payroll');
    await page.getByLabel('Pay month').fill(PERIOD);
    await page.getByTestId('start-run').click();
    await page.waitForURL('**/admin/payroll/**');
    const runId = page.url().split('/').pop();

    const res = await page.request.get(`/api/payroll/${runId}/download`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toBe('application/zip');
    expect(Number(res.headers()['content-length'] ?? 1)).toBeGreaterThan(0);
  });

  test('a month cannot be started twice', async ({ page }) => {
    const first = await page.request.post('/api/payroll', { data: { period: PERIOD } });
    const a = await first.json();
    const second = await page.request.post('/api/payroll', { data: { period: PERIOD } });
    const b = await second.json();
    expect(b.existed).toBe(true);
    expect(b.run.id).toBe(a.run.id);
  });

  test('payroll endpoints reject anonymous callers', async ({ request }) => {
    expect((await request.get('/api/employees')).status()).toBe(401);
    expect((await request.get('/api/payroll')).status()).toBe(401);
    expect((await request.post('/api/payroll', { data: { period: PERIOD } })).status()).toBe(
      401
    );
    expect((await request.get('/api/payroll/1/download')).status()).toBe(401);
    expect((await request.post('/api/payroll/1/send', { data: {} })).status()).toBe(401);
  });

  test('a non-numeric run id is a 404, not a server error', async ({ page }) => {
    const res = await page.request.get('/api/payroll/not-a-number');
    expect(res.status()).toBe(404);
  });

  test('a non-numeric run id renders the not-found page, not a crash', async ({ page }) => {
    const res = await page.goto('/admin/payroll/not-a-number');
    expect(res?.status()).toBe(404);
  });
});

/* The phone layout is a different set of screens, not a narrower table:
   cards, a per-person editor, and a payslip preview. */
test.describe('Payroll on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await cleanup(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test('cards, per-person editing and the payslip preview', async ({ page }) => {
    const { run } = await (
      await page.request.post('/api/payroll', { data: { period: PERIOD } })
    ).json();
    await page.goto(`/admin/payroll/${run.id}`);

    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(page.getByTestId('import-notice')).toContainText('Read 8 rows', {
      timeout: 15000,
    });
    await page.getByTestId('save-draft').click();
    await expect(page.locator('.form-success')).toContainText('Draft saved');

    // One card per person, and the wide grid stays out of the way.
    await expect(page.locator('.pay-card')).toHaveCount(8);
    await expect(page.locator('.grid-scroll')).toBeHidden();
    await expect(page.locator('.pay-card').nth(1)).toContainText('BHAVNA SINGH');

    // ---- edit one person ----
    await page.getByTestId('edit-pay-1').click();
    const sheet = page.getByTestId('pay-sheet-edit');
    await expect(sheet).toContainText('BHAVNA SINGH');
    await expect(page.getByTestId('sheet-net')).toHaveText('Rs 39,929.00');

    await page.getByTestId('sheet-days').fill('14');
    // 39000 x 14/30 = 18,200 earned; the net band follows immediately.
    await expect(page.getByTestId('sheet-net')).toHaveText('Rs 21,729.00');
    await page.getByTestId('sheet-days').fill('28');
    await expect(page.getByTestId('sheet-net')).toHaveText('Rs 39,929.00');

    await page.locator('.pay-sheet__back').click();
    await expect(page.locator('.pay-card')).toHaveCount(8);

    // ---- payslip preview ----
    await page.getByTestId('view-slip-1').click();
    const slip = page.getByTestId('pay-sheet-slip');
    await expect(slip).toContainText('BHAVNA SINGH');
    await expect(slip.locator('.slip__net-value')).toHaveText('Rs 39,929.00');
    await expect(slip).toContainText('Total earnings');
    await expect(slip).toContainText('Total deductions');
    await expect(page.getByRole('button', { name: 'Send to Bhavna' })).toBeVisible();
  });

  test('employees show as cards with a sticky add button', async ({ page }) => {
    await page.goto('/admin/employees');
    await expect(page.locator('.emp-card').first()).toBeVisible();
    await expect(page.locator('.rec-table')).toBeHidden();
    // The header button is hidden on a phone; the sticky bar carries it.
    await expect(page.getByTestId('add-employee')).toBeHidden();
    await expect(
      page.locator('.pay-bar').getByRole('button', { name: '+ Add employee' })
    ).toBeVisible();
    await expect(page.locator('.emp-card').first().locator('.emp-stat')).toHaveCount(3);
  });
});
