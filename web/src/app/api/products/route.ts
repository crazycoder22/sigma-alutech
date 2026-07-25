import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { productInputSchema, normalizeYouTubeUrl } from '@/lib/validation';
import { createProduct } from '@/lib/catalog';
import { withErrorHandling } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const raw = await req.json();
    const input = productInputSchema.parse(raw);
    input.videoUrl = normalizeYouTubeUrl(input.videoUrl);
    const product = await createProduct(input);
    return { product };
  });
}
