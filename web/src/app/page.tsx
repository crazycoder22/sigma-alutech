import Link from 'next/link';
import {
  getCatalog,
  getFeaturedProducts,
  getFeaturedProjects,
  getProjects,
  getSiteStats,
} from '@/lib/catalog';
import { HeroSlider } from '@/components/HeroSlider';
import { Enquiry } from '@/components/Enquiry';
import { SITE } from '@/lib/site';
import { titleCase } from '@/lib/types';

export const dynamic = 'force-dynamic';

const HERO_IMAGES = [
  '/images/hero/hero-1.svg',
  '/images/hero/hero-2.svg',
  '/images/hero/hero-3.svg',
];

export default async function HomePage() {
  const [catalog, featuredProducts, featuredProjects, allProjects, stats] =
    await Promise.all([
      getCatalog(),
      getFeaturedProducts(),
      getFeaturedProjects(),
      getProjects(),
      getSiteStats(),
    ]);

  // Fall back to the start of the catalog when nothing is flagged featured.
  const products = (
    featuredProducts.length
      ? featuredProducts
      : catalog.flatMap((c) => c.products)
  ).slice(0, 6);

  const projects = featuredProjects.length ? featuredProjects : allProjects;
  const hero = projects[0];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <HeroSlider images={HERO_IMAGES} />
        <div className="container">
          <div className="hero__content">
            <div className="eyebrow">Authorized Technal Partner</div>
            <h1 className="hero__title">
              Architecture,
              <br />
              framed in aluminium.
            </h1>
            <p className="hero__lead">{SITE.lead}</p>
            <div className="hero__actions">
              <Link href="/products" className="btn btn--on-ink">
                Explore products
              </Link>
              <Link href="/projects" className="btn btn--ghost-ink">
                Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <div className="stats">
        <div className="stat">
          <div className="stat__number">25+</div>
          <div className="stat__label">Years</div>
        </div>
        <div className="stat">
          <div className="stat__number">{stats.projects}</div>
          <div className="stat__label">Projects</div>
        </div>
        <div className="stat">
          <div className="stat__number">100%</div>
          <div className="stat__label">Technal</div>
        </div>
      </div>

      {/* ---------- Featured products ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="label">Systems</span>
            <div className="section-head__row">
              <h2 className="section-head__title">Featured products</h2>
              <Link href="/products" className="arrow-link">
                All <span>→</span>
              </Link>
            </div>
          </div>

          <div className="rail reveal">
            {products.map((product) => (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className="mini-card"
              >
                <div className="media media--zoom mini-card__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.images[0] ?? ''} alt={product.name} loading="lazy" />
                </div>
                <div className="mini-card__body">
                  <span className="card__kicker">{titleCase(product.topology)}</span>
                  <span className="mini-card__title">{product.name}</span>
                  <span className="mini-card__text">{product.tagline}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Featured project ---------- */}
      {hero ? (
        <section className="section section--alt">
          <div className="container">
            <div className="section-head reveal">
              <span className="label">Portfolio</span>
              <h2 className="section-head__title">Projects that define us</h2>
            </div>

            <Link
              href={`/projects/${hero.slug}`}
              className="media media--zoom feature-project reveal"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.thumbnail} alt={hero.name} loading="lazy" />
              <div className="media__scrim"></div>
              <div className="media__caption">
                <span className="feature-project__meta">
                  {hero.type} · {hero.year}
                </span>
                <span className="feature-project__name">
                  {hero.name}
                  {hero.location ? `, ${hero.location.split(',')[0]}` : ''}
                </span>
              </div>
            </Link>

            <div className="feature-project__links">
              <Link href={`/projects/${hero.slug}`} className="arrow-link">
                View project <span>→</span>
              </Link>
              <Link href="/projects" className="muted">
                All {stats.projects} projects
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- Enquiry ---------- */}
      <Enquiry />
    </>
  );
}
