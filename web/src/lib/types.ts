// Serializable shapes shared between server and client components.

export interface ProductDto {
  id: number;
  slug: string;
  categoryId: number;
  name: string;
  series: string;
  topology: string;
  tagline: string;
  description: string;
  features: string[];
  specifications: Record<string, string>;
  finishes: string[];
  images: string[];
  videoUrl: string | null;
  featured: boolean;
  sortOrder: number;
}

export interface CategoryDto {
  id: number;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  products: ProductDto[];
}

export interface ProjectCategoryDto {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface ProjectDto {
  id: number;
  slug: string;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  name: string;
  location: string;
  architect: string;
  year: number;
  type: string;
  description: string;
  productsUsed: string[];
  thumbnail: string;
  images: string[];
  videoUrl: string | null;
  featured: boolean;
  sortOrder: number;
}

export function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
