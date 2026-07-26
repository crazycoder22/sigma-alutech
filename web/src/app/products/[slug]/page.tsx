import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug, getProjectsUsingCategory } from '@/lib/catalog';
import { Gallery } from '@/components/Gallery';
import { ShareButton } from '@/components/ShareButton';
import { finishSwatch } from '@/lib/finishes';
import { quoteHref } from '@/lib/site';
import { titleCase } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.name,
    description: product.tagline || product.description.slice(0, 155),
  };
}

export default async function ProductDetailPage({ params }: Params) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const usedIn = await getProjectsUsingCategory(product.categorySlug);
  const [hero, ...rest] = product.images;
  const thumbs = rest.slice(0, 4);
  const specs = Object.entries(product.specifications);

  return (
    <>
      <article className="pd">
        {/* ---- Gallery column ---- */}
        <div className="pd__gallery">
          <div className="media pd__hero">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt={product.name} />
            ) : null}
          </div>
          {thumbs.length ? (
            <div className="pd__thumbs">
              {thumbs.map((src, i) => (
                <div className="media pd__thumb" key={`${src}-${i}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${product.name} — view ${i + 2}`} loading="lazy" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* ---- Info column ---- */}
        <div className="pd__info">
          <div className="breadcrumb">
            <Link href="/products">Products</Link> /{' '}
            <Link href={`/products?category=${product.categorySlug}`}>
              {product.categoryName}
            </Link>
            {product.topology ? ` / ${titleCase(product.topology)}` : ''}
          </div>

          <div className="detail__tags">
            {product.topology ? (
              <span className="tag--gold">{titleCase(product.topology)}</span>
            ) : null}
            {product.series ? (
              <span className="tag--outline">Series {product.series}</span>
            ) : null}
          </div>

          <h1 className="pd__title">{product.name}</h1>
          {product.description ? (
            <p className="pd__lead">{product.description}</p>
          ) : null}

          {product.features.length ? (
            <section className="pd__block">
              <span className="label">Features</span>
              <ul className="feature-list">
                {product.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {specs.length ? (
            <section className="pd__block">
              <span className="label">Specifications</span>
              <div className="spec-grid">
                {specs.map(([key, value]) => (
                  <div className="spec" key={key}>
                    <div className="spec__label">{key}</div>
                    <div className="spec__value">{value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {product.finishes.length ? (
            <section className="pd__block">
              <span className="label">Finishes</span>
              <div className="finishes">
                {product.finishes.map((f) => (
                  <span className="finish" key={f}>
                    <span
                      className="finish__swatch"
                      style={{ background: finishSwatch(f) }}
                    ></span>
                    {f}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {product.videoUrl ? (
            <section className="pd__block">
              <span className="label">Product video</span>
              <div className="video">
                <iframe
                  src={product.videoUrl}
                  title={`${product.name} video`}
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            </section>
          ) : null}

          <div className="pd__actions">
            <a className="btn btn--primary" href={quoteHref(product.name)}>
              Request a quote
            </a>
            <ShareButton title={product.name} />
          </div>
        </div>
      </article>

      {/* Extra photography beyond the four thumbnails */}
      {rest.length > 4 ? (
        <section className="section">
          <div className="container">
            <span className="label">Gallery</span>
            <div style={{ marginTop: 12 }}>
              <Gallery images={rest.slice(4)} alt={product.name} />
            </div>
          </div>
        </section>
      ) : null}

      {usedIn.length ? (
        <section className="related">
          <div className="container">
            <div className="related__head">
              <h2 className="related__title">Used in these projects</h2>
              <Link href="/projects" className="link-rule">
                All projects →
              </Link>
            </div>
            <div className="related__grid">
              {usedIn.map((project) => (
                <Link
                  key={project.slug}
                  href={`/projects/${project.slug}`}
                  className="media media--zoom project-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={project.thumbnail} alt={project.name} loading="lazy" />
                  <div className="media__scrim"></div>
                  <div className="media__caption">
                    <span className="project-card__category">
                      {project.categoryName} · {project.year}
                    </span>
                    <span className="project-card__name">{project.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
