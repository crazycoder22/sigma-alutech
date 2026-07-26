'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CategoryDto } from '@/lib/types';
import { titleCase } from '@/lib/types';

interface Props {
  categories: CategoryDto[];
  initialCategory?: string;
}

export function ProductsGrid({ categories, initialCategory }: Props) {
  const [active, setActive] = useState(() =>
    initialCategory && categories.some((c) => c.slug === initialCategory)
      ? initialCategory
      : 'all'
  );

  // Keep the filter shareable/bookmarkable without a full navigation.
  useEffect(() => {
    const url = active === 'all' ? '/products' : `/products?category=${active}`;
    window.history.replaceState(null, '', url);
  }, [active]);

  const visible = categories.filter((c) => active === 'all' || c.slug === active);
  const products = visible.flatMap((c) => c.products);

  return (
    <>
      <div className="filter-band">
        <div className="container">
          <div className="filters" id="productFilters">
            <button
              className={`filter-btn${active === 'all' ? ' active' : ''}`}
              data-category="all"
              onClick={() => setActive('all')}
            >
              All products
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                className={`filter-btn${active === c.slug ? ' active' : ''}`}
                data-category={c.slug}
                onClick={() => setActive(c.slug)}
              >
                {c.name}
              </button>
            ))}
            <span className="filters__count">
              {products.length} product{products.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="card-grid" id="productsGrid">
            {products.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="card">
                <div className="media media--zoom card__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.images[0] ?? ''} alt={product.name} loading="lazy" />
                  {product.topology ? (
                    <span className="media__badge">{titleCase(product.topology)}</span>
                  ) : null}
                </div>
                <div className="card__body">
                  <h3 className="card__title">{product.name}</h3>
                  <p className="card__text">{product.tagline}</p>
                  {product.finishes.length ? (
                    <div className="card__tags">
                      {product.finishes.slice(0, 3).map((f) => (
                        <span key={f} className="tag">{f}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="card__footer">
                    <span className="arrow-link">
                      View details <span>→</span>
                    </span>
                    {product.videoUrl ? <span className="tag">▶ Video</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {products.length === 0 ? (
            <div className="no-results">
              <div className="no-results__icon">⌕</div>
              <p>No products in this category yet.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
