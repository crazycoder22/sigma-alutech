import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { saveImage } from '@/lib/storage';
import { withErrorHandling } from '@/lib/api-helpers';

const ALLOWED_FOLDERS = new Set(['products', 'projects']);

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get('file');
    const folder = String(form.get('folder') ?? 'products');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    }
    const url = await saveImage(file, folder);
    return { url };
  });
}
