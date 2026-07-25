/**
 * One-time (idempotent) migration: imports the legacy JSON catalogs from the
 * static site (../data/products.json, ../data/projects.json) into Postgres.
 *
 * Existing rows are matched by slug and updated; new rows are inserted.
 * Image paths are kept as-is (/images/...) — those files are copied into
 * web/public/images so URLs remain stable.
 *
 * Run: npm run db:migrate-json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_ROOT = path.resolve(HERE, '../..');

interface LegacyProduct {
  id: string;
  name: string;
  series: string;
  topology: string;
  tagline: string;
  description: string;
  features: string[];
  specifications: Record<string, string>;
  finishes: string[];
  images: string[];
  video: string | null;
  featured: boolean;
}

interface LegacyProductsFile {
  categories: Array<{
    id: string;
    name: string;
    description: string;
    products: LegacyProduct[];
  }>;
}

interface LegacyProjectsFile {
  categories: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    location: string;
    architect: string;
    year: number;
    category: string;
    type: string;
    description: string;
    productsUsed: string[];
    thumbnail: string;
    images: string[];
    video?: string | null;
    featured: boolean;
  }>;
}

/** Legacy paths are repo-relative ("images/..."); serve them root-relative. */
function toWebPath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, {
    max: 1,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
  });
  const db = drizzle(client, { schema });

  const productsFile: LegacyProductsFile = JSON.parse(
    fs.readFileSync(path.join(LEGACY_ROOT, 'data/products.json'), 'utf8')
  );
  const projectsFile: LegacyProjectsFile = JSON.parse(
    fs.readFileSync(path.join(LEGACY_ROOT, 'data/projects.json'), 'utf8')
  );

  // ---- product categories & products ----
  let sort = 0;
  for (const cat of productsFile.categories) {
    const existing = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, cat.id));
    let categoryId: number;
    const catValues = {
      slug: cat.id,
      name: cat.name,
      description: cat.description ?? '',
      sortOrder: sort++,
    };
    if (existing.length) {
      const [row] = await db
        .update(schema.categories)
        .set(catValues)
        .where(eq(schema.categories.id, existing[0].id))
        .returning();
      categoryId = row.id;
    } else {
      const [row] = await db.insert(schema.categories).values(catValues).returning();
      categoryId = row.id;
    }

    let psort = 0;
    for (const p of cat.products) {
      const values = {
        slug: p.id,
        categoryId,
        name: p.name,
        series: p.series ?? '',
        topology: p.topology ?? '',
        tagline: p.tagline ?? '',
        description: p.description ?? '',
        features: p.features ?? [],
        specifications: p.specifications ?? {},
        finishes: p.finishes ?? [],
        images: (p.images ?? []).map(toWebPath),
        videoUrl: p.video ?? null,
        featured: Boolean(p.featured),
        sortOrder: psort++,
      };
      const found = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.slug, p.id));
      if (found.length) {
        await db
          .update(schema.products)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.products.id, found[0].id));
      } else {
        await db.insert(schema.products).values(values);
      }
    }
  }

  // ---- project categories & projects ----
  let csort = 0;
  const projCatIds = new Map<string, number>();
  for (const cat of projectsFile.categories.filter((c) => c.id !== 'all')) {
    const values = { slug: cat.id, name: cat.name, sortOrder: csort++ };
    const existing = await db
      .select()
      .from(schema.projectCategories)
      .where(eq(schema.projectCategories.slug, cat.id));
    if (existing.length) {
      const [row] = await db
        .update(schema.projectCategories)
        .set(values)
        .where(eq(schema.projectCategories.id, existing[0].id))
        .returning();
      projCatIds.set(cat.id, row.id);
    } else {
      const [row] = await db.insert(schema.projectCategories).values(values).returning();
      projCatIds.set(cat.id, row.id);
    }
  }

  let jsort = 0;
  for (const p of projectsFile.projects) {
    const categoryId = projCatIds.get(p.category);
    if (!categoryId) throw new Error(`Project ${p.id}: unknown category ${p.category}`);
    const values = {
      slug: p.id,
      categoryId,
      name: p.name,
      location: p.location ?? '',
      architect: p.architect ?? '',
      year: p.year,
      type: p.type ?? '',
      description: p.description ?? '',
      productsUsed: p.productsUsed ?? [],
      thumbnail: toWebPath(p.thumbnail),
      images: (p.images ?? []).map(toWebPath),
      videoUrl: p.video ?? null,
      featured: Boolean(p.featured),
      sortOrder: jsort++,
    };
    const found = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.slug, p.id));
    if (found.length) {
      await db
        .update(schema.projects)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.projects.id, found[0].id));
    } else {
      await db.insert(schema.projects).values(values);
    }
  }

  const counts = {
    categories: (await db.select().from(schema.categories)).length,
    products: (await db.select().from(schema.products)).length,
    projectCategories: (await db.select().from(schema.projectCategories)).length,
    projects: (await db.select().from(schema.projects)).length,
  };
  console.log('Migration complete:', counts);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
