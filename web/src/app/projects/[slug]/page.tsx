import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdjacentProject, getCatalog, getProjectBySlug } from '@/lib/catalog';
import { Gallery } from '@/components/Gallery';
import { quoteHref } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = await getProjectBySlug((await params).slug);
  if (!project) return { title: 'Project not found' };
  return {
    title: project.name,
    description:
      project.description.slice(0, 155) ||
      `${project.type} in ${project.location} by Sigma Alutech.`,
  };
}

export default async function ProjectDetailPage({ params }: Params) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [next, catalog] = await Promise.all([getAdjacentProject(slug), getCatalog()]);

  const hero = project.images[0] ?? project.thumbnail;
  const gallery = project.images.length > 1 ? project.images.slice(1) : [];

  // productsUsed stores category slugs; show their display names.
  const used = project.productsUsed
    .map((s) => catalog.find((c) => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const facts = [
    { label: 'Location', value: project.location },
    { label: 'Completed', value: String(project.year) },
    { label: 'Scope', value: project.type },
    { label: 'Architect', value: project.architect },
    { label: 'Category', value: project.categoryName },
  ].filter((f) => f.value);

  return (
    <>
      {/* ---- Hero carries the title ---- */}
      <header className="detail-hero">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={project.name} />
        ) : null}
        <div className="detail-hero__scrim"></div>
        <div className="container">
          <div className="detail-hero__content">
            <span className="detail-hero__meta">
              {project.categoryName} · {project.year}
            </span>
            <h1 className="detail-hero__title">{project.name}</h1>
            {project.location ? (
              <span className="detail-hero__place">{project.location}</span>
            ) : null}
          </div>
        </div>
      </header>

      {/* ---- Brief + facts ---- */}
      <div className="container">
        <div className="brief-grid">
          <div className="brief">
            <span className="label">The brief</span>
            {project.description ? (
              <p className="brief__text">{project.description}</p>
            ) : null}

            {used.length ? (
              <div className="pd__block">
                <span className="label">Products used</span>
                <div className="pill-row">
                  {used.map((c) => (
                    <Link key={c.slug} href={`/products?category=${c.slug}`} className="chip">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="meta-panel">
            {facts.map((f) => (
              <div className="meta-panel__row" key={f.label}>
                <div className="meta-panel__label">{f.label}</div>
                <div className="meta-panel__value">{f.value}</div>
              </div>
            ))}
          </aside>
        </div>

        {gallery.length ? (
          <div style={{ paddingBottom: 'var(--section-padding)' }}>
            <Gallery images={gallery} alt={project.name} mosaic />
          </div>
        ) : null}

        {project.videoUrl ? (
          <div style={{ paddingBottom: 'var(--section-padding)' }}>
            <span className="label">Project video</span>
            <div className="video" style={{ marginTop: 12 }}>
              <iframe
                src={project.videoUrl}
                title={`${project.name} video`}
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </div>
        ) : null}
      </div>

      {/* ---- Closing CTA ---- */}
      <section className="cta-band">
        <div className="container cta-band__inner">
          <div className="cta-band__copy">
            <h2 className="cta-band__title">A project like this in mind?</h2>
            <p className="cta-band__text">
              Share your drawings — we&apos;ll spec the systems and quote in three working
              days.
            </p>
          </div>
          <div className="cta-band__actions">
            <a className="btn btn--on-ink" href={quoteHref(project.name)}>
              Talk to our team
            </a>
            {next ? (
              <Link className="btn btn--ghost-ink" href={`/projects/${next.slug}`}>
                Next project →
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
