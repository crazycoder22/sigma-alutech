import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/catalog';
import { Gallery } from '@/components/Gallery';
import { ShareButton } from '@/components/ShareButton';
import { quoteHref } from '@/lib/site';
import { titleCase } from '@/lib/types';

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
  const project = await getProjectBySlug((await params).slug);
  if (!project) notFound();

  const hero = project.images[0] ?? project.thumbnail;
  const gallery = project.images.length > 1 ? project.images.slice(1) : [];

  const meta = [
    { label: 'Location', value: project.location },
    { label: 'Completed', value: String(project.year) },
    { label: 'Scope', value: project.type },
    { label: 'Architect', value: project.architect },
  ].filter((m) => m.value);

  return (
    <>
      {hero ? (
        <div className="media detail__hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt={project.name} />
        </div>
      ) : null}

      <div className="container">
        <article className="detail__body">
          <header className="detail__head">
            <div className="breadcrumb">
              <Link href="/projects">Projects</Link> / {project.categoryName}
            </div>
            <h1 className="detail__title">{project.name}</h1>
            {project.description ? (
              <p className="detail__lead">{project.description}</p>
            ) : null}
          </header>

          {meta.length ? (
            <div className="spec-grid">
              {meta.map((m) => (
                <div className="spec" key={m.label}>
                  <div className="spec__label">{m.label}</div>
                  <div className="spec__value spec__value--plain">{m.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {project.productsUsed.length ? (
            <section className="detail__section">
              <span className="label">Products used</span>
              <div className="pill-row">
                {project.productsUsed.map((p) => (
                  <Link key={p} href={`/products?category=${p}`} className="pill-ink">
                    {titleCase(p)}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {gallery.length ? (
            <section className="detail__section">
              <span className="label">Gallery</span>
              <Gallery images={gallery} alt={project.name} />
            </section>
          ) : null}

          {project.videoUrl ? (
            <section className="detail__section">
              <span className="label">Project video</span>
              <div className="video">
                <iframe
                  src={project.videoUrl}
                  title={`${project.name} video`}
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            </section>
          ) : null}

          <div className="cta-card">
            <div className="cta-card__title">A project like this in mind?</div>
            <a className="btn btn--on-ink btn--block" href={quoteHref(project.name)}>
              Talk to our team
            </a>
          </div>

          <div className="detail__actions">
            <Link className="btn btn--outline" href="/projects">
              ← All projects
            </Link>
            <ShareButton title={project.name} />
          </div>
        </article>
      </div>
    </>
  );
}
