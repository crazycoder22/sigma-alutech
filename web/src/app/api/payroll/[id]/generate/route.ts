import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling, notFound, parseId } from '@/lib/api-helpers';
import { getRun, setLinePdf, setRunStatus } from '@/lib/payroll/store';
import { payslipFilename, renderPayslip } from '@/lib/payroll/pdf';
import { saveDocument } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Render a payslip PDF for every line and store it. */
export async function POST(_req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Payroll run');
    const run = await getRun(id);
    if (!run) return notFound('Payroll run');
    if (run.lines.length === 0) {
      return { generated: 0, errors: ['This run has no employees.'] };
    }

    const errors: string[] = [];
    let generated = 0;

    for (const line of run.lines) {
      try {
        const pdf = await renderPayslip(line, run.period);
        const url = await saveDocument(
          Buffer.from(pdf),
          `payslips/${run.period.slice(0, 7)}`,
          payslipFilename(line.employeeName, run.period),
          'application/pdf'
        );
        await setLinePdf(line.id, url);
        generated++;
      } catch (err) {
        errors.push(
          `${line.employeeName}: ${err instanceof Error ? err.message : 'failed'}`
        );
      }
    }

    if (generated > 0) {
      await setRunStatus(id, 'generated', { generatedAt: new Date() });
    }

    return { generated, errors, run: await getRun(id) };
  });
}
