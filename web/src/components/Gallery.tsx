'use client';

import { useEffect, useState } from 'react';

interface Props {
  images: string[];
  alt: string;
  /** Tall lead frame beside two stacked, as on project detail. */
  mosaic?: boolean;
}

/** Image grid with a full-screen lightbox (arrow keys + escape). */
export function Gallery({ images, alt, mosaic = false }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowLeft')
        setIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
      if (e.key === 'ArrowRight')
        setIndex((i) => (i === null ? i : (i + 1) % images.length));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, images.length]);

  if (!images.length) return null;

  return (
    <>
      <div className={`gallery${mosaic ? ' gallery--mosaic' : ''}`} data-testid="gallery">
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="media media--zoom gallery__item"
            onClick={() => setIndex(i)}
            role="button"
            tabIndex={0}
            aria-label={`Open image ${i + 1} of ${images.length}`}
            onKeyDown={(e) => e.key === 'Enter' && setIndex(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${alt} — image ${i + 1}`} loading="lazy" />
          </div>
        ))}
      </div>

      <div
        className={`lightbox${open ? ' open' : ''}`}
        onClick={(e) => e.target === e.currentTarget && setIndex(null)}
      >
        {open ? (
          <>
            <button className="lightbox__close" onClick={() => setIndex(null)} aria-label="Close">
              ×
            </button>
            {images.length > 1 ? (
              <button
                className="lightbox__nav lightbox__prev"
                aria-label="Previous image"
                onClick={() => setIndex((index - 1 + images.length) % images.length)}
              >
                ‹
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lightbox__image" src={images[index]} alt={`${alt} — image ${index + 1}`} />
            {images.length > 1 ? (
              <button
                className="lightbox__nav lightbox__next"
                aria-label="Next image"
                onClick={() => setIndex((index + 1) % images.length)}
              >
                ›
              </button>
            ) : null}
            <div className="lightbox__counter">
              {index + 1} / {images.length}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
