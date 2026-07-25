'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjectCategoryDto, ProjectDto } from '@/lib/types';
import { ImageUploader, StringListEditor } from './fields';

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function ProjectsAdmin({ categories, projects, productCategorySlugs }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  function startCreate() {
    setError('');
    setSuccess('');
    setForm(emptyForm(categories[0]?.id ?? 0));
  }

  function startEdit(p: ProjectDto) {
    setError('');
    setSuccess('');
    setForm({
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
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleProductUsed(slug: string) {
    if (!form) return;
    const has = form.productsUsed.includes(slug);
    setForm({
      ...form,
      productsUsed: has
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
      const payload = {
        slug: form.slug || slugify(form.name),
        categoryId: form.categoryId,
        name: form.name,
        location: form.location,
        architect: form.architect,
        year: Number(form.year),
        type: form.type,
        description: form.description,
        productsUsed: form.productsUsed,
        thumbnail: form.thumbnail || form.images[0] || '',
        images: form.images,
        videoUrl: form.videoUrl.trim() || null,
        featured: form.featured,
        sortOrder: form.sortOrder,
      };
      const res = await fetch(form.id ? `/api/projects/${form.id}` : '/api/projects', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const sorted = [...projects].sort((a, b) => b.year - a.year);

  return (
    <>
      <div className="admin-title-row">
        <h1 className="section-title" style={{ margin: 0 }}>Projects</h1>
        <button className="btn btn--primary btn--small" onClick={startCreate} data-testid="add-project">
          + Add Project
        </button>
      </div>

      {error && !form ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      {form ? (
        <form className="admin-editor" onSubmit={save} data-testid="project-editor">
          <h2>{form.id ? `Edit: ${form.name}` : 'New Project'}</h2>
          {error ? <div className="form-error">{error}</div> : null}

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="j-name">Name *</label>
              <input
                id="j-name"
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
              <label htmlFor="j-category">Category *</label>
              <select
                id="j-category"
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
              <label htmlFor="j-location">Location</label>
              <input
                id="j-location"
                type="text"
                placeholder="e.g. Bidadi, Bangalore"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="j-year">Year *</label>
              <input
                id="j-year"
                type="number"
                required
                min={1990}
                max={2100}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="j-type">Project type (e.g. 5-Star Hotel)</label>
              <input
                id="j-type"
                type="text"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="j-architect">Architect (optional)</label>
              <input
                id="j-architect"
                type="text"
                value={form.architect}
                onChange={(e) => setForm({ ...form, architect: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="j-description">Description</label>
            <textarea
              id="j-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            ></textarea>
          </div>

          <div className="form-field">
            <label>Products used</label>
            <div className="flex flex-wrap gap-sm">
              {productCategorySlugs.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className={`filter-btn${form.productsUsed.includes(slug) ? ' active' : ''}`}
                  onClick={() => toggleProductUsed(slug)}
                >
                  {slug}
                </button>
              ))}
            </div>
          </div>

          <ImageUploader
            label="Photos"
            images={form.images}
            onChange={(images) =>
              setForm({ ...form, images, thumbnail: form.thumbnail || images[0] || '' })
            }
            folder="projects"
            hint="First photo is used as the card thumbnail unless overridden below."
          />

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="j-video">YouTube video URL (optional)</label>
              <input
                id="j-video"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="j-slug">Slug (URL id — auto-generated)</label>
              <input
                id="j-slug"
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field form-field--checkbox">
            <input
              id="j-featured"
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            <label htmlFor="j-featured">Featured on homepage</label>
          </div>

          <div className="flex gap-md">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save Changes' : 'Create Project'}
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
            <th>Year</th>
            <th>Featured</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} data-testid={`project-row-${p.slug}`}>
              <td>
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="admin-table__thumb" src={p.thumbnail} alt="" />
                ) : (
                  <div className="admin-table__thumb"></div>
                )}
              </td>
              <td>
                <strong>{p.name}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
                  {p.location}
                </div>
              </td>
              <td>{p.categoryName}</td>
              <td>{p.year}</td>
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
