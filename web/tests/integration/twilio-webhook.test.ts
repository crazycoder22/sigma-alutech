/**
 * Twilio's delivery callbacks. Public, like Meta's, and signed
 * differently: HMAC-SHA1 over the callback URL concatenated with every
 * POST field sorted by name.
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
const CALLBACK = 'https://sigmaalutech.in/api/whatsapp/webhook/twilio';
process.env.DATABASE_URL = TEST_URL;
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
process.env.TWILIO_STATUS_CALLBACK = CALLBACK;

const store = await import('@/lib/payroll/store');
const route = await import('@/app/api/whatsapp/webhook/twilio/route');

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

async function sentLine(sid: string) {
  const run = await store.createRun('2029-10-01', 31);
  await store.replaceLines(run.id, 31, [
    {
      employeeId: null,
      employeeName: 'TEST PERSON',
      phone: '919876500001',
      daysWorked: 31,
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
    },
  ]);
  const line = (await store.getRun(run.id))!.lines[0];
  await store.setLineDelivery(line.id, 'sent', null, sid);
  return line.id;
}

/** Sign exactly the way Twilio does. */
function sign(params: Record<string, string>, token = 'test-auth-token', url = CALLBACK) {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');
  return createHmac('sha1', token).update(payload, 'utf8').digest('base64');
}

function post(params: Record<string, string>, signature?: string | null) {
  const headers = new Headers({
    'content-type': 'application/x-www-form-urlencoded',
  });
  if (signature !== null) headers.set('x-twilio-signature', signature ?? sign(params));
  return new Request(CALLBACK, {
    method: 'POST',
    headers,
    body: new URLSearchParams(params).toString(),
  });
}

async function statusOf(lineId: number) {
  const [row] = await db
    .select()
    .from(schema.payrollLines)
    .where(eq(schema.payrollLines.id, lineId));
  return row;
}

describe('twilio status callbacks', () => {
  it('refuses an unsigned request', async () => {
    const lineId = await sentLine('SM1');
    const res = await route.POST(
      post({ MessageSid: 'SM1', MessageStatus: 'delivered' }, null)
    );
    expect(res.status).toBe(401);
    expect((await statusOf(lineId)).deliveryStatus).toBe('sent');
  });

  it('refuses a signature made with the wrong token', async () => {
    const lineId = await sentLine('SM2');
    const params = { MessageSid: 'SM2', MessageStatus: 'delivered' };
    const res = await route.POST(post(params, sign(params, 'not-the-token')));
    expect(res.status).toBe(401);
    expect((await statusOf(lineId)).deliveryStatus).toBe('sent');
  });

  it('advances a line to delivered, then read', async () => {
    const lineId = await sentLine('SM3');
    await route.POST(post({ MessageSid: 'SM3', MessageStatus: 'delivered' }));
    expect((await statusOf(lineId)).deliveryStatus).toBe('delivered');
    await route.POST(post({ MessageSid: 'SM3', MessageStatus: 'read' }));
    expect((await statusOf(lineId)).deliveryStatus).toBe('read');
  });

  it('treats undelivered as a failure and keeps the reason', async () => {
    const lineId = await sentLine('SM4');
    await route.POST(
      post({
        MessageSid: 'SM4',
        MessageStatus: 'undelivered',
        ErrorCode: '63024',
        ErrorMessage: 'Invalid WhatsApp recipient',
      })
    );
    const row = await statusOf(lineId);
    expect(row.deliveryStatus).toBe('failed');
    expect(row.deliveryError).toBe('Invalid WhatsApp recipient');
  });

  it('ignores the statuses that mean nothing has happened yet', async () => {
    const lineId = await sentLine('SM5');
    await route.POST(post({ MessageSid: 'SM5', MessageStatus: 'queued' }));
    expect((await statusOf(lineId)).deliveryStatus).toBe('sent');
  });
});
