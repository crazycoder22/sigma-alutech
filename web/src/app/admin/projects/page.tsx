import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getCatalog, getProjectCategories, getProjects } from '@/lib/catalog';
import { ProjectsAdmin } from '@/components/admin/ProjectsAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminProjectsPage() {
  const session = await getSession();
  if (!session) redirect('/admin');
  const [categories, projects, catalog] = await Promise.all([
    getProjectCategories(),
    getProjects(),
    getCatalog(),
  ]);
  return (
    <ProjectsAdmin
      categories={categories}
      projects={projects}
      productCategorySlugs={catalog.map((c) => c.slug)}
    />
  );
}
