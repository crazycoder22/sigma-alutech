import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import {
  getDb,
  employees,
  payrollRuns,
  payrollLines,
  type Employee,
  type PayrollRun,
  type PayrollLine,
} from '@/db';
import { calculatePay } from './calc';

/* ---------------- employees ---------------- */

export async function listEmployees(includeInactive = true): Promise<Employee[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employees)
    .orderBy(asc(employees.sortOrder), asc(employees.id));
  return includeInactive ? rows : rows.filter((e) => e.active);
}

export async function createEmployee(
  values: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Employee> {
  const db = getDb();
  const [row] = await db.insert(employees).values(values).returning();
  return row;
}

export async function updateEmployee(
  id: number,
  values: Partial<Omit<Employee, 'id' | 'createdAt'>>
): Promise<Employee | null> {
  const db = getDb();
  const [row] = await db
    .update(employees)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning();
  return row ?? null;
}

export async function deleteEmployee(id: number): Promise<Employee | null> {
  const db = getDb();
  const [row] = await db.delete(employees).where(eq(employees.id, id)).returning();
  return row ?? null;
}

/* ---------------- runs ---------------- */

export interface RunWithLines extends PayrollRun {
  lines: PayrollLine[];
}

export async function listRuns(): Promise<
  Array<PayrollRun & { lineCount: number; totalNet: number; sentCount: number }>
> {
  const db = getDb();
  const runs = await db.select().from(payrollRuns).orderBy(asc(payrollRuns.period));
  const allLines = await db.select().from(payrollLines);
  return runs
    .map((run) => {
      const lines = allLines.filter((l) => l.runId === run.id);
      return {
        ...run,
        lineCount: lines.length,
        totalNet: lines.reduce((n, l) => n + l.netPaid, 0),
        sentCount: lines.filter((l) => l.deliveryStatus === 'sent').length,
      };
    })
    .reverse();
}

export async function getRun(id: number): Promise<RunWithLines | null> {
  const db = getDb();
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
  if (!run) return null;
  const lines = await db
    .select()
    .from(payrollLines)
    .where(eq(payrollLines.runId, id))
    .orderBy(asc(payrollLines.sortOrder), asc(payrollLines.id));
  return { ...run, lines };
}

export async function getRunByPeriod(period: string): Promise<PayrollRun | null> {
  const db = getDb();
  const [row] = await db.select().from(payrollRuns).where(eq(payrollRuns.period, period));
  return row ?? null;
}

export async function createRun(
  period: string,
  daysInPeriod: number
): Promise<PayrollRun> {
  const db = getDb();
  const [row] = await db
    .insert(payrollRuns)
    .values({ period, daysInPeriod })
    .returning();
  return row;
}

export async function deleteRun(id: number): Promise<PayrollRun | null> {
  const db = getDb();
  const [row] = await db.delete(payrollRuns).where(eq(payrollRuns.id, id)).returning();
  return row ?? null;
}

export async function setRunStatus(
  id: number,
  status: 'draft' | 'generated' | 'sent',
  stamp?: { generatedAt?: Date; sentAt?: Date }
): Promise<void> {
  const db = getDb();
  await db
    .update(payrollRuns)
    .set({ status, ...stamp })
    .where(eq(payrollRuns.id, id));
}

/* ---------------- lines ---------------- */

export type LineInput = Omit<
  PayrollLine,
  | 'id'
  | 'runId'
  | 'salaryPerDay'
  | 'earnedSalary'
  | 'otAmount'
  | 'totalEarnings'
  | 'balanceAdvance'
  | 'netPaid'
  | 'pdfUrl'
  | 'deliveryStatus'
  | 'deliveryError'
  | 'deliveredAt'
>;

/** Replace a run's lines wholesale, recomputing every derived figure. */
export async function replaceLines(
  runId: number,
  daysInPeriod: number,
  inputs: LineInput[]
): Promise<void> {
  const db = getDb();
  await db.delete(payrollLines).where(eq(payrollLines.runId, runId));
  if (inputs.length === 0) return;

  const values = inputs.map((input, i) => ({
    ...input,
    runId,
    sortOrder: input.sortOrder ?? i,
    ...calculatePay(input, daysInPeriod),
  }));

  await db.insert(payrollLines).values(values);
}

export async function setLinePdf(lineId: number, pdfUrl: string): Promise<void> {
  const db = getDb();
  await db.update(payrollLines).set({ pdfUrl }).where(eq(payrollLines.id, lineId));
}

export async function setLineDelivery(
  lineId: number,
  status: 'pending' | 'sent' | 'failed' | 'skipped',
  error?: string | null
): Promise<void> {
  const db = getDb();
  await db
    .update(payrollLines)
    .set({
      deliveryStatus: status,
      deliveryError: error ?? null,
      deliveredAt: status === 'sent' ? new Date() : null,
    })
    .where(eq(payrollLines.id, lineId));
}

export async function getLine(
  runId: number,
  lineId: number
): Promise<PayrollLine | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(payrollLines)
    .where(and(eq(payrollLines.runId, runId), eq(payrollLines.id, lineId)));
  return row ?? null;
}
