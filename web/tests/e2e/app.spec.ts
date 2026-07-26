import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@sigmaalutech.in';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'sigma-admin-2026';

// 1x1 red pixel PNG for upload tests
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin/products');
}

test.describe('Home', () => {
  test('renders the hero, stats and content drawn from the database', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__title')).toContainText('framed in aluminium');
    await expect(page.locator('.eyebrow').first()).toContainText('Authorized Technal Partner');
    // Stats read live counts, so just assert the strip rendered with 3 cells.
    await expect(page.locator('.stats .stat')).toHaveCount(3);
    await expect(page.locator('.rail .mini-card').first()).toBeVisible();
    await expect(page.locator('.feature-project')).toBeVisible();
  });

  test('hero copy stays light on the ink block in light theme', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const color = await page
      .locator('.hero__title')
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(247, 243, 234)');
  });

  test('featured product card navigates to its detail page', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.rail .mini-card').first();
    const name = await card.locator('.mini-card__title').innerText();
    await card.click();
    await page.waitForURL('**/products/**');
    await expect(page.locator('.detail__title')).toHaveText(name);
  });
});

test.describe('Theme', () => {
  test('light is the default and the toggle persists across pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.locator('[data-theme-toggle]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(20, 17, 12)');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto('/products');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Products', () => {
  test('list renders and the category filter narrows it', async ({ page }) => {
    await page.goto('/products');
    await page.locator('#productsGrid .card').first().waitFor();
    const total = await page.locator('#productsGrid .card').count();
    await page.locator('.filter-btn[data-category="windows"]').click();
    const filtered = await page.locator('#productsGrid .card').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    // The active filter is reflected in the URL so it can be shared.
    await expect(page).toHaveURL(/category=windows/);
  });

  test('a ?category= link opens with that filter applied', async ({ page }) => {
    await page.goto('/products?category=doors');
    await expect(page.locator('.filter-btn[data-category="doors"]')).toHaveClass(/active/);
  });

  test('detail page shows specs, features and finishes', async ({ page }) => {
    await page.goto('/products');
    await page.locator('#productsGrid .card').first().click();
    await page.waitForURL('**/products/**');
    await expect(page.locator('.detail__title')).not.toHaveText('');
    await expect(page.locator('.breadcrumb')).toContainText('Products');
    await expect(page.locator('.feature-list li').first()).toBeVisible();
    await expect(page.locator('.spec-grid .spec').first()).toBeVisible();
    await expect(page.locator('.finish').first()).toBeVisible();
  });

  test('unknown product slug returns 404', async ({ page }) => {
    const res = await page.goto('/products/no-such-product');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Projects', () => {
  test('list renders and cards link to detail pages', async ({ page }) => {
    await page.goto('/projects');
    const card = page.locator('#projectsGrid .project-card').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForURL('**/projects/**');
    await expect(page.locator('.detail__title')).not.toHaveText('');
    await expect(page.locator('.spec-grid .spec').first()).toBeVisible();
  });

  test('unknown project slug returns 404', async ({ page }) => {
    const res = await page.goto('/projects/no-such-project');
    expect(res?.status()).toBe(404);
  });
});

test.describe('About', () => {
  test('renders intro, partnership panel, stats and contact block', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('.page-intro__title')).toContainText('aluminium craft');
    // Regression guard: JSX used to swallow the space after an expression here.
    await expect(page.locator('.page-intro__lead')).toContainText('Sigma Alutech fabricates');
    await expect(page.locator('.about-card__title')).toContainText('Technal');
    await expect(page.locator('.stats--quad .stat')).toHaveCount(4);
    await expect(page.locator('#contact')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('mobile drawer opens, navigates and closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.locator('.nav__toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.nav__drawer-link', { hasText: 'Projects' }).click();
    await page.waitForURL('**/projects');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('desktop shows inline links instead of the drawer toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.locator('.nav__links .nav__link').first()).toBeVisible();
    await expect(page.locator('.nav__toggle')).toBeHidden();
  });
});

test.describe('Admin auth', () => {
  test('admin pages redirect to login when signed out', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForURL('**/admin');
    await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
  });

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('.form-error')).toContainText('Incorrect email or password');
  });

  test('login and logout round-trip', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL('**/admin');
    await page.goto('/admin/products');
    await page.waitForURL('**/admin');
  });
});

test.describe('Admin product CRUD (full lifecycle)', () => {
  const slug = `e2e-test-window-${Date.now()}`;
  const name = 'E2E Test Window';

  test('create with upload, verify on the public site, edit, delete', async ({ page }) => {
    await login(page);

    // ---- Create ----
    await page.getByTestId('add-product').click();
    await page.getByLabel('Name *').fill(name);
    await page.getByLabel('Slug (URL id — auto-generated)').fill(slug);
    await page.getByLabel('Tagline (one line on the card)').fill('Created by Playwright');
    await page.getByLabel('Series (e.g. FY 65)').fill('E2E 100');
    await page.getByLabel('Type badge (e.g. casement, sliding)').fill('casement');

    await page.getByRole('button', { name: '+ Add', exact: true }).first().click();
    await page.locator('.list-editor__row input').first().fill('Playwright tested');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect(page.locator('.image-uploader__item img')).toHaveCount(1);

    await page
      .getByLabel('YouTube video URL (optional)')
      .fill('https://www.youtube.com/watch?v=tu9WlspEjo0');

    await page.getByRole('button', { name: 'Create Product' }).click();
    await expect(page.locator('.form-success')).toContainText('created');
    await expect(page.getByTestId(`product-row-${slug}`)).toBeVisible();

    // ---- Verify on the public detail page ----
    await page.goto(`/products/${slug}`);
    await expect(page.locator('.detail__title')).toHaveText(name);
    await expect(page.locator('.video iframe')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
    await expect(page.locator('.feature-list li')).toContainText(['Playwright tested']);

    // ---- Edit ----
    await page.goto('/admin/products');
    await page.getByTestId(`product-row-${slug}`).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Tagline (one line on the card)').fill('Updated by Playwright');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('.form-success')).toContainText('updated');

    await page.goto('/products');
    await expect(
      page.locator('#productsGrid .card', { hasText: 'Updated by Playwright' })
    ).toBeVisible();

    // ---- Delete ----
    await page.goto('/admin/products');
    page.on('dialog', (d) => d.accept());
    await page.getByTestId(`product-row-${slug}`).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId(`product-row-${slug}`)).not.toBeVisible();

    const res = await page.goto(`/products/${slug}`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('API guards', () => {
  test('mutating endpoints reject unauthenticated requests', async ({ request }) => {
    expect((await request.post('/api/products', { data: {} })).status()).toBe(401);
    expect((await request.delete('/api/products/1')).status()).toBe(401);
    expect(
      (await request.post('/api/uploads', { multipart: { folder: 'products' } })).status()
    ).toBe(401);
  });

  test('catalog API is public and well-formed', async ({ request }) => {
    const res = await request.get('/api/catalog');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThanOrEqual(6);
    expect(data.categories[0]).toHaveProperty('products');
  });
});
