'use client';

import { useEffect, useState } from 'react';

const SLIDES = [
  { image: '/images/hero/hero-1.svg', color: '#1a1a1a' },
  { image: '/images/hero/hero-2.svg', color: '#141414' },
  { image: '/images/hero/hero-3.svg', color: '#111111' },
];

export function HeroSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero__slider">
      {SLIDES.map((s, i) => (
        <div
          key={s.image}
          className={`hero__slide${i === current ? ' active' : ''}`}
          style={{ backgroundImage: `url('${s.image}')`, backgroundColor: s.color }}
        ></div>
      ))}
    </div>
  );
}
