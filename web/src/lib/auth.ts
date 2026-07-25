import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb, admins } from '@/db';
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySessionToken,
  SESSION_COOKIE,
  type SessionPayload,
} from './auth-core';

export { hashPassword, verifyPassword, SESSION_COOKIE };

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET must be set (16+ chars)');
  }
  return secret;
}

/** Check credentials against the admins table; return admin or null. */
export async function authenticate(email: string, password: string) {
  const db = getDb();
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email.trim().toLowerCase()));
  if (!admin) {
    // Burn comparable time so missing accounts aren't detectable by timing.
    await verifyPassword(password, '$2b$10$invalidsaltinvalidsaltinvalidsalt12345678901234567890');
    return null;
  }
  const ok = await verifyPassword(password, admin.passwordHash);
  return ok ? admin : null;
}

/** Set the signed session cookie for an authenticated admin. */
export async function createSession(adminId: number, email: string) {
  const token = await signSession(
    { adminId, email },
    sessionSecret(),
    SESSION_TTL_SECONDS
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Return the session payload if the request carries a valid session cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, sessionSecret());
}

/** Throw-style guard for route handlers. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
