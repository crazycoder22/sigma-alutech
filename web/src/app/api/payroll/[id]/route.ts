import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling, notFound, parseId } from '@/lib/api-helpers';
import { deleteRun, getRun, replaceLines, setRunStatus } from '@/lib/payroll/store';

type Params = { params: Promise<{ id: string }> };

const lineSchema = z.object({
  employeeId: z.number().int().nullable().default(null),
  employeeName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).default(''),
  daysWorked: z.number().min(0).max(31),
  grossSalary: z.number().int().min(0),
  otHours: z.number().min(0).max(400),
  outsidePay: z.number().int().min(0),
  advancePending: z.number().int().min(0),
  advanceDeducted: z.number().int().min(0),
  attendanceBonus: z.number().int().min(0),
  phoneDeduction: z.number().int().min(0),
  pfContribution: z.number().int().min(0),
  busPass: z.number().int().min(0),
  annualBonus: z.number().int().min(0),
  sortOrder: z.number().int().default(0),
});

const saveSchema = z.object({
  daysInPeriod: z.number().int().min(28).max(31),
  lines: z.array(lineSchema).max(500),
});

export async function GET(_req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Payroll run');
    const run = await getRun(id);
    if (!run) return notFound('Payroll run');
    return { run };
  });
}

/** Save the edited grid. Editing invalidates any generated payslips. */
export async function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Payroll run');
    const run = await getRun(id);
    if (!run) return notFound('Payroll run');

    const { daysInPeriod, lines } = saveSchema.parse(await req.json());
    await replaceLines(id, daysInPeriod, lines);
    await setRunStatus(id, 'draft', { generatedAt: undefined });

    const updated = await getRun(id);
    return { run: updated };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Payroll run');
    const run = await deleteRun(id);
    if (!run) return notFound('Payroll run');
    return { ok: true };
  });
}
