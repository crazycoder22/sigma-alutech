/**
 * The delivery webhook against a real Postgres.
 *
 * This route is public — Meta calls it, not an admin — and it writes to the
 * payroll record. The signature check is the only thing standing between a
 * stranger who found the URL and the delivery history, so it gets covered
 * first.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createHmac } from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { toPaise } from '@/lib/payroll/calc';

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://sigma:sigma@localhost:55432/sigma_test';
process.env.DATABASE_URL = TEST_URL;
process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';

const store = await import('@/lib/payroll/store');
const route = await import('@/app/api/whatsapp/webhook/route');

const client = postgres(TEST_URL, { max: 2, ssl: false });
const db = drizzle(client, { schema });

async function wipe() {
  await db.delete(schema.payrollLines);
  await db.delete(schema.payrollRuns);
  await db.delete(schema.employees);
}

beforeAll(wipe);
beforeEach(wipe);
afterAll(async () => {
  await client.end();
});

const line = {
  employeeId: null,
  employeeName: 'TEST PERSON',
  phone: '919876500001',
  daysWorked: 30,
  grossSalary: toPaise(30000),
  otHours: 0,
  outsidePay: 0,
  advancePending: 0,
  advanceDeducted: 0,
  attendanceBonus: 0,
  phoneDeduction: 0,
  pfContribution: 0,
  busPass: 0,
  annualBonus: 0,
  sortOrder: 0,
};

/** A line that has been sent, carrying the provider's message id. */
async function sentLine(providerMessageId: string) {
  const run = await store.createRun('2029-09-01', 30);
  await store.replaceLines(run.id, 30, [line]);
  const saved = (await store.getRun(run.id))!.lines[0];
  await store.setLineDelivery(saved.id, 'sent', null, providerMessageId);
  return { runId: run.id, lineId: saved.id };
}

function post(body: unknown, secret: string | null = 'test-app-secret') {
  const raw = JSON.stringify(body);
  const headers = new Headers({ 'content-type': 'application/json' });
  if (secret !== null) {
    headers.set(
      'x-hub-signature-256',
      'sha256=' + createHmac('sha256', secret).update(raw, 'utf8').digest('hex')
    );
  }
  return new Request('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers,
    body: raw,
  });
}

const statusBody = (id: string, status: string, errors?: unknown) => ({
  entry: [{ changes: [{ value: { statuses: [{ id, status, errors }] } }] }],
});

async function statusOf(lineId: number) {
  const [row] = await db
    .select()
    .from(schema.payrollLines)
    .where(eq(schema.payrollLines.id, lineId));
  return row;
}

describe('verification handshake', () => {
  const get = (params: string) =>
    route.GET(new Request(`http://localhost/api/whatsapp/webhook?${params}`));

  it('echoes the challenge when the token matches', async () => {
    const res = await get(
      'hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345'
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('12345');
  });

  it('refuses a wrong token', async () => {
    const res = await get(
      'hub.mode=subscribe&hub.verify_token=guessed&hub.challenge=12345'
    );
    expect(res.status).toBe(403);
  });
});

describe('status callbacks', () => {
  it('refuses an unsigned request', async () => {
    const { lineId } = await sentLine('wamid.unsigned');
    const res = await route.POST(post(statusBody('wamid.unsigned', 'delivered'), null));
    expect(res.status).toBe(401);
    expect((await statusOf(lineId)).deliveryStatus).toBe('sent');
  });

  it('refuses a request signed with the wrong secret', async () => {
    const { lineId } = await sentLine('wamid.wrong');
    const res = await route.POST(
      post(statusBody('wamid.wrong', 'delivered'), 'not-the-secret')
    );
    expect(res.status).toBe(401);
    expect((await statusOf(lineId)).deliveryStatus).toBe('sent');
  });

  it('advances a line from sent to delivered to read', async () => {
    const { lineId } = await sentLine('wamid.abc');

    await route.POST(post(statusBody('wamid.abc', 'delivered')));
    expect((await statusOf(lineId)).deliveryStatus).toBe('delivered');

    await route.POST(post(statusBody('wamid.abc', 'read')));
    expect((await statusOf(lineId)).deliveryStatus).toBe('read');
  });

  it('never moves backwards when callbacks arrive out of order', async () => {
    const { lineId } = await sentLine('wamid.ooo');
    await route.POST(post(statusBody('wamid.ooo', 'read')));
    await route.POST(post(statusBody('wamid.ooo', 'delivered')));
    expect((await statusOf(lineId)).deliveryStatus).toBe('read');
  });

  it('records why a message failed', async () => {
    const { lineId } = await sentLine('wamid.bad');
    await route.POST(
      post(
        statusBody('wamid.bad', 'failed', [
          { title: 'Undeliverable', error_data: { details: 'Number not on WhatsApp' } },
        ])
      )
    );
    const row = await statusOf(lineId);
    expect(row.deliveryStatus).toBe('failed');
    expect(row.deliveryError).toBe('Number not on WhatsApp');
    expect(row.deliveredAt).toBeNull();
  });

  it('shrugs at a status for a message it does not know', async () => {
    const res = await route.POST(post(statusBody('wamid.stranger', 'delivered')));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: 0 });
  });
});
