// End-to-end tests: real browser against the statically served site.
const { test, expect } = require('@playwright/test');

test.describe('Theme', () => {
  test('light theme is the default on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    // --bg-primary light = #faf9f6
    expect(bg).toBe('rgb(250, 249, 246)');
  });

  test('toggle switches to dark and back', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-theme-toggle]').first();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    expect(darkBg).toBe('rgb(10, 10, 10)');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('chosen theme persists across reload and across pages', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-theme-toggle]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto('/products.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('toggle exists on every page', async ({ page }) => {
    for (const url of ['/', '/products.html', '/projects.html']) {
      await page.goto(url);
      await expect(page.locator('[data-theme-toggle]').first()).toBeVisible();
    }
  });
});

test.describe('Homepage', () => {
  test('renders hero and featured projects from JSON', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__title')).toHaveText('Sigma Alutech');
    await expect(page.locator('#featuredProjectsGrid .project-card').first()).toBeVisible();
  });

  test('hero text stays light in light theme (overlay nav)', async ({ page }) => {
    await page.goto('/');
    const color = await page
      .locator('.hero__title')
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(245, 245, 245)');
  });
});

test.describe('Products page', () => {
  test('renders product cards and category filters from JSON', async ({ page }) => {
    await page.goto('/products.html');
    await expect(page.locator('#productsGrid .card').first()).toBeVisible();
    expect(await page.locator('#productFilters .filter-btn').count()).toBeGreaterThan(1);
  });

  test('filtering by category narrows the grid', async ({ page }) => {
    await page.goto('/products.html');
    await page.locator('#productsGrid .card').first().waitFor();
    const total = await page.locator('#productsGrid .card').count();
    await page.locator('#productFilters .filter-btn[data-category="windows"]').click();
    const filtered = await page.locator('#productsGrid .card:visible').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
  });

  test('clicking a product opens the detail modal', async ({ page }) => {
    await page.goto('/products.html');
    await page.locator('#productsGrid .card').first().click();
    await expect(page.locator('#productModal')).toHaveClass(/open/);
    await expect(page.locator('#modalTitle')).not.toHaveText('');
  });
});

test.describe('Projects page', () => {
  test('renders project cards from JSON', async ({ page }) => {
    await page.goto('/projects.html');
    await expect(page.locator('#projectsGrid .project-card').first()).toBeVisible();
  });
});

test.describe('Admin (Decap CMS)', () => {
  test('admin page and config are served', async ({ page, request }) => {
    const res = await request.get('/admin/config.yml');
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toContain('crazycoder22/sigma-alutech');
    await page.goto('/admin/');
    await expect(page).toHaveTitle(/Content Manager/);
  });
});
