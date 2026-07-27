/**
 * Payroll data layer against a real Postgres (sigma_test).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { toPaise } from '@/lib/payroll/calc';

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://sigma:sigma@localhost:55432/sigma_test';
process.env.DATABASE_URL = TEST_URL;

const store = await import('@/lib/payroll/store');

const client = postgres(TEST_URL, { max: 2, ssl: false });
const db = drizzle(client, { schema });

beforeAll(async () => {
  await db.delete(schema.payrollLines);
  await db.delete(schema.payrollRuns);
  await db.delete(schema.employees);
});

beforeEach(async () => {
  await db.delete(schema.payrollLines);
  await db.delete(schema.payrollRuns);
  await db.delete(schema.employees);
});

afterAll(async () => {
  await client.end();
});

const person = {
  name: 'TEST PERSON',
  phone: '919876500001',
  grossSalary: toPaise(30000),
  pfContribution: toPaise(1454),
  busPass: toPaise(1200),
  active: true,
  sortOrder: 0,
};

const lineFor = (employeeId: number | null) => ({
  employeeId,
  employeeName: 'TEST PERSON',
  phone: '919876500001',
  daysWorked: 28,
  grossSalary: toPaise(30000),
  otHours: 17,
  outsidePay: toPaise(1000),
  advancePending: toPaise(5000),
  advanceDeducted: toPaise(2000),
  attendanceBonus: toPaise(500),
  phoneDeduction: 0,
  pfContribution: toPaise(1454),
  busPass: toPaise(1200),
  annualBonus: 0,
  sortOrder: 0,
});

describe('employees', () => {
  it('creates, updates and deletes', async () => {
    const created = await store.createEmployee(person);
    expect(created.id).toBeGreaterThan(0);

    const updated = await store.updateEmployee(created.id, { phone: '919999999999' });
    expect(updated?.phone).toBe('919999999999');

    expect(await store.updateEmployee(999999, { phone: 'x' })).toBeNull();
    await store.deleteEmployee(created.id);
    expect(await store.listEmployees()).toHaveLength(0);
  });

  it('can hide inactive people from a run', async () => {
    await store.createEmployee(person);
    await store.createEmployee({ ...person, name: 'GONE', active: false });
    expect(await store.listEmployees()).toHaveLength(2);
    expect(await store.listEmployees(false)).toHaveLength(1);
  });
});

describe('payroll runs', () => {
  it('stores derived figures alongside the inputs', async () => {
    const emp = await store.createEmployee(person);
    const run = await store.createRun('2026-06-01', 30);
    await store.replaceLines(run.id, 30, [lineFor(emp.id)]);

    const saved = await store.getRun(run.id);
    const line = saved!.lines[0];

    // 30000/30 = 1000/day; 28 days = 28000; 17 hrs at 1000/8.5 = 2000
    expect(line.earnedSalary).toBe(toPaise(28000));
    expect(line.otAmount).toBe(toPaise(2000));
    expect(line.totalEarnings).toBe(toPaise(31000));
    expect(line.balanceAdvance).toBe(toPaise(3000));
    // 31000 + 500 + 1200 - 2000 - 1454
    expect(line.netPaid).toBe(toPaise(29246));
  });

  it('refuses two runs for the same month', async () => {
    await store.createRun('2026-06-01', 30);
    await expect(store.createRun('2026-06-01', 30)).rejects.toThrow();
  });

  it('replaces lines wholesale rather than accumulating', async () => {
    const run = await store.createRun('2026-07-01', 31);
    await store.replaceLines(run.id, 31, [lineFor(null), lineFor(null)]);
    expect((await store.getRun(run.id))!.lines).toHaveLength(2);

    await store.replaceLines(run.id, 31, [lineFor(null)]);
    expect((await store.getRun(run.id))!.lines).toHaveLength(1);
  });

  it('keeps the payslip snapshot when the employee record changes', async () => {
    const emp = await store.createEmployee(person);
    const run = await store.createRun('2026-08-01', 31);
    await store.replaceLines(run.id, 31, [lineFor(emp.id)]);

    await store.updateEmployee(emp.id, { name: 'RENAMED', grossSalary: toPaise(99000) });

    const line = (await store.getRun(run.id))!.lines[0];
    expect(line.employeeName).toBe('TEST PERSON');
    expect(line.grossSalary).toBe(toPaise(30000));
  });

  it('keeps past payslips when an employee is deleted', async () => {
    const emp = await store.createEmployee(person);
    const run = await store.createRun('2026-09-01', 30);
    await store.replaceLines(run.id, 30, [lineFor(emp.id)]);

    await store.deleteEmployee(emp.id);

    const line = (await store.getRun(run.id))!.lines[0];
    expect(line.employeeId).toBeNull();     // link cleared…
    expect(line.employeeName).toBe('TEST PERSON'); // …but the record survives
  });

  it('cascades lines when a run is deleted', async () => {
    const run = await store.createRun('2026-10-01', 31);
    await store.replaceLines(run.id, 31, [lineFor(null)]);
    await store.deleteRun(run.id);
    const rows = await db
      .select()
      .from(schema.payrollLines)
      .where(eq(schema.payrollLines.runId, run.id));
    expect(rows).toHaveLength(0);
  });

  it('tracks delivery state per line', async () => {
    const run = await store.createRun('2026-11-01', 30);
    await store.replaceLines(run.id, 30, [lineFor(null)]);
    const line = (await store.getRun(run.id))!.lines[0];

    await store.setLinePdf(line.id, 'https://example.test/slip.pdf');
    await store.setLineDelivery(line.id, 'sent');
    let fresh = (await store.getRun(run.id))!.lines[0];
    expect(fresh.pdfUrl).toBe('https://example.test/slip.pdf');
    expect(fresh.deliveryStatus).toBe('sent');
    expect(fresh.deliveredAt).toBeInstanceOf(Date);

    await store.setLineDelivery(line.id, 'failed', 'number blocked');
    fresh = (await store.getRun(run.id))!.lines[0];
    expect(fresh.deliveryStatus).toBe('failed');
    expect(fresh.deliveryError).toBe('number blocked');
    expect(fresh.deliveredAt).toBeNull();
  });

  it('summarises runs for the list screen', async () => {
    // 30-day month so the per-line net matches the figure asserted above.
    const run = await store.createRun('2026-12-01', 30);
    await store.replaceLines(run.id, 30, [lineFor(null), lineFor(null)]);
    const [summary] = await store.listRuns();
    expect(summary.lineCount).toBe(2);
    expect(summary.totalNet).toBe(toPaise(29246) * 2);
    expect(summary.sentCount).toBe(0);
  });

  it('pro-rates differently in a 31-day month', async () => {
    const run = await store.createRun('2027-01-01', 31);
    await store.replaceLines(run.id, 31, [lineFor(null)]);
    const line = (await store.getRun(run.id))!.lines[0];
    // 30000 x 28/31 = 27096.77, OT 17 hrs at (30000/31)/8.5 = 1935.48
    expect(line.earnedSalary).toBe(2709677);
    expect(line.otAmount).toBe(193548);
    expect(line.netPaid).toBeLessThan(toPaise(29246)); // fewer rupees per day
  });

  it("reads last month's net so a sharp move can be flagged", async () => {
    const may = await store.createRun('2028-05-01', 31);
    await store.replaceLines(may.id, 31, [lineFor(null)]);

    const previous = await store.previousNetByName('2028-06-01');
    expect(previous['TEST PERSON']).toBeGreaterThan(0);

    // Nothing in the month before this one, so nothing to compare against.
    expect(await store.previousNetByName('2028-05-01')).toEqual({});
    // January looks back to December of the year before.
    expect(await store.previousNetByName('2028-01-01')).toEqual({});
  });
});
