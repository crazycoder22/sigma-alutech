'use client';

import { useRef, useState } from 'react';
import { finishSwatch } from '@/lib/finishes';

/* ============================================================
   Text field with an optional soft character counter
   ============================================================ */

export function Field({
  label,
  value,
  onChange,
  softLimit,
  placeholder,
  required,
  readOnly,
  type = 'text',
  id,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  softLimit?: number;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  type?: string;
  id?: string;
}) {
  const over = softLimit !== undefined && value.length > softLimit;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>
          {label}
          {required ? ' *' : ''}
        </span>
        {softLimit !== undefined ? (
          <span className={`field__counter${over ? ' field__counter--over' : ''}`}>
            {value.length} / {softLimit}
          </span>
        ) : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  onChange,
  options,
  required,
  id,
}: {
  label: string;
  value: T;
  onChange: (v: string) => void;
  options: Array<{ value: T; label: string }>;
  required?: boolean;
  id?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>
          {label}
          {required ? ' *' : ''}
        </span>
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ============================================================
   Toggle switch
   ============================================================ */

export function SwitchRow({
  title,
  note,
  checked,
  onChange,
  id,
}: {
  title: string;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <div className="switch-row">
      <div>
        <div className="switch-row__title">{title}</div>
        {note ? <div className="switch-row__note">{note}</div> : null}
      </div>
      <button
        type="button"
        id={id}
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

/* ============================================================
   Reorderable string list (features)
   ============================================================ */

export function ReorderableList({
  values,
  onChange,
  placeholder,
  addLabel = '+ Add feature',
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to) return;
    const next = [...values];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div className="rep">
      {values.map((v, i) => (
        <div
          key={i}
          className={`rep__row${dragIndex === i ? ' rep__row--dragging' : ''}${
            overIndex === i && dragIndex !== i ? ' rep__row--over' : ''
          }`}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragEnter={() => setOverIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null) move(dragIndex, i);
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
        >
          <span className="rep__handle" title="Drag to reorder" aria-hidden="true">
            ⠿
          </span>
          <input
            value={v}
            placeholder={placeholder}
            aria-label={`Item ${i + 1}`}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {/* Keyboard-accessible alternative to dragging */}
          <button
            type="button"
            className="icon-btn"
            title="Move up"
            aria-label={`Move item ${i + 1} up`}
            onClick={() => move(i, Math.max(0, i - 1))}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Remove"
            aria-label={`Remove item ${i + 1}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="add-dashed" onClick={() => onChange([...values, ''])}>
        {addLabel}
      </button>
    </div>
  );
}

/* ============================================================
   Specification table
   ============================================================ */

export function SpecTable({
  entries,
  onChange,
}: {
  entries: Array<[string, string]>;
  onChange: (next: Array<[string, string]>) => void;
}) {
  function update(i: number, which: 0 | 1, v: string) {
    onChange(
      entries.map((pair, j) =>
        j === i ? ((which === 0 ? [v, pair[1]] : [pair[0], v]) as [string, string]) : pair
      )
    );
  }
  return (
    <>
      {entries.length ? (
        <div className="spec-table">
          {entries.map(([k, v], i) => (
            <div className="spec-table__row" key={i}>
              <input
                className="spec-table__key"
                value={k}
                placeholder="Max Width"
                aria-label={`Specification ${i + 1} name`}
                onChange={(e) => update(i, 0, e.target.value)}
              />
              <input
                className="spec-table__value"
                value={v}
                placeholder="1400 mm"
                aria-label={`Specification ${i + 1} value`}
                onChange={(e) => update(i, 1, e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                title="Remove"
                aria-label={`Remove specification ${i + 1}`}
                onClick={() => onChange(entries.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="add-dashed"
        onClick={() => onChange([...entries, ['', '']])}
      >
        + Add spec
      </button>
    </>
  );
}

/* ============================================================
   Finish chips
   ============================================================ */

export function FinishChips({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
    setAdding(false);
  }

  return (
    <div className="finish-chips">
      {values.map((f) => (
        <span className="finish-chip" key={f}>
          <span className="finish__swatch" style={{ background: finishSwatch(f) }}></span>
          {f}
          <button
            type="button"
            aria-label={`Remove ${f}`}
            onClick={() => onChange(values.filter((x) => x !== f))}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className="spec-table__value"
          style={{
            border: '1px solid var(--border-strong)',
            padding: '8px 12px',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
          }}
          value={draft}
          placeholder="Anodized"
          aria-label="New finish"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="add-dashed add-dashed--inline"
          onClick={() => setAdding(true)}
        >
          + Add
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Images — tiles with a Main badge, reorder, remove, dropzone
   ============================================================ */

export function ImageManager({
  images,
  onChange,
  folder,
  max = 8,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  folder: 'products' | 'projects';
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  async function upload(files: FileList | File[] | null) {
    if (!files || !('length' in files) || files.length === 0) return;
    setBusy(true);
    setError('');
    const added: string[] = [];
    for (const file of Array.from(files)) {
      if (images.length + added.length >= max) {
        setError(`Up to ${max} images per item.`);
        break;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('folder', folder);
      try {
        const res = await fetch('/api/uploads', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Upload failed for ${file.name}`);
          continue;
        }
        added.push(data.url);
      } catch {
        setError(`Network error uploading ${file.name}`);
      }
    }
    if (added.length) onChange([...images, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <>
      {error ? <div className="form-error">{error}</div> : null}

      <div className="img-grid">
        {images.map((url, i) => (
          <div className="img-tile" key={`${url}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Image ${i + 1}`} />
            {i === 0 ? <span className="img-tile__badge">Main</span> : null}
            <span className="img-tile__tools">
              <button
                type="button"
                title="Move left"
                aria-label={`Move image ${i + 1} earlier`}
                onClick={() => move(i, -1)}
              >
                ‹
              </button>
              <button
                type="button"
                title="Remove"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => onChange(images.filter((_, j) => j !== i))}
              >
                ×
              </button>
              <button
                type="button"
                title="Move right"
                aria-label={`Move image ${i + 1} later`}
                onClick={() => move(i, 1)}
              >
                ›
              </button>
            </span>
          </div>
        ))}

        {/* Compact "+" tile beside the thumbnails on small screens */}
        <button
          type="button"
          className="dropzone dropzone--tile"
          onClick={() => inputRef.current?.click()}
          aria-label="Add images"
        >
          +
        </button>
      </div>

      <button
        type="button"
        className={`dropzone dropzone--panel${dragOver ? ' dropzone--over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
      >
        <span className="dropzone__title">
          {busy ? 'Uploading…' : 'Drop images or browse'}
        </span>
        <span className="dropzone__hint">JPG / PNG / WebP up to 8 MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />

      {busy ? <div className="panel__hint">Uploading…</div> : null}
    </>
  );
}
