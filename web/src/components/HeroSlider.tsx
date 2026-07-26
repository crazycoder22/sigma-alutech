'use client';

import { useEffect, useState } from 'react';

interface Props {
  images: string[];
}

/** Slow cross-fade behind the hero copy. Falls back to a single still. */
export function HeroSlider({ images }: Props) {
  const slides = images.length ? images : ['/images/hero/hero-1.svg'];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(
      () => setCurrent((c) => (c + 1) % slides.length),
      6000
    );
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="hero__media">
      {slides.map((src, i) => (
        <div
          key={src}
          className={`hero__slide${i === current ? ' active' : ''}`}
          style={{ backgroundImage: `url('${src}')` }}
          role="presentation"
        ></div>
      ))}
      <div className="hero__scrim"></div>
    </div>
  );
}
