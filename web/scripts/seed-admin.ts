/**
 * Create (or reset the password of) an admin login.
 * Usage:
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run db:seed-admin
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from '../src/db/schema';

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');
  }
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const client = postgres(url, {
    max: 1,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
  });
  const db = drizzle(client, { schema });
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await db
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, email));
  if (existing.length) {
    await db
      .update(schema.admins)
      .set({ passwordHash })
      .where(eq(schema.admins.id, existing[0].id));
    console.log(`Updated password for admin ${email}`);
  } else {
    await db.insert(schema.admins).values({ email, passwordHash, name: email.split('@')[0] });
    console.log(`Created admin ${email}`);
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
