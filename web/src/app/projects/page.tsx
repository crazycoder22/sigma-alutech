import type { Metadata } from 'next';
import { getProjectCategories, getProjects } from '@/lib/catalog';
import { ProjectsGrid } from '@/components/ProjectsGrid';
import { Enquiry } from '@/components/Enquiry';

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
      <section className="container">
        <div className="page-intro">
          <span className="eyebrow">Our portfolio</span>
          <h1 className="page-intro__title">Projects that define us</h1>
          <p className="page-intro__lead">
            Five-star hotels to luxury villas and industrial plants — {projects.length}{' '}
            landmark projects over 25 years.
          </p>
        </div>

        <ProjectsGrid categories={categories} projects={projects} />
      </section>

      <Enquiry />
    </>
  );
}
