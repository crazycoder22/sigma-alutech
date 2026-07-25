/**
 * Integration tests: data-access layer against a real Postgres
 * (sigma_test database — see tests/README in repo docs).
 * Requires TEST_DATABASE_URL or the default local docker instance.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://sigma:sigma@localhost:55432/sigma_test';

// Point the app's getDb() at the test database before importing the lib.
process.env.DATABASE_URL = TEST_URL;

const { getCatalog, createProduct, updateProduct, deleteProduct, createProject, getProjects } =
  await import('@/lib/catalog');

const client = postgres(TEST_URL, { max: 2, ssl: false });
const db = drizzle(client, { schema });

let windowsCategoryId: number;
let hospitalityCategoryId: number;

beforeAll(async () => {
  await db.delete(schema.projects);
  await db.delete(schema.products);
  await db.delete(schema.projectCategories);
  await db.delete(schema.categories);
  const [cat] = await db
    .insert(schema.categories)
    .values({ slug: 'windows', name: 'Windows', description: 'Window systems', sortOrder: 0 })
    .returning();
  windowsCategoryId = cat.id;
  const [pcat] = await db
    .insert(schema.projectCategories)
    .values({ slug: 'hospitality', name: 'Hospitality', sortOrder: 0 })
    .returning();
  hospitalityCategoryId = pcat.id;
});

beforeEach(async () => {
  await db.delete(schema.projects);
  await db.delete(schema.products);
});

afterAll(async () => {
  await client.end();
});

const productInput = {
  slug: 'itest-window',
  categoryId: 0, // set per-test
  name: 'ITest Window',
  series: 'IT 100',
  topology: 'casement',
  tagline: 'Integration test window',
  description: 'A window created by the integration suite.',
  features: ['Feature A', 'Feature B'],
  specifications: { 'Profile Depth': '65mm' },
  finishes: ['Anodized'],
  images: ['/uploads/products/itest.jpg'],
  videoUrl: null,
  featured: true,
  sortOrder: 0,
};

describe('product CRUD', () => {
  it('creates and reads back a product with JSONB fields intact', async () => {
    const created = await createProduct({ ...productInput, categoryId: windowsCategoryId });
    expect(created.id).toBeGreaterThan(0);

    const catalog = await getCatalog();
    const windows = catalog.find((c) => c.slug === 'windows')!;
    const found = windows.products.find((p) => p.slug === 'itest-window')!;
    expect(found.features).toEqual(['Feature A', 'Feature B']);
    expect(found.specifications).toEqual({ 'Profile Depth': '65mm' });
    expect(found.featured).toBe(true);
  });

  it('updates a product', async () => {
    const created = await createProduct({ ...productInput, categoryId: windowsCategoryId });
    const updated = await updateProduct(created.id, {
      ...productInput,
      categoryId: windowsCategoryId,
      name: 'Renamed Window',
      featured: false,
    });
    expect(updated?.name).toBe('Renamed Window');
    expect(updated?.featured).toBe(false);
    expect(updated?.updatedAt).toBeInstanceOf(Date);
  });

  it('returns null when updating or deleting a missing product', async () => {
    expect(await updateProduct(999999, { ...productInput, categoryId: windowsCategoryId })).toBeNull();
    expect(await deleteProduct(999999)).toBeNull();
  });

  it('deletes a product', async () => {
    const created = await createProduct({ ...productInput, categoryId: windowsCategoryId });
    await deleteProduct(created.id);
    const rows = await db.select().from(schema.products).where(eq(schema.products.id, created.id));
    expect(rows).toHaveLength(0);
  });

  it('enforces slug uniqueness at the DB level', async () => {
    await createProduct({ ...productInput, categoryId: windowsCategoryId });
    const { isDuplicateKeyError } = await import('@/lib/api-helpers');
    const err = await createProduct({ ...productInput, categoryId: windowsCategoryId }).then(
      () => null,
      (e) => e
    );
    expect(err).not.toBeNull();
    expect(isDuplicateKeyError(err)).toBe(true);
  });
});

describe('project queries', () => {
  it('joins the category name onto projects', async () => {
    await createProject({
      slug: 'itest-hotel',
      categoryId: hospitalityCategoryId,
      name: 'ITest Hotel',
      location: 'Bangalore',
      architect: '',
      year: 2024,
      type: '5-Star Hotel',
      description: '',
      productsUsed: ['windows'],
      thumbnail: '/uploads/projects/itest.jpg',
      images: [],
      videoUrl: null,
      featured: false,
      sortOrder: 0,
    });
    const projects = await getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].categoryName).toBe('Hospitality');
    expect(projects[0].categorySlug).toBe('hospitality');
    expect(projects[0].productsUsed).toEqual(['windows']);
  });
});

describe('cascade behavior', () => {
  it('deleting a category cascades to its products', async () => {
    const [tmp] = await db
      .insert(schema.categories)
      .values({ slug: 'tmp-cat', name: 'Tmp', description: '', sortOrder: 99 })
      .returning();
    await createProduct({ ...productInput, slug: 'tmp-product', categoryId: tmp.id });
    await db.delete(schema.categories).where(eq(schema.categories.id, tmp.id));
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.slug, 'tmp-product'));
    expect(rows).toHaveLength(0);
  });
});
