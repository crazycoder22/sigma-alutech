import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Neon and Vercel Postgres pool best with a single connection per
// serverless invocation; locally a small pool is fine.
const globalForDb = globalThis as unknown as {
  __sigmaDb?: ReturnType<typeof createDb>;
};

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = postgres(url, {
    max: process.env.NODE_ENV === 'production' ? 1 : 5,
    // Neon requires TLS; local docker does not support it.
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
  });
  return drizzle(client, { schema });
}

export function getDb() {
  if (!globalForDb.__sigmaDb) {
    globalForDb.__sigmaDb = createDb();
  }
  return globalForDb.__sigmaDb;
}

export * from './schema';
