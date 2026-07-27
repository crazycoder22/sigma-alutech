import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireAdmin } from '@/lib/auth';
import { notFound, parseId } from '@/lib/api-helpers';
import { getRun } from '@/lib/payroll/store';
import { payslipFilename, renderPayslip } from '@/lib/payroll/pdf';
import { UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * Every payslip for a run as one zip. Rendered on the fly so the download
 * works whether or not the PDFs have been stored yet.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Payroll run');
    const run = await getRun(id);
    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }
    if (run.lines.length === 0) {
      return NextResponse.json({ error: 'This run has no employees' }, { status: 400 });
    }

    const zip = new JSZip();
    for (const line of run.lines) {
      const pdf = await renderPayslip(line, run.period);
      zip.file(payslipFilename(line.employeeName, run.period), pdf);
    }
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const name = `payslips-${run.period.slice(0, 7)}.zip`;

    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('payslip zip failed:', err);
    return NextResponse.json({ error: 'Could not build the download' }, { status: 500 });
  }
}
