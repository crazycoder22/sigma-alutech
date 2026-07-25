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

test.describe('Public site', () => {
  test('homepage renders hero, categories, and featured projects from the DB', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__title')).toHaveText('Sigma Alutech');
    expect(await page.locator('.category-card').count()).toBeGreaterThanOrEqual(6);
    await expect(page.locator('#featuredProjectsGrid .project-card').first()).toBeVisible();
  });

  test('products page renders and category filter narrows the grid', async ({ page }) => {
    await page.goto('/products');
    await page.locator('#productsGrid .card').first().waitFor();
    const total = await page.locator('#productsGrid .card').count();
    await page.locator('.filter-btn[data-category="windows"]').click();
    const filtered = await page.locator('#productsGrid .card').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
  });

  test('product modal shows specs, features, and finishes', async ({ page }) => {
    await page.goto('/products');
    await page.locator('#productsGrid .card').first().click();
    const modal = page.locator('#productModal');
    await expect(modal).toHaveClass(/open/);
    await expect(modal.locator('.modal__title')).not.toHaveText('');
    await expect(modal.locator('.specs-table tr').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);
  });

  test('projects page renders and modal opens', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('#projectsGrid .project-card').first().waitFor();
    await page.locator('#projectsGrid .project-card').first().click();
    await expect(page.locator('#projectModal')).toHaveClass(/open/);
  });

  test('theme defaults to light and toggle persists across reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('[data-theme-toggle]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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
    // Session gone: direct nav bounces back to login
    await page.goto('/admin/products');
    await page.waitForURL('**/admin');
  });
});

test.describe('Admin product CRUD (full lifecycle)', () => {
  const slug = `e2e-test-window-${Date.now()}`;
  const name = 'E2E Test Window';

  test('create product with image upload, verify on public site, edit, delete', async ({ page }) => {
    await login(page);

    // ---- Create ----
    await page.getByTestId('add-product').click();
    await page.getByLabel('Name *').fill(name);
    await page.getByLabel('Slug (URL id — auto-generated)').fill(slug);
    await page.getByLabel('Tagline (one line on the card)').fill('Created by Playwright');
    await page.getByLabel('Series (e.g. FY 65)').fill('E2E 100');
    await page.getByLabel('Type badge (e.g. casement, sliding)').fill('casement');

    // Feature list
    await page.getByRole('button', { name: '+ Add', exact: true }).first().click();
    await page.locator('.list-editor__row input').first().fill('Playwright tested');

    // Image upload through the real upload API (local storage driver)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect(page.locator('.image-uploader__item img')).toHaveCount(1);

    // YouTube URL gets normalized server-side
    await page
      .getByLabel('YouTube video URL (optional)')
      .fill('https://www.youtube.com/watch?v=tu9WlspEjo0');

    await page.getByRole('button', { name: 'Create Product' }).click();
    await expect(page.locator('.form-success')).toContainText('created');
    await expect(page.getByTestId(`product-row-${slug}`)).toBeVisible();

    // ---- Verify on the public site ----
    await page.goto('/products');
    const card = page.locator('#productsGrid .card', { hasText: name });
    await expect(card).toBeVisible();
    await card.click();
    const modal = page.locator('#productModal');
    await expect(modal.locator('.modal__title')).toHaveText(name);
    // normalized embed URL is used for the video iframe
    await expect(modal.locator('.video-container iframe')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
    await page.keyboard.press('Escape');

    // ---- Edit ----
    await page.goto('/admin/products');
    await page.getByTestId(`product-row-${slug}`).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Tagline (one line on the card)').fill('Updated by Playwright');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('.form-success')).toContainText('updated');

    await page.goto('/products');
    await expect(page.locator('#productsGrid .card', { hasText: 'Updated by Playwright' })).toBeVisible();

    // ---- Delete ----
    await page.goto('/admin/products');
    page.on('dialog', (d) => d.accept());
    await page.getByTestId(`product-row-${slug}`).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId(`product-row-${slug}`)).not.toBeVisible();

    await page.goto('/products');
    await expect(page.locator('#productsGrid .card', { hasText: name })).not.toBeVisible();
  });
});

test.describe('API guards', () => {
  test('mutating endpoints reject unauthenticated requests', async ({ request }) => {
    const post = await request.post('/api/products', { data: {} });
    expect(post.status()).toBe(401);
    const del = await request.delete('/api/products/1');
    expect(del.status()).toBe(401);
    const upload = await request.post('/api/uploads', {
      multipart: { folder: 'products' },
    });
    expect(upload.status()).toBe(401);
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
