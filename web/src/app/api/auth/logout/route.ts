import { destroySession } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';

export async function POST() {
  return withErrorHandling(async () => {
    await destroySession();
    return { ok: true };
  });
}
