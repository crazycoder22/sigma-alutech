import type { Metadata } from 'next';
import { getProjectCategories, getProjects } from '@/lib/catalog';
import { ProjectsGrid } from '@/components/ProjectsGrid';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Sigma Alutech project portfolio — five-star hotels, luxury villas, corporate offices and industrial plants across South India.',
};

export default async function ProjectsPage() {
  const [categories, projects] = await Promise.all([
    getProjectCategories(),
    getProjects(),
  ]);

  return (
    <>
      <section className="intro-band intro-band--ink">
        <div className="container intro-band__grid">
          <div className="intro-band__head">
            <span className="eyebrow">Our portfolio</span>
            <h1 className="intro-band__title">Projects that define us</h1>
          </div>
          <p className="intro-band__lead">
            From five-star hotels to luxury villas and industrial facilities — over 25
            years of excellence across {projects.length} landmark projects.
          </p>
        </div>
      </section>

      <ProjectsGrid categories={categories} projects={projects} />
    </>
  );
}
