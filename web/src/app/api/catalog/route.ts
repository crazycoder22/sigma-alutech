import { getCatalog } from '@/lib/catalog';
import { withErrorHandling } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withErrorHandling(async () => {
    const categories = await getCatalog();
    return { categories };
  });
}
