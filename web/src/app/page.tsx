import Link from 'next/link';
import {
  getCatalog,
  getFeaturedProducts,
  getFeaturedProjects,
  getProjects,
  getSiteStats,
} from '@/lib/catalog';
import { HeroSlider } from '@/components/HeroSlider';
import { SITE } from '@/lib/site';
import { titleCase } from '@/lib/types';
import type { ProjectDto } from '@/lib/types';

export const dynamic = 'force-dynamic';

const HERO_IMAGES = [
  '/images/hero/hero-1.svg',
  '/images/hero/hero-2.svg',
  '/images/hero/hero-3.svg',
];

/** Overlay card used in the featured-project mosaic. */
function ProjectTile({
  project,
  className = '',
  large = false,
}: {
  project: ProjectDto;
  className?: string;
  large?: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`media media--zoom project-card ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={project.thumbnail} alt={project.name} loading="lazy" />
      <div className="media__scrim"></div>
      <div className="media__caption">
        <span className="project-card__category">
          {project.categoryName} · {project.year}
        </span>
        <span
          className="project-card__name"
          style={large ? { fontSize: 'clamp(1.5rem, 2.6vw, 2.375rem)' } : undefined}
        >
          {project.name}
        </span>
        {large && project.location ? (
          <span className="project-card__place">{project.location}</span>
        ) : null}
      </div>
    </Link>
  );
}

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
    featuredProducts.length ? featuredProducts : catalog.flatMap((c) => c.products)
  ).slice(0, 6);

  const projects = featuredProjects.length ? featuredProjects : allProjects;
  const [lead, ...rest] = projects;
  const stack = rest.slice(0, 2);

  const categoryOf = (categoryId: number) =>
    catalog.find((c) => c.id === categoryId)?.name ?? '';

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <HeroSlider images={HERO_IMAGES} />
        <div className="container">
          <div className="hero__content">
            <div className="eyebrow">Authorized Technal Partner</div>
            <h1 className="hero__title">Architecture, framed in aluminium.</h1>
            <p className="hero__lead">
              Premium aluminium fabrication for residential, commercial and industrial
              spaces. Delivering excellence in {SITE.city} since {SITE.established}.
            </p>
            <div className="hero__actions">
              <Link href="/products" className="btn btn--on-ink">
                Explore products
              </Link>
              <Link href="/projects" className="btn btn--ghost-ink">
                View projects
              </Link>
            </div>
          </div>
        </div>
        <div className="hero__cue" aria-hidden="true">
          Scroll <span>↓</span>
        </div>
      </section>

      {/* ---------- Stat band ---------- */}
      <div className="stats stats--band">
        <div className="stat">
          <div className="stat__number">25+</div>
          <div className="stat__label">Years in business</div>
        </div>
        <div className="stat">
          <div className="stat__number">{stats.projects}</div>
          <div className="stat__label">Landmark projects</div>
        </div>
        <div className="stat">
          <div className="stat__number">{stats.categories}</div>
          <div className="stat__label">Product categories</div>
        </div>
        <div className="stat">
          <div className="stat__number">100%</div>
          <div className="stat__label">Technal systems</div>
        </div>
      </div>

      {/* ---------- Featured products ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <div className="section-head__row">
              <div>
                <span className="eyebrow">Systems</span>
                <h2 className="section-head__title" style={{ marginTop: 12 }}>
                  Featured products
                </h2>
              </div>
              <Link href="/products" className="link-rule">
                All {stats.products} products →
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
                  <span className="card__kicker">
                    {[categoryOf(product.categoryId), titleCase(product.topology)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="mini-card__title">{product.name}</span>
                  <span className="mini-card__text">{product.tagline}</span>
                  <span className="mini-card__more">View details →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- What we make ---------- */}
      <section className="cat-split">
        <div className="cat-split__copy reveal">
          <span className="label">What we make</span>
          <h2 className="cat-split__title">
            {stats.categories === 6
              ? 'Six categories, one standard of finish'
              : `${stats.categories} categories, one standard of finish`}
          </h2>
          <p className="cat-split__text">
            Every system is Technal-engineered and fabricated in our {SITE.city} workshop,
            then installed by our own crews.
          </p>
        </div>
        <div className="cat-list">
          {catalog.map((cat) => (
            <Link key={cat.slug} href={`/products?category=${cat.slug}`} className="cat-row">
              <span className="cat-row__name">{cat.name}</span>
              <span className="cat-row__meta">
                <span className="cat-row__count">
                  {cat.products.length} system{cat.products.length === 1 ? '' : 's'}
                </span>
                <span className="cat-row__arrow">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Featured projects ---------- */}
      {lead ? (
        <section className="section">
          <div className="container">
            <div className="section-head reveal">
              <span className="eyebrow">Portfolio</span>
              <div className="section-head__row">
                <h2 className="section-head__title">Projects that define us</h2>
                <Link href="/projects" className="link-rule">
                  All {stats.projects} projects →
                </Link>
              </div>
            </div>

            <div className="mosaic reveal">
              <ProjectTile project={lead} className="mosaic__lead" large />
              {stack.length ? (
                <div className="mosaic__stack">
                  {stack.map((p) => (
                    <ProjectTile key={p.slug} project={p} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
