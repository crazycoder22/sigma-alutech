'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CategoryDto, ProductDto } from '@/lib/types';
import { titleCase } from '@/lib/types';
import { ImageUploader, KeyValueEditor, StringListEditor } from './fields';

interface Props {
  categories: CategoryDto[];
}

interface FormState {
  id: number | null;
  slug: string;
  categoryId: number;
  name: string;
  series: string;
  topology: string;
  tagline: string;
  description: string;
  features: string[];
  specEntries: Array<[string, string]>;
  finishes: string[];
  images: string[];
  videoUrl: string;
  featured: boolean;
  sortOrder: number;
}

function emptyForm(categoryId: number): FormState {
  return {
    id: null,
    slug: '',
    categoryId,
    name: '',
    series: '',
    topology: '',
    tagline: '',
    description: '',
    features: [],
    specEntries: [],
    finishes: [],
    images: [],
    videoUrl: '',
    featured: false,
    sortOrder: 0,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function ProductsAdmin({ categories }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const allProducts = categories.flatMap((c) =>
    c.products.map((p) => ({ ...p, categoryName: c.name }))
  );

  function startCreate() {
    setError('');
    setSuccess('');
    setForm(emptyForm(categories[0]?.id ?? 0));
  }

  function startEdit(p: ProductDto) {
    setError('');
    setSuccess('');
    setForm({
      id: p.id,
      slug: p.slug,
      categoryId: p.categoryId,
      name: p.name,
      series: p.series,
      topology: p.topology,
      tagline: p.tagline,
      description: p.description,
      features: p.features,
      specEntries: Object.entries(p.specifications),
      finishes: p.finishes,
      images: p.images,
      videoUrl: p.videoUrl ?? '',
      featured: p.featured,
      sortOrder: p.sortOrder,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        slug: form.slug || slugify(form.name),
        categoryId: form.categoryId,
        name: form.name,
        series: form.series,
        topology: form.topology,
        tagline: form.tagline,
        description: form.description,
        features: form.features.filter((f) => f.trim()),
        specifications: Object.fromEntries(
          form.specEntries.filter(([k, v]) => k.trim() && v.trim())
        ),
        finishes: form.finishes.filter((f) => f.trim()),
        images: form.images,
        videoUrl: form.videoUrl.trim() || null,
        featured: form.featured,
        sortOrder: form.sortOrder,
      };
      const res = await fetch(form.id ? `/api/products/${form.id}` : '/api/products', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      setSuccess(form.id ? 'Product updated.' : 'Product created.');
      setForm(null);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: ProductDto) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setError('');
    const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Delete failed');
      return;
    }
    setSuccess(`Deleted "${p.name}".`);
    router.refresh();
  }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="section-title" style={{ margin: 0 }}>Products</h1>
        <button className="btn btn--primary btn--small" onClick={startCreate} data-testid="add-product">
          + Add Product
        </button>
      </div>

      {error && !form ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      {form ? (
        <form className="admin-editor" onSubmit={save} data-testid="product-editor">
          <h2>{form.id ? `Edit: ${form.name}` : 'New Product'}</h2>
          {error ? <div className="form-error">{error}</div> : null}

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-name">Name *</label>
              <input
                id="p-name"
                type="text"
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: form.id ? form.slug : slugify(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-category">Category *</label>
              <select
                id="p-category"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-series">Series (e.g. FY 65)</label>
              <input
                id="p-series"
                type="text"
                value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-topology">Type badge (e.g. casement, sliding)</label>
              <input
                id="p-topology"
                type="text"
                value={form.topology}
                onChange={(e) => setForm({ ...form, topology: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="p-tagline">Tagline (one line on the card)</label>
            <input
              id="p-tagline"
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="p-description">Description</label>
            <textarea
              id="p-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            ></textarea>
          </div>

          <StringListEditor
            label="Features"
            values={form.features}
            onChange={(features) => setForm({ ...form, features })}
            placeholder="e.g. Thermally broken profile"
          />

          <KeyValueEditor
            label="Specifications"
            entries={form.specEntries}
            onChange={(specEntries) => setForm({ ...form, specEntries })}
          />

          <StringListEditor
            label="Finishes"
            values={form.finishes}
            onChange={(finishes) => setForm({ ...form, finishes })}
            placeholder="e.g. Anodized"
          />

          <ImageUploader
            label="Images"
            images={form.images}
            onChange={(images) => setForm({ ...form, images })}
            folder="products"
            hint="First image is the main card image. JPG/PNG/WebP up to 8 MB."
          />

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-video">YouTube video URL (optional)</label>
              <input
                id="p-video"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-slug">Slug (URL id — auto-generated)</label>
              <input
                id="p-slug"
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field form-field--checkbox">
            <input
              id="p-featured"
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            <label htmlFor="p-featured">Featured on homepage</label>
          </div>

          <div className="flex gap-md">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save Changes' : 'Create Product'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <table className="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Category</th>
            <th>Type</th>
            <th>Featured</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {allProducts.map((p) => (
            <tr key={p.id} data-testid={`product-row-${p.slug}`}>
              <td>
                { }
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="admin-table__thumb" src={p.images[0]} alt="" />
                ) : (
                  <div className="admin-table__thumb"></div>
                )}
              </td>
              <td>
                <strong>{p.name}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{p.slug}</div>
              </td>
              <td>{p.categoryName}</td>
              <td>{titleCase(p.topology)}</td>
              <td>{p.featured ? '★' : ''}</td>
              <td>
                <div className="admin-table__actions">
                  <button className="btn btn--outline btn--small" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="btn btn--danger btn--small" onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
