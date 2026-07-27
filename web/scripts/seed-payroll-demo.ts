/**
 * Seed a small demo staff register — the same eight people as
 * tests/fixtures/salary-sample.xlsx, so an uploaded fixture matches by name.
 *
 * Invented data only: never seed real employees or real salaries here.
 * Existing people (matched on name) are left alone, so this is safe to re-run.
 *
 *   npm run db:seed-payroll
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { toPaise } from '../src/lib/payroll/calc';
import { normalisePhone } from '../src/lib/payroll/whatsapp';

const REGISTER = [
  { name: 'ARJUN RAO', phone: '9876500001', gross: 30000, pf: 0, bus: 1200 },
  { name: 'BHAVNA SINGH', phone: '9876500002', gross: 39000, pf: 1571, bus: 2500 },
  { name: 'CHETAN M', phone: '9876500003', gross: 27500, pf: 0, bus: 0 },
  { name: 'DEEPAK N', phone: '9876500004', gross: 23000, pf: 1454, bus: 1200 },
  { name: 'ESHA PATEL', phone: '9876500005', gross: 32000, pf: 0, bus: 1200 },
  { name: 'FARHAN K', phone: '9876500006', gross: 24000, pf: 1454, bus: 0 },
  { name: 'GAURAV S', phone: '9876500007', gross: 24000, pf: 1454, bus: 3000 },
  // Deliberately without a number: the run screen must flag them, not send.
  { name: 'HEMA R (HELPER)', phone: '', gross: 15000, pf: 0, bus: 0 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = postgres(url, {
    max: 1,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
  });
  const db = drizzle(client, { schema });

  const existing = new Set(
    (await db.select({ name: schema.employees.name }).from(schema.employees)).map((r) => r.name)
  );

  let added = 0;
  for (const [i, p] of REGISTER.entries()) {
    if (existing.has(p.name)) continue;
    await db.insert(schema.employees).values({
      name: p.name,
      phone: (p.phone && normalisePhone(p.phone)) || '',
      grossSalary: toPaise(p.gross),
      pfContribution: toPaise(p.pf),
      busPass: toPaise(p.bus),
      active: true,
      sortOrder: i,
    });
    added += 1;
  }

  console.log(`Seeded ${added} employee(s); ${existing.size} already present.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
