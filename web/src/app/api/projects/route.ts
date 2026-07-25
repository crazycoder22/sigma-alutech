import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { projectInputSchema, normalizeYouTubeUrl } from '@/lib/validation';
import { createProject, getProjects, getProjectCategories } from '@/lib/catalog';
import { withErrorHandling } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withErrorHandling(async () => {
    const [categories, projects] = await Promise.all([
      getProjectCategories(),
      getProjects(),
    ]);
    return { categories, projects };
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const input = projectInputSchema.parse(await req.json());
    input.videoUrl = normalizeYouTubeUrl(input.videoUrl);
    const project = await createProject(input);
    return { project };
  });
}
