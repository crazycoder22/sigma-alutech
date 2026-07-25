import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens');

/** Accept watch/short/embed YouTube URLs (or empty) and normalize to embed form. */
export function normalizeYouTubeUrl(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Video must be a full YouTube URL');
  }
  const host = url.hostname.replace(/^www\./, '');
  let id = '';
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v') ?? '';
    else if (url.pathname.startsWith('/embed/')) id = url.pathname.slice('/embed/'.length);
    else if (url.pathname.startsWith('/shorts/')) id = url.pathname.slice('/shorts/'.length);
  } else if (host === 'youtu.be') {
    id = url.pathname.slice(1);
  }
  id = id.split('/')[0];
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
    throw new Error('Could not find a video id in that YouTube URL');
  }
  return `https://www.youtube.com/embed/${id}`;
}

export const productInputSchema = z.object({
  slug: slugSchema,
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  series: z.string().trim().max(60).default(''),
  topology: z.string().trim().max(40).default(''),
  tagline: z.string().trim().max(200).default(''),
  description: z.string().trim().max(4000).default(''),
  features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  specifications: z.record(z.string().max(60), z.string().max(200)).default({}),
  finishes: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  images: z.array(z.string().min(1).max(500)).max(20).default([]),
  videoUrl: z.string().nullable().default(null),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const projectInputSchema = z.object({
  slug: slugSchema,
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).default(''),
  architect: z.string().trim().max(120).default(''),
  year: z.number().int().min(1990).max(2100),
  type: z.string().trim().max(120).default(''),
  description: z.string().trim().max(4000).default(''),
  productsUsed: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  thumbnail: z.string().max(500).default(''),
  images: z.array(z.string().min(1).max(500)).max(30).default([]),
  videoUrl: z.string().nullable().default(null),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;

/** Turn a display name into a slug candidate. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
