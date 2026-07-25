import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySessionToken,
} from '@/lib/auth-core';

const SECRET = 'test-secret-0123456789abcdef';

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('hunter2hunter2');
    expect(hash).not.toContain('hunter2');
    expect(await verifyPassword('hunter2hunter2', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('rejects garbage hashes without throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-bcrypt-hash')).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a valid session', async () => {
    const token = await signSession({ adminId: 7, email: 'a@b.c' }, SECRET, 3600);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload).toEqual({ adminId: 7, email: 'a@b.c' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession({ adminId: 7, email: 'a@b.c' }, SECRET, 3600);
    expect(await verifySessionToken(token, 'other-secret-xxxxxxxxxxxx')).toBeNull();
  });

  it('rejects tampered tokens', async () => {
    const token = await signSession({ adminId: 7, email: 'a@b.c' }, SECRET, 3600);
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(await verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const token = await signSession({ adminId: 7, email: 'a@b.c' }, SECRET, -60);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });
});
