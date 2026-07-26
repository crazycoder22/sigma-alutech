'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjectCategoryDto, ProjectDto } from '@/lib/types';
import { titleCase } from '@/lib/types';
import {
  Field,
  ImageManager,
  SelectField,
  SwitchRow,
  TextareaField,
} from './fields';

interface Props {
  categories: ProjectCategoryDto[];
  projects: ProjectDto[];
  productCategorySlugs: string[];
}

interface FormState {
  id: number | null;
  slug: string;
  categoryId: number;
  name: string;
  location: string;
  architect: string;
  year: number;
  type: string;
  description: string;
  productsUsed: string[];
  thumbnail: string;
  images: string[];
  videoUrl: string;
  featured: boolean;
  sortOrder: number;
}

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
    location: '',
    architect: '',
    year: new Date().getFullYear(),
    type: '',
    description: '',
    productsUsed: [],
    thumbnail: '',
    images: [],
    videoUrl: '',
    featured: false,
    sortOrder: 0,
  };
}

function toForm(p: ProjectDto): FormState {
  return {
    id: p.id,
    slug: p.slug,
    categoryId: p.categoryId,
    name: p.name,
    location: p.location,
    architect: p.architect,
    year: p.year,
    type: p.type,
    description: p.description,
    productsUsed: p.productsUsed,
    thumbnail: p.thumbnail,
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
    location: f.location.trim(),
    architect: f.architect.trim(),
    year: Number(f.year),
    type: f.type.trim(),
    description: f.description.trim(),
    productsUsed: f.productsUsed,
    thumbnail: f.thumbnail || f.images[0] || '',
    images: f.images,
    videoUrl: f.videoUrl.trim() || null,
    featured: f.featured,
    sortOrder: f.sortOrder,
  };
}

export function ProjectsAdmin({ categories, projects, productCategorySlugs }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = [...projects]
    .sort((a, b) => b.year - a.year)
    .filter((p) => {
      if (categoryFilter !== 'all' && p.categorySlug !== categoryFilter) return false;
      if (featuredOnly && !p.featured) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q)
      );
    });

  const featuredCount = projects.filter((p) => p.featured).length;
  const dirty = form !== null && JSON.stringify(toPayload(form)) !== baseline;

  function startCreate() {
    const f = emptyForm(categories[0]?.id ?? 0);
    setError('');
    setSuccess('');
    setForm(f);
    setBaseline(JSON.stringify(toPayload(f)));
  }

  function startEdit(p: ProjectDto) {
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

  function toggleProductUsed(slug: string) {
    if (!form) return;
    setForm({
      ...form,
      productsUsed: form.productsUsed.includes(slug)
        ? form.productsUsed.filter((s) => s !== slug)
        : [...form.productsUsed, slug],
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(form.id ? `/api/projects/${form.id}` : '/api/projects', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      setSuccess(form.id ? 'Project updated.' : 'Project created.');
      setForm(null);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFeatured(p: ProjectDto) {
    setError('');
    const payload = { ...toPayload(toForm(p)), featured: !p.featured };
    const res = await fetch(`/api/projects/${p.id}`, {
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

  async function remove(p: ProjectDto) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setError('');
    const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
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
    return (
      <form onSubmit={save} data-testid="project-editor">
        <div className="editor__head">
          <div>
            <button type="button" className="editor__back" onClick={cancel}>
              ← Projects
            </button>
            <div className="editor__label">{form.id ? 'Editing' : 'New project'}</div>
            <div className="editor__title">{form.name || 'Untitled project'}</div>
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
                href={`/projects/${form.slug}`}
                target="_blank"
              >
                Preview ↗
              </Link>
            ) : null}
            <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="admin-flash" style={{ paddingTop: 16 }}>
            <div className="form-error">{error}</div>
          </div>
        ) : null}

        <div className="editor__grid">
          <div className="editor__col">
            <section className="panel">
              <div className="panel__title">Basics</div>
              <Field
                id="j-name"
                label="Name"
                required
                value={form.name}
                onChange={(v) =>
                  setForm({ ...form, name: v, slug: form.id ? form.slug : slugify(v) })
                }
              />
              <div className="field-row field-row--3">
                <SelectField
                  id="j-category"
                  label="Category"
                  required
                  value={form.categoryId}
                  onChange={(v) => setForm({ ...form, categoryId: Number(v) })}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
                <Field
                  id="j-year"
                  label="Year"
                  type="number"
                  required
                  value={String(form.year)}
                  onChange={(v) => setForm({ ...form, year: Number(v) })}
                />
                <Field
                  id="j-type"
                  label="Scope"
                  placeholder="5-Star Hotel"
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                />
              </div>
              <div className="field-row field-row--3">
                <Field
                  id="j-location"
                  label="Location"
                  placeholder="Bidadi, Bangalore"
                  value={form.location}
                  onChange={(v) => setForm({ ...form, location: v })}
                />
                <Field
                  id="j-architect"
                  label="Architect"
                  value={form.architect}
                  onChange={(v) => setForm({ ...form, architect: v })}
                />
              </div>
              <TextareaField
                id="j-description"
                label="Description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
              />
            </section>

            <section className="panel">
              <div className="panel__title">Products used</div>
              <div className="finish-chips">
                {productCategorySlugs.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    className={`filter-btn${form.productsUsed.includes(slug) ? ' active' : ''}`}
                    onClick={() => toggleProductUsed(slug)}
                  >
                    {titleCase(slug)}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="editor__col">
            <section className="panel">
              <div className="panel__title">Publishing</div>
              <SwitchRow
                id="j-featured"
                title="Featured on homepage"
                note="Shows in the portfolio panel"
                checked={form.featured}
                onChange={(featured) => setForm({ ...form, featured })}
              />
              <Field
                id="j-slug"
                label="Slug (auto)"
                value={form.slug}
                onChange={(v) => setForm({ ...form, slug: v })}
              />
              <Field
                id="j-video"
                label="YouTube video URL"
                type="url"
                placeholder="https://youtube.com/watch?v=…"
                value={form.videoUrl}
                onChange={(v) => setForm({ ...form, videoUrl: v })}
              />
            </section>

            <section className="panel">
              <div className="panel__head">
                <span className="panel__title">Photos</span>
                <span className="panel__hint">{form.images.length} of 8</span>
              </div>
              <ImageManager
                images={form.images}
                onChange={(images) =>
                  setForm({ ...form, images, thumbnail: form.thumbnail || images[0] || '' })
                }
                folder="projects"
              />
            </section>

            <section className="panel panel--preview">
              <div className="panel__title">Card preview</div>
              <div className="preview-card">
                <div className="preview-card__media">
                  {(form.thumbnail || form.images[0]) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.thumbnail || form.images[0]} alt="" />
                  ) : null}
                </div>
                <div className="preview-card__body">
                  <span className="preview-card__kicker">{form.type || 'Project type'}</span>
                  <span className="preview-card__title">{form.name || 'Project name'}</span>
                  <span className="preview-card__text">
                    {[form.location, form.year].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="editor__bar">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create project'}
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
          <h1 className="admin-head__title">Projects</h1>
          <div className="admin-head__meta">
            {projects.length} items · {featuredCount} featured on homepage
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
              placeholder="Search projects…"
              aria-label="Search projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn btn--primary btn--small" onClick={startCreate} data-testid="add-project">
            + Add project
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
          All {projects.length}
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
          <div className="admin-empty">No projects match this search.</div>
        ) : null}

        <div className="rec-list">
          {visible.map((p) => (
            <div className="rec" key={p.id} data-testid={`project-row-${p.slug}`}>
              {p.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rec__thumb" src={p.thumbnail} alt="" />
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
                <span className="rec__slug">{p.location || p.slug}</span>
                <div className="rec__tags">
                  <span className="tag--cat">{p.categoryName}</span>
                  <span className="tag--type">{p.year}</span>
                </div>
                <div className="rec__actions">
                  <button className="btn btn--outline btn--small" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="btn btn--outline btn--small" onClick={() => toggleFeatured(p)}>
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

        {visible.length ? (
          <div className="rec-table">
            <div className="rec-row rec-row--head">
              <div></div>
              <div>Name</div>
              <div>Category</div>
              <div>Year</div>
              <div>Featured</div>
              <div></div>
            </div>
            {visible.map((p) => (
              <div className="rec-row" key={p.id} data-testid={`project-tr-${p.slug}`}>
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rec-row__thumb" src={p.thumbnail} alt="" />
                ) : (
                  <div className="rec-row__thumb"></div>
                )}
                <div>
                  <div className="rec-row__name">{p.name}</div>
                  <div className="rec__slug">{p.location}</div>
                </div>
                <div className="rec-row__cell">{p.categoryName}</div>
                <div className="rec-row__cell">{p.year}</div>
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
            + Add project
          </button>
        </div>
      </div>
    </>
  );
}
