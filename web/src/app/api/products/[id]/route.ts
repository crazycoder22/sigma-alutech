import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { productInputSchema, normalizeYouTubeUrl } from '@/lib/validation';
import { updateProduct, deleteProduct } from '@/lib/catalog';
import { withErrorHandling, notFound } from '@/lib/api-helpers';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = Number((await params).id);
    const input = productInputSchema.parse(await req.json());
    input.videoUrl = normalizeYouTubeUrl(input.videoUrl);
    const product = await updateProduct(id, input);
    if (!product) return notFound('Product');
    return { product };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = Number((await params).id);
    const product = await deleteProduct(id);
    if (!product) return notFound('Product');
    return { ok: true };
  });
}
