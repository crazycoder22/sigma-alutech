import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalog';
import { Enquiry } from '@/components/Enquiry';
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

  const [hero, ...rest] = product.images;
  const specs = Object.entries(product.specifications);

  return (
    <>
      {hero ? (
        <div className="media detail__hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt={product.name} />
        </div>
      ) : null}

      <div className="container">
        <article className="detail__body">
          <header className="detail__head">
            <div className="breadcrumb">
              <Link href="/products">Products</Link> /{' '}
              <Link href={`/products?category=${product.categorySlug}`}>
                {product.categoryName}
              </Link>
            </div>

            <div className="detail__tags">
              {product.topology ? (
                <span className="tag--gold">{titleCase(product.topology)}</span>
              ) : null}
              {product.series ? (
                <span className="tag--outline">Series {product.series}</span>
              ) : null}
            </div>

            <h1 className="detail__title">{product.name}</h1>
            {product.description ? (
              <p className="detail__lead">{product.description}</p>
            ) : null}
          </header>

          {product.features.length ? (
            <section className="detail__section">
              <span className="label">Features</span>
              <ul className="feature-list">
                {product.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {specs.length ? (
            <section className="detail__section">
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
            <section className="detail__section">
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

          {rest.length ? (
            <section className="detail__section">
              <span className="label">Gallery</span>
              <Gallery images={rest} alt={product.name} />
            </section>
          ) : null}

          {product.videoUrl ? (
            <section className="detail__section">
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

          <div className="detail__actions">
            <a className="btn btn--primary" href={quoteHref(product.name)}>
              Request a quote
            </a>
            <ShareButton title={product.name} />
          </div>
        </article>
      </div>

      <Enquiry
        title="Specifying this system?"
        text="Send us your drawings or site details and we'll confirm sizes, finishes and lead time."
        subject={product.name}
      />
    </>
  );
}
