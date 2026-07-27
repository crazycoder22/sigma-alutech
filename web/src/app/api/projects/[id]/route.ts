import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { projectInputSchema, normalizeYouTubeUrl } from '@/lib/validation';
import { updateProject, deleteProject } from '@/lib/catalog';
import { withErrorHandling, notFound, parseId } from '@/lib/api-helpers';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Project');
    const input = projectInputSchema.parse(await req.json());
    input.videoUrl = normalizeYouTubeUrl(input.videoUrl);
    const project = await updateProject(id, input);
    if (!project) return notFound('Project');
    return { project };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Project');
    const project = await deleteProject(id);
    if (!project) return notFound('Project');
    return { ok: true };
  });
}
