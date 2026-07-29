import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling, notFound, parseId } from '@/lib/api-helpers';
import { getRun, setLineDelivery, setRunStatus } from '@/lib/payroll/store';
import { formatPeriod, formatRupees } from '@/lib/payroll/calc';
import { payslipFilename } from '@/lib/payroll/pdf';
import { getWhatsAppProvider, normalisePhone } from '@/lib/payroll/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    /** Resend only these lines; omit to send everything not yet delivered. */
    lineIds: z.array(z.number().int()).optional(),
  })
  .default({});

export async function POST(req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Payroll run');
    const run = await getRun(id);
    if (!run) return notFound('Payroll run');

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const provider = getWhatsAppProvider();

    const targets = run.lines.filter((l) =>
      body.lineIds
        ? body.lineIds.includes(l.id)
        : !['sent', 'delivered', 'read'].includes(l.deliveryStatus)
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const line of targets) {
      if (!line.pdfUrl) {
        await setLineDelivery(line.id, 'skipped', 'Payslip not generated');
        skipped++;
        continue;
      }
      if (!normalisePhone(line.phone)) {
        await setLineDelivery(line.id, 'skipped', 'No phone number on file');
        skipped++;
        continue;
      }

      const result = await provider.send({
        to: line.phone,
        employeeName: line.employeeName,
        periodLabel: formatPeriod(run.period),
        netPaidLabel: formatRupees(line.netPaid),
        pdfUrl: line.pdfUrl,
        pdfFilename: payslipFilename(line.employeeName, run.period),
      });

      if (result.ok) {
        // Keep the provider's id — the delivery webhook matches on it.
        await setLineDelivery(line.id, 'sent', null, result.providerId ?? null);
        sent++;
      } else {
        await setLineDelivery(line.id, 'failed', result.error ?? 'Send failed');
        failed++;
      }
    }

    const after = await getRun(id);
    const reached = ['sent', 'delivered', 'read'];
    const allSent =
      after !== null &&
      after.lines.length > 0 &&
      after.lines.every((l) => reached.includes(l.deliveryStatus));
    if (allSent) await setRunStatus(id, 'sent', { sentAt: new Date() });

    return {
      provider: provider.name,
      simulated: provider.name === 'mock',
      sent,
      failed,
      skipped,
      run: after,
    };
  });
}
