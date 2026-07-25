import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, createSession } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { email, password } = bodySchema.parse(await req.json());
    const admin = await authenticate(email, password);
    if (!admin) {
      return NextResponse.json(
        { error: 'Incorrect email or password' },
        { status: 401 }
      );
    }
    await createSession(admin.id, admin.email);
    return { ok: true, email: admin.email };
  });
}
