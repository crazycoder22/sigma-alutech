'use client';

import { useEffect, useState } from 'react';
import type { CategoryDto, ProductDto } from '@/lib/types';
import { titleCase } from '@/lib/types';

interface Props {
  categories: CategoryDto[];
}

export function ProductsCatalog({ categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openProduct, setOpenProduct] = useState<{
    product: ProductDto;
    categoryName: string;
  } | null>(null);
  const [mainImage, setMainImage] = useState<string>('');

  // Deep-link support: /products#windows selects the category.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && categories.some((c) => c.slug === hash)) {
        setActiveCategory(hash);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [categories]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', Boolean(openProduct));
    return () => document.body.classList.remove('no-scroll');
  }, [openProduct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenProduct(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function selectCategory(slug: string) {
    setActiveCategory(slug);
    history.replaceState(null, '', slug === 'all' ? '/products' : `#${slug}`);
  }

  function open(product: ProductDto, categoryName: string) {
    setOpenProduct({ product, categoryName });
    setMainImage(product.images[0] ?? '');
  }

  const visible = categories.filter(
    (c) => activeCategory === 'all' || c.slug === activeCategory
  );
  const count = visible.reduce((n, c) => n + c.products.length, 0);
  const modal = openProduct?.product;

  return (
    <>
      <div className="filters" id="productFilters">
        <button
          className={`filter-btn${activeCategory === 'all' ? ' active' : ''}`}
          data-category="all"
          onClick={() => selectCategory('all')}
        >
          All Products
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            className={`filter-btn${activeCategory === cat.slug ? ' active' : ''}`}
            data-category={cat.slug}
            onClick={() => selectCategory(cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="products-grid" id="productsGrid">
        {visible.flatMap((cat) =>
          cat.products.map((product) => (
            <div key={product.slug} className="card" onClick={() => open(product, cat.name)}>
              { }
              <img
                className="card__image"
                src={product.images[0] ?? ''}
                alt={product.name}
                loading="lazy"
              />
              <div className="card__body">
                <span className="card__badge">{titleCase(product.topology)}</span>
                <h3 className="card__title">{product.name}</h3>
                <p className="card__text">{product.tagline}</p>
                <div className="product-card__features">
                  {product.finishes.slice(0, 3).map((f) => (
                    <span key={f} className="product-card__feature-tag">{f}</span>
                  ))}
                </div>
              </div>
              <div className="card__footer">
                <span className="card__link">
                  View Details <span className="arrow">&rarr;</span>
                </span>
                {product.videoUrl ? (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    &#9654; Video
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {count === 0 ? (
        <div className="no-results">
          <div className="no-results__icon">&#128269;</div>
          <p>No products found in this category.</p>
        </div>
      ) : null}

      {/* Product Modal */}
      <div
        className={`modal-backdrop${modal ? ' open' : ''}`}
        onClick={() => setOpenProduct(null)}
      ></div>
      <div className={`modal${modal ? ' open' : ''}`} id="productModal">
        {modal ? (
          <>
            <button className="modal__close" onClick={() => setOpenProduct(null)}>
              &times;
            </button>
            <div className="modal__image-container">
              { }
              <img id="modalMainImage" src={mainImage} alt={modal.name} />
            </div>
            {modal.images.length > 1 ? (
              <div className="modal__gallery">
                {modal.images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img}
                    className={`modal__gallery-thumb${img === mainImage ? ' active' : ''}`}
                    src={img}
                    alt={`${modal.name} - Image ${i + 1}`}
                    onClick={() => setMainImage(img)}
                  />
                ))}
              </div>
            ) : null}
            <div className="modal__body">
              <div className="modal__tags">
                <span className="modal__tag">{openProduct.categoryName}</span>
                <span className="modal__tag">{titleCase(modal.topology)}</span>
                {modal.series ? <span className="modal__tag">{modal.series}</span> : null}
              </div>
              <h3 className="modal__title">{modal.name}</h3>
              <p className="modal__description">{modal.description}</p>

              {modal.features.length ? (
                <>
                  <h4 className="modal__section-heading">Key Features</h4>
                  <ul className="feature-list">
                    {modal.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {Object.keys(modal.specifications).length ? (
                <>
                  <h4 className="modal__section-heading">Specifications</h4>
                  <table className="specs-table">
                    <tbody>
                      {Object.entries(modal.specifications).map(([key, value]) => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {modal.finishes.length ? (
                <>
                  <h4 className="modal__section-heading">Available Finishes</h4>
                  <div className="finishes">
                    {modal.finishes.map((f) => (
                      <span key={f} className="finish-swatch">{f}</span>
                    ))}
                  </div>
                </>
              ) : null}

              {modal.videoUrl ? (
                <>
                  <h4 className="modal__section-heading">Product Video</h4>
                  <div className="video-container">
                    <iframe src={modal.videoUrl} allowFullScreen loading="lazy"></iframe>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
