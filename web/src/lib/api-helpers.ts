import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError } from './auth';
import { UploadError } from './storage';

type Handler<T> = () => Promise<T>;

/** Uniform error mapping for API route handlers. */
export async function withErrorHandling<T>(fn: Handler<NextResponse | T>) {
  try {
    const result = await fn();
    return result instanceof NextResponse ? result : NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof ZodError) {
      const details = err.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return NextResponse.json({ error: `Invalid input — ${details}` }, { status: 400 });
    }
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: 'That slug is already in use — pick a different one.' },
        { status: 409 }
      );
    }
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export function notFound(what = 'Resource') {
  return NextResponse.json({ error: `${what} not found` }, { status: 404 });
}

/** Drizzle wraps driver errors; walk the cause chain for Postgres 23505. */
export function isDuplicateKeyError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'object') {
      const e = current as { code?: string; message?: string; cause?: unknown };
      if (e.code === '23505' || e.message?.includes('duplicate key')) return true;
      current = e.cause;
    } else {
      break;
    }
  }
  return false;
}
