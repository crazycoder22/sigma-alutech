import 'server-only';
import { asc, eq } from 'drizzle-orm';
import {
  getDb,
  categories,
  products,
  projectCategories,
  projects,
  type Category,
  type Product,
  type Project,
  type ProjectCategory,
} from '@/db';
import type { ProductInput, ProjectInput } from './validation';

export interface CategoryWithProducts extends Category {
  products: Product[];
}

export async function getCatalog(): Promise<CategoryWithProducts[]> {
  const db = getDb();
  const cats = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  const prods = await db
    .select()
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.id));
  return cats.map((c) => ({
    ...c,
    products: prods.filter((p) => p.categoryId === c.id),
  }));
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const db = getDb();
  return db
    .select()
    .from(products)
    .where(eq(products.featured, true))
    .orderBy(asc(products.sortOrder), asc(products.id));
}

export async function getProjectCategories(): Promise<ProjectCategory[]> {
  const db = getDb();
  return db
    .select()
    .from(projectCategories)
    .orderBy(asc(projectCategories.sortOrder), asc(projectCategories.id));
}

export interface ProjectWithCategory extends Project {
  categorySlug: string;
  categoryName: string;
}

export async function getProjects(): Promise<ProjectWithCategory[]> {
  const db = getDb();
  const rows = await db
    .select({
      project: projects,
      categorySlug: projectCategories.slug,
      categoryName: projectCategories.name,
    })
    .from(projects)
    .innerJoin(projectCategories, eq(projects.categoryId, projectCategories.id))
    .orderBy(asc(projects.sortOrder), asc(projects.id));
  return rows.map((r) => ({
    ...r.project,
    categorySlug: r.categorySlug,
    categoryName: r.categoryName,
  }));
}

export async function getFeaturedProjects(): Promise<ProjectWithCategory[]> {
  const all = await getProjects();
  return all.filter((p) => p.featured).slice(0, 6);
}

export interface ProductWithCategory extends Product {
  categorySlug: string;
  categoryName: string;
}

export async function getProductBySlug(
  slug: string
): Promise<ProductWithCategory | null> {
  const db = getDb();
  const [row] = await db
    .select({
      product: products,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug));
  if (!row) return null;
  return {
    ...row.product,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
  };
}

export async function getProjectBySlug(
  slug: string
): Promise<ProjectWithCategory | null> {
  const db = getDb();
  const [row] = await db
    .select({
      project: projects,
      categorySlug: projectCategories.slug,
      categoryName: projectCategories.name,
    })
    .from(projects)
    .innerJoin(projectCategories, eq(projects.categoryId, projectCategories.id))
    .where(eq(projects.slug, slug));
  if (!row) return null;
  return {
    ...row.project,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
  };
}

/**
 * Projects that list this product's category in `productsUsed`.
 * The data records categories rather than individual systems, so this
 * is "projects that used something from this category".
 */
export async function getProjectsUsingCategory(
  categorySlug: string,
  limit = 3
): Promise<ProjectWithCategory[]> {
  const all = await getProjects();
  return all
    .filter((p) => p.productsUsed.includes(categorySlug))
    .sort((a, b) => b.year - a.year)
    .slice(0, limit);
}

/** The next project in portfolio order, wrapping at the end. */
export async function getAdjacentProject(
  slug: string
): Promise<ProjectWithCategory | null> {
  const all = (await getProjects()).sort((a, b) => b.year - a.year);
  if (all.length < 2) return null;
  const index = all.findIndex((p) => p.slug === slug);
  if (index === -1) return all[0];
  return all[(index + 1) % all.length];
}

/** Headline numbers shown on the home and about pages. */
export async function getSiteStats(): Promise<{
  projects: number;
  categories: number;
  products: number;
}> {
  const db = getDb();
  const [projectRows, categoryRows, productRows] = await Promise.all([
    db.select({ id: projects.id }).from(projects),
    db.select({ id: categories.id }).from(categories),
    db.select({ id: products.id }).from(products),
  ]);
  return {
    projects: projectRows.length,
    categories: categoryRows.length,
    products: productRows.length,
  };
}

// ---------- Admin mutations ----------

export async function createProduct(input: ProductInput): Promise<Product> {
  const db = getDb();
  const [row] = await db.insert(products).values(input).returning();
  return row;
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product | null> {
  const db = getDb();
  const [row] = await db
    .update(products)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return row ?? null;
}

export async function deleteProduct(id: number): Promise<Product | null> {
  const db = getDb();
  const [row] = await db.delete(products).where(eq(products.id, id)).returning();
  return row ?? null;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const db = getDb();
  const [row] = await db.insert(projects).values(input).returning();
  return row;
}

export async function updateProject(id: number, input: ProjectInput): Promise<Project | null> {
  const db = getDb();
  const [row] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

export async function deleteProject(id: number): Promise<Project | null> {
  const db = getDb();
  const [row] = await db.delete(projects).where(eq(projects.id, id)).returning();
  return row ?? null;
}
