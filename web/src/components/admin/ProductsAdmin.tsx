'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CategoryDto, ProductDto } from '@/lib/types';
import { titleCase } from '@/lib/types';
import {
  Field,
  FinishChips,
  ImageManager,
  ReorderableList,
  SelectField,
  SpecTable,
  SwitchRow,
  TextareaField,
} from './fields';

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

const TAGLINE_LIMIT = 60;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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

function toForm(p: ProductDto): FormState {
  return {
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
  };
}

function toPayload(f: FormState) {
  return {
    slug: f.slug || slugify(f.name),
    categoryId: f.categoryId,
    name: f.name.trim(),
    series: f.series.trim(),
    topology: f.topology.trim(),
    tagline: f.tagline.trim(),
    description: f.description.trim(),
    features: f.features.map((x) => x.trim()).filter(Boolean),
    specifications: Object.fromEntries(
      f.specEntries.filter(([k, v]) => k.trim() && v.trim()).map(([k, v]) => [k.trim(), v.trim()])
    ),
    finishes: f.finishes.map((x) => x.trim()).filter(Boolean),
    images: f.images,
    videoUrl: f.videoUrl.trim() || null,
    featured: f.featured,
    sortOrder: f.sortOrder,
  };
}

export function ProductsAdmin({ categories }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const all = useMemo(
    () =>
      categories.flatMap((c) =>
        c.products.map((p) => ({ ...p, categoryName: c.name, categorySlug: c.slug }))
      ),
    [categories]
  );

  const visible = all.filter((p) => {
    if (categoryFilter !== 'all' && p.categorySlug !== categoryFilter) return false;
    if (featuredOnly && !p.featured) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.series.toLowerCase().includes(q) ||
      p.topology.toLowerCase().includes(q)
    );
  });

  const featuredCount = all.filter((p) => p.featured).length;
  const dirty = form !== null && JSON.stringify(toPayload(form)) !== baseline;

  function startCreate() {
    const f = emptyForm(categories[0]?.id ?? 0);
    setError('');
    setSuccess('');
    setForm(f);
    setBaseline(JSON.stringify(toPayload(f)));
  }

  function startEdit(p: ProductDto) {
    const f = toForm(p);
    setError('');
    setSuccess('');
    setForm(f);
    setBaseline(JSON.stringify(toPayload(f)));
    window.scrollTo({ top: 0 });
  }

  function cancel() {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setForm(null);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(form.id ? `/api/products/${form.id}` : '/api/products', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
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

  /** Flip the featured flag straight from the list. */
  async function toggleFeatured(p: ProductDto) {
    setError('');
    const payload = { ...toPayload(toForm(p)), featured: !p.featured };
    const res = await fetch(`/api/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not update');
      return;
    }
    router.refresh();
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

  /* ---------------- Editor ---------------- */
  if (form) {
    const category = categories.find((c) => c.id === form.categoryId);
    return (
      <form onSubmit={save} data-testid="product-editor">
        <div className="editor__head">
          <div>
            <button type="button" className="editor__back" onClick={cancel}>
              ← Products
            </button>
            <div className="editor__label">{form.id ? 'Editing' : 'New product'}</div>
            <div className="editor__title">{form.name || 'Untitled product'}</div>
          </div>
          <div className="editor__head-actions">
            <span className={dirty ? 'editor__dirty' : 'editor__saved'} data-testid="dirty-state">
              {dirty ? '● Unsaved changes' : 'Saved'}
            </span>
            <button type="button" className="btn btn--outline btn--small" onClick={cancel}>
              Cancel
            </button>
            {form.id ? (
              <Link
                className="btn btn--outline btn--small"
                href={`/products/${form.slug}`}
                target="_blank"
              >
                Preview ↗
              </Link>
            ) : null}
            <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="admin-flash" style={{ paddingTop: 16 }}>
            <div className="form-error">{error}</div>
          </div>
        ) : null}

        <div className="editor__grid">
          {/* ---- Left column ---- */}
          <div className="editor__col">
            <section className="panel">
              <div className="panel__title">Basics</div>
              <Field
                id="p-name"
                label="Name"
                required
                value={form.name}
                onChange={(v) =>
                  setForm({ ...form, name: v, slug: form.id ? form.slug : slugify(v) })
                }
              />
              <div className="field-row field-row--3">
                <SelectField
                  id="p-category"
                  label="Category"
                  required
                  value={form.categoryId}
                  onChange={(v) => setForm({ ...form, categoryId: Number(v) })}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
                <Field
                  id="p-series"
                  label="Series"
                  placeholder="FY 65"
                  value={form.series}
                  onChange={(v) => setForm({ ...form, series: v })}
                />
                <Field
                  id="p-topology"
                  label="Type badge"
                  placeholder="casement"
                  value={form.topology}
                  onChange={(v) => setForm({ ...form, topology: v })}
                />
              </div>
              <Field
                id="p-tagline"
                label="Tagline"
                softLimit={TAGLINE_LIMIT}
                placeholder="Outward opening window with slim sightlines"
                value={form.tagline}
                onChange={(v) => setForm({ ...form, tagline: v })}
              />
              <TextareaField
                id="p-description"
                label="Description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
              />
            </section>

            <div className="editor__pair">
              <section className="panel">
                <div className="panel__head">
                  <span className="panel__title">Features</span>
                  <span className="panel__hint">Drag to reorder</span>
                </div>
                <ReorderableList
                  values={form.features}
                  onChange={(features) => setForm({ ...form, features })}
                  placeholder="Thermally broken profile"
                />
              </section>

              <section className="panel">
                <div className="panel__title">Specifications</div>
                <SpecTable
                  entries={form.specEntries}
                  onChange={(specEntries) => setForm({ ...form, specEntries })}
                />
              </section>
            </div>
          </div>

          {/* ---- Right column ---- */}
          <div className="editor__col">
            <section className="panel">
              <div className="panel__title">Publishing</div>
              <SwitchRow
                id="p-featured"
                title="Featured on homepage"
                note="Shows in the top carousel"
                checked={form.featured}
                onChange={(featured) => setForm({ ...form, featured })}
              />
              <Field
                id="p-slug"
                label="Slug (auto)"
                value={form.slug}
                onChange={(v) => setForm({ ...form, slug: v })}
              />
              <Field
                id="p-video"
                label="YouTube video URL"
                type="url"
                placeholder="https://youtube.com/watch?v=…"
                value={form.videoUrl}
                onChange={(v) => setForm({ ...form, videoUrl: v })}
              />
            </section>

            <section className="panel">
              <div className="panel__head">
                <span className="panel__title">Images</span>
                <span className="panel__hint">{form.images.length} of 8</span>
              </div>
              <ImageManager
                images={form.images}
                onChange={(images) => setForm({ ...form, images })}
                folder="products"
              />
            </section>

            <section className="panel">
              <div className="panel__title">Finishes</div>
              <FinishChips
                values={form.finishes}
                onChange={(finishes) => setForm({ ...form, finishes })}
              />
            </section>

            <section className="panel panel--preview">
              <div className="panel__title">Card preview</div>
              <div className="preview-card">
                <div className="preview-card__media">
                  {form.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.images[0]} alt="" />
                  ) : null}
                </div>
                <div className="preview-card__body">
                  <span className="preview-card__kicker">
                    {titleCase(form.topology) || category?.name || '—'}
                  </span>
                  <span className="preview-card__title">{form.name || 'Product name'}</span>
                  <span className="preview-card__text">
                    {form.tagline || 'A short line describing the product.'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Sticky save bar on mobile */}
        <div className="editor__bar">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create product'}
          </button>
          <button type="button" className="btn btn--outline" onClick={cancel}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  /* ---------------- List ---------------- */
  return (
    <>
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">Products</h1>
          <div className="admin-head__meta">
            {all.length} items · {featuredCount} featured on homepage
          </div>
        </div>
        <div className="admin-head__actions">
          <div className="search">
            <span className="search__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search products…"
              aria-label="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn btn--primary btn--small" onClick={startCreate} data-testid="add-product">
            + Add product
          </button>
        </div>
      </div>

      <div className="admin-filters">
        <button
          className={`filter-btn${categoryFilter === 'all' && !featuredOnly ? ' active' : ''}`}
          data-category="all"
          onClick={() => {
            setCategoryFilter('all');
            setFeaturedOnly(false);
          }}
        >
          All {all.length}
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            className={`filter-btn${categoryFilter === c.slug ? ' active' : ''}`}
            data-category={c.slug}
            onClick={() => setCategoryFilter(c.slug)}
          >
            {c.name}
          </button>
        ))}
        <button
          className={`filter-btn admin-filters__spacer${featuredOnly ? ' active' : ''}`}
          data-testid="featured-filter"
          onClick={() => setFeaturedOnly((v) => !v)}
        >
          ★ Featured only
        </button>
      </div>

      {error || success ? (
        <div className="admin-flash" style={{ paddingTop: 16 }}>
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
        </div>
      ) : null}

      <div className="admin-body">
        {visible.length === 0 ? (
          <div className="admin-empty">No products match this search.</div>
        ) : null}

        {/* Card list — mobile */}
        <div className="rec-list">
          {visible.map((p) => (
            <div className="rec" key={p.id} data-testid={`product-row-${p.slug}`}>
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rec__thumb" src={p.images[0]} alt="" />
              ) : (
                <div className="rec__thumb"></div>
              )}
              <div className="rec__body">
                <div className="rec__top">
                  <span className="rec__name">{p.name}</span>
                  <button
                    className={`star${p.featured ? ' star--on' : ''}`}
                    onClick={() => toggleFeatured(p)}
                    aria-label={p.featured ? 'Unfeature' : 'Feature'}
                  >
                    {p.featured ? '★' : '☆'}
                  </button>
                </div>
                <span className="rec__slug">{p.slug}</span>
                <div className="rec__tags">
                  <span className="tag--cat">{p.categoryName}</span>
                  {p.topology ? <span className="tag--type">{titleCase(p.topology)}</span> : null}
                </div>
                <div className="rec__actions">
                  <button className="btn btn--outline btn--small" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button
                    className="btn btn--outline btn--small"
                    onClick={() => toggleFeatured(p)}
                  >
                    {p.featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    className="icon-btn icon-btn--danger"
                    onClick={() => remove(p)}
                    aria-label={`Delete ${p.name}`}
                  >
                    ⌫
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table — desktop */}
        {visible.length ? (
          <div className="rec-table">
            <div className="rec-row rec-row--head">
              <div></div>
              <div>Name</div>
              <div>Category</div>
              <div>Type</div>
              <div>Featured</div>
              <div></div>
            </div>
            {visible.map((p) => (
              <div className="rec-row" key={p.id} data-testid={`product-tr-${p.slug}`}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rec-row__thumb" src={p.images[0]} alt="" />
                ) : (
                  <div className="rec-row__thumb"></div>
                )}
                <div>
                  <div className="rec-row__name">{p.name}</div>
                  <div className="rec__slug">{p.slug}</div>
                </div>
                <div className="rec-row__cell">{p.categoryName}</div>
                <div className="rec-row__cell">{titleCase(p.topology)}</div>
                <div>
                  <button
                    className={`star${p.featured ? ' star--on' : ''}`}
                    onClick={() => toggleFeatured(p)}
                    aria-label={p.featured ? `Unfeature ${p.name}` : `Feature ${p.name}`}
                  >
                    {p.featured ? '★' : '☆'}
                  </button>
                </div>
                <div className="rec-row__actions">
                  <button className="btn btn--outline btn--small" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="btn btn--danger btn--small" onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="admin-sticky-add">
          <button className="btn btn--primary" onClick={startCreate}>
            + Add product
          </button>
        </div>
      </div>
    </>
  );
}
