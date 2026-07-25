import type { Metadata } from 'next';
import { getProjects, getProjectCategories } from '@/lib/catalog';
import { ProjectsShowcase } from '@/components/ProjectsShowcase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects | Sigma Alutech',
  description:
    'Sigma Alutech Project Portfolio - major projects including 5-star hotels, luxury villas, manufacturing plants, and institutional buildings.',
};

export default async function ProjectsPage() {
  const [categories, projects] = await Promise.all([
    getProjectCategories(),
    getProjects(),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="section-label">Our Portfolio</span>
          <h1 className="page-header__title">Projects That Define Us</h1>
          <p className="page-header__subtitle">
            From five-star hotels to luxury villas and industrial facilities &mdash; over 25 years
            of excellence across {projects.length}+ landmark projects.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <ProjectsShowcase categories={categories} projects={projects} />
        </div>
      </section>
    </>
  );
}
