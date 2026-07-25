'use client';

import { useRef, useState } from 'react';

// ---------- String list (features, finishes) ----------

export function StringListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  function update(i: number, v: string) {
    onChange(values.map((x, j) => (j === i ? v : x)));
  }
  return (
    <div className="form-field">
      <label>{label}</label>
      {values.map((v, i) => (
        <div className="list-editor__row" key={i}>
          <input
            type="text"
            value={v}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            title="Remove"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--outline btn--small" onClick={() => onChange([...values, ''])}>
        + Add
      </button>
    </div>
  );
}

// ---------- Key/value editor (specifications) ----------

export function KeyValueEditor({
  label,
  entries,
  onChange,
}: {
  label: string;
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
    <div className="form-field">
      <label>{label}</label>
      {entries.map(([k, v], i) => (
        <div className="list-editor__row" key={i}>
          <input
            type="text"
            value={k}
            placeholder="Spec (e.g. Profile Depth)"
            onChange={(e) => update(i, 0, e.target.value)}
          />
          <input
            type="text"
            value={v}
            placeholder="Value (e.g. 65mm)"
            onChange={(e) => update(i, 1, e.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            title="Remove"
            onClick={() => onChange(entries.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--outline btn--small"
        onClick={() => onChange([...entries, ['', '']])}
      >
        + Add Spec
      </button>
    </div>
  );
}

// ---------- Image uploader (multi, ordered; first image = main) ----------

export function ImageUploader({
  label,
  images,
  onChange,
  folder,
  hint,
}: {
  label: string;
  images: string[];
  onChange: (next: string[]) => void;
  folder: 'products' | 'projects';
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    const added: string[] = [];
    for (const file of Array.from(files)) {
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
    setUploading(false);
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
    <div className="form-field">
      <label>{label}</label>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="image-uploader__grid">
        {images.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className={`image-uploader__item${i === 0 ? ' image-uploader__item--main' : ''}`}
          >
            { }
            <img src={url} alt={`Image ${i + 1}`} />
            {i === 0 ? <span className="image-uploader__badge">Main</span> : null}
            <div className="image-uploader__controls">
              <button type="button" className="icon-btn" title="Move left" onClick={() => move(i, -1)}>
                ‹
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Remove"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
              >
                ✕
              </button>
              <button type="button" className="icon-btn" title="Move right" onClick={() => move(i, 1)}>
                ›
              </button>
            </div>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? <div className="image-uploader__progress">Uploading…</div> : null}
      {hint ? <div className="image-uploader__progress">{hint}</div> : null}
    </div>
  );
}
