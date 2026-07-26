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
    await expect(page.locator('.admin-head__title')).toHaveText('Products');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/admin');
    await page.goto('/admin/products');
    await page.waitForURL('**/admin');
  });
});

test.describe('Admin shell', () => {
  test('desktop shows the ink sidebar with live counts', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    const side = page.locator('.admin-side');
    await expect(side).toBeVisible();
    await expect(side.locator('.admin-side__link.active')).toContainText('Products');
    // Count in the sidebar matches the count in the page header.
    const sidebarCount = await side.locator('.admin-side__link.active .admin-side__count').innerText();
    await expect(page.locator('.admin-head__meta')).toContainText(`${sidebarCount} items`);
    await expect(page.locator('.rec-table')).toBeVisible();
  });

  test('mobile shows the tab bar and card list instead', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await expect(page.locator('.admin-tabs')).toBeVisible();
    await expect(page.locator('.admin-side')).toBeHidden();
    await expect(page.locator('.rec-list .rec').first()).toBeVisible();
    await expect(page.locator('.rec-table')).toBeHidden();
  });

  test('tabs navigate between products and projects', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.locator('.admin-side__link', { hasText: 'Projects' }).click();
    await page.waitForURL('**/admin/projects');
    await expect(page.locator('.admin-head__title')).toHaveText('Projects');
  });
});

test.describe('Admin list controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
  });

  test('search narrows the list', async ({ page }) => {
    const before = await page.locator('.rec-table .rec-row:not(.rec-row--head)').count();
    await page.getByLabel('Search products').fill('casement');
    const after = await page.locator('.rec-table .rec-row:not(.rec-row--head)').count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test('search with no matches shows the empty state', async ({ page }) => {
    await page.getByLabel('Search products').fill('zzzznothing');
    await expect(page.locator('.admin-empty')).toBeVisible();
  });

  test('category filter narrows the list', async ({ page }) => {
    const before = await page.locator('.rec-table .rec-row:not(.rec-row--head)').count();
    await page.locator('.admin-filters .filter-btn[data-category="doors"]').click();
    const after = await page.locator('.rec-table .rec-row:not(.rec-row--head)').count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test('featured-only filter shows just starred rows', async ({ page }) => {
    await page.getByTestId('featured-filter').click();
    const rows = page.locator('.rec-table .rec-row:not(.rec-row--head)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(rows.locator('.star--on')).toHaveCount(count);
  });

  test('star toggles featured and persists on the public homepage', async ({ page }) => {
    const row = page.locator('.rec-table .rec-row:not(.rec-row--head)').first();
    const name = await row.locator('.rec-row__name').innerText();
    const wasFeatured = await row.locator('.star--on').count();

    await row.locator('.star').click();
    await expect
      .poll(async () => page.locator('.rec-table .rec-row', { hasText: name }).locator('.star--on').count())
      .toBe(wasFeatured ? 0 : 1);

    // Put it back so the suite is idempotent.
    await page.locator('.rec-table .rec-row', { hasText: name }).locator('.star').click();
    await expect
      .poll(async () => page.locator('.rec-table .rec-row', { hasText: name }).locator('.star--on').count())
      .toBe(wasFeatured ? 1 : 0);
  });
});

test.describe('Admin editor', () => {
  test('tracks unsaved changes and can discard them', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.locator('.rec-row .btn', { hasText: 'Edit' }).first().click();

    await expect(page.getByTestId('product-editor')).toBeVisible();
    await expect(page.getByTestId('dirty-state')).toHaveText('Saved');

    await page.getByLabel('Series').fill('CHANGED');
    await expect(page.getByTestId('dirty-state')).toContainText('Unsaved changes');

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('product-editor')).toBeHidden();
  });

  test('features reorder with the keyboard control', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.locator('.rec-row .btn', { hasText: 'Edit' }).first().click();

    const inputs = page.locator('.rep__row input');
    const first = await inputs.first().inputValue();
    const second = await inputs.nth(1).inputValue();
    test.skip(first === second, 'needs two distinct features');

    await page.locator('.rep__row').nth(1).getByRole('button', { name: /Move item 2 up/ }).click();
    await expect(inputs.first()).toHaveValue(second);
    await expect(page.getByTestId('dirty-state')).toContainText('Unsaved changes');
  });

  test('card preview mirrors what is typed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.getByTestId('add-product').click();
    await page.getByLabel('Name').fill('Preview Probe');
    await page.getByLabel('Tagline').fill('Live preview line');
    await expect(page.locator('.preview-card__title')).toHaveText('Preview Probe');
    await expect(page.locator('.preview-card__text')).toHaveText('Live preview line');
  });

  test('tagline counter flags going over the soft limit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.getByTestId('add-product').click();
    await page.getByLabel('Tagline').fill('x'.repeat(61));
    await expect(page.locator('.field__counter')).toHaveClass(/field__counter--over/);
  });
});

test.describe('Admin product CRUD (full lifecycle)', () => {
  const slug = `e2e-test-window-${Date.now()}`;
  const name = 'E2E Test Window';

  test('create with upload, verify on the public site, edit, delete', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // ---- Create ----
    await page.getByTestId('add-product').click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Slug (auto)').fill(slug);
    await page.getByLabel('Tagline').fill('Created by Playwright');
    await page.getByLabel('Series').fill('E2E 100');
    await page.getByLabel('Type badge').fill('casement');

    await page.getByRole('button', { name: '+ Add feature' }).click();
    await page.locator('.rep__row input').first().fill('Playwright tested');

    await page.getByRole('button', { name: '+ Add spec' }).click();
    await page.locator('.spec-table__key').first().fill('Max Width');
    await page.locator('.spec-table__value').first().fill('1400 mm');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect(page.locator('.img-tile img')).toHaveCount(1);
    await expect(page.locator('.img-tile__badge')).toHaveText('Main');

    await page.getByLabel('YouTube video URL').fill('https://www.youtube.com/watch?v=tu9WlspEjo0');

    // Featured toggle is a switch, not a checkbox.
    await page.locator('.switch').click();
    await expect(page.locator('.switch')).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Create product' }).first().click();
    await expect(page.locator('.form-success')).toContainText('created');
    await expect(page.getByTestId(`product-tr-${slug}`)).toBeVisible();

    // ---- Verify on the public site ----
    await page.goto(`/products/${slug}`);
    await expect(page.locator('.detail__title')).toHaveText(name);
    await expect(page.locator('.video iframe')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
    await expect(page.locator('.feature-list li')).toContainText(['Playwright tested']);
    await expect(page.locator('.spec-grid .spec')).toContainText(['1400 mm']);

    await page.goto('/');
    await expect(page.locator('.rail .mini-card', { hasText: name })).toBeVisible();

    // ---- Edit ----
    await page.goto('/admin/products');
    await page.getByTestId(`product-tr-${slug}`).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Tagline').fill('Updated by Playwright');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(page.locator('.form-success')).toContainText('updated');

    await page.goto('/products');
    await expect(
      page.locator('#productsGrid .card', { hasText: 'Updated by Playwright' })
    ).toBeVisible();

    // ---- Delete ----
    await page.goto('/admin/products');
    page.on('dialog', (d) => d.accept());
    await page.getByTestId(`product-tr-${slug}`).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId(`product-tr-${slug}`)).not.toBeVisible();

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
