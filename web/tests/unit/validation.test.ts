import { describe, it, expect } from 'vitest';
import {
  normalizeYouTubeUrl,
  productInputSchema,
  projectInputSchema,
  slugify,
} from '@/lib/validation';

describe('slugify', () => {
  it('kebab-cases display names', () => {
    expect(slugify('FY 65 Casement Window')).toBe('fy-65-casement-window');
    expect(slugify('  Facades & Curtain Walls ')).toBe('facades-and-curtain-walls');
    expect(slugify('Ökonom!!')).toBe('konom');
  });
});

describe('normalizeYouTubeUrl', () => {
  it('returns null for empty input', () => {
    expect(normalizeYouTubeUrl('')).toBeNull();
    expect(normalizeYouTubeUrl(null)).toBeNull();
    expect(normalizeYouTubeUrl('   ')).toBeNull();
  });

  it('normalizes watch URLs to embed form', () => {
    expect(normalizeYouTubeUrl('https://www.youtube.com/watch?v=tu9WlspEjo0')).toBe(
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
  });

  it('accepts youtu.be, shorts, and existing embed URLs', () => {
    expect(normalizeYouTubeUrl('https://youtu.be/tu9WlspEjo0')).toBe(
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
    expect(normalizeYouTubeUrl('https://www.youtube.com/shorts/tu9WlspEjo0')).toBe(
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
    expect(normalizeYouTubeUrl('https://www.youtube.com/embed/tu9WlspEjo0')).toBe(
      'https://www.youtube.com/embed/tu9WlspEjo0'
    );
  });

  it('rejects non-YouTube and malformed URLs', () => {
    expect(() => normalizeYouTubeUrl('https://vimeo.com/12345')).toThrow();
    expect(() => normalizeYouTubeUrl('not a url')).toThrow();
    expect(() => normalizeYouTubeUrl('https://www.youtube.com/')).toThrow();
  });
});

describe('productInputSchema', () => {
  const valid = {
    slug: 'test-window',
    categoryId: 1,
    name: 'Test Window',
  };

  it('fills defaults for optional fields', () => {
    const parsed = productInputSchema.parse(valid);
    expect(parsed.features).toEqual([]);
    expect(parsed.specifications).toEqual({});
    expect(parsed.featured).toBe(false);
    expect(parsed.videoUrl).toBeNull();
  });

  it('rejects bad slugs', () => {
    expect(() => productInputSchema.parse({ ...valid, slug: 'Bad Slug!' })).toThrow();
    expect(() => productInputSchema.parse({ ...valid, slug: '-leading' })).toThrow();
  });

  it('rejects missing name or category', () => {
    expect(() => productInputSchema.parse({ slug: 'x', categoryId: 1, name: '' })).toThrow();
    expect(() => productInputSchema.parse({ slug: 'x', name: 'X' })).toThrow();
  });
});

describe('projectInputSchema', () => {
  it('validates year bounds', () => {
    const base = { slug: 'p', categoryId: 1, name: 'P', year: 2024 };
    expect(projectInputSchema.parse(base).year).toBe(2024);
    expect(() => projectInputSchema.parse({ ...base, year: 1500 })).toThrow();
    expect(() => projectInputSchema.parse({ ...base, year: 2.5 })).toThrow();
  });
});
