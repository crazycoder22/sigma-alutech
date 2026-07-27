import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';
import {
  createRun,
  getRunByPeriod,
  listEmployees,
  listRuns,
  replaceLines,
  type LineInput,
} from '@/lib/payroll/store';
import { daysInMonth, toPaise } from '@/lib/payroll/calc';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  /** "2026-06" or "2026-06-01" */
  period: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
});

export async function GET() {
  return withErrorHandling(async () => {
    await requireAdmin();
    return { runs: await listRuns() };
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const { period: raw } = createSchema.parse(await req.json());
    const period = raw.length === 7 ? `${raw}-01` : raw;

    const existing = await getRunByPeriod(period);
    if (existing) {
      return { run: existing, existed: true };
    }

    const days = daysInMonth(period);
    const run = await createRun(period, days);

    // Seed from the active employee list so the grid is never empty.
    const staff = (await listEmployees(false)).filter((e) => e.active);
    const lines: LineInput[] = staff.map((e, i) => ({
      employeeId: e.id,
      employeeName: e.name,
      phone: e.phone,
      daysWorked: days,
      grossSalary: e.grossSalary,
      otHours: 0,
      outsidePay: 0,
      advancePending: 0,
      advanceDeducted: 0,
      attendanceBonus: 0,
      phoneDeduction: 0,
      pfContribution: e.pfContribution,
      busPass: e.busPass,
      annualBonus: toPaise(0),
      sortOrder: i,
    }));
    await replaceLines(run.id, days, lines);

    return { run, existed: false };
  });
}
