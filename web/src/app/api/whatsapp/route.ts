import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';
import {
  getWhatsAppProvider,
  normalisePhone,
  whatsappConfigStatus,
} from '@/lib/payroll/whatsapp';
import {
  calculatePay,
  formatRupees,
  sumDeductions,
  sumEarnings,
  toPaise,
} from '@/lib/payroll/calc';
import { renderPayslip } from '@/lib/payroll/pdf';
import { saveDocument } from '@/lib/storage';
import type { PayrollLine } from '@/db';

/** Invented figures for the sample payslip. */
const SAMPLE = {
  daysWorked: 30,
  grossSalary: toPaise(30000),
  otHours: 12,
  outsidePay: 0,
  advancePending: 0,
  advanceDeducted: 0,
  attendanceBonus: 0,
  phoneDeduction: 0,
  pfContribution: toPaise(1454),
  busPass: toPaise(1200),
  annualBonus: 0,
};

/**
 * A real payslip built from invented figures, so a test send exercises the
 * whole path — render, store, fetched back out by the provider — rather
 * than pointing at a placeholder that may not still exist.
 */
async function sampleSlip(): Promise<string> {
  const line = {
    id: 0,
    runId: 0,
    employeeId: null,
    employeeName: 'TEST MESSAGE',
    phone: '',
    ...SAMPLE,
    ...calculatePay(SAMPLE, 30),
    pdfUrl: null,
    deliveryStatus: 'pending',
    deliveryError: null,
    deliveredAt: null,
    providerMessageId: null,
    sortOrder: 0,
  } as unknown as PayrollLine;

  const pdf = await renderPayslip(line, '2026-01-01');
  return saveDocument(Buffer.from(pdf), 'test', 'sample-payslip.pdf');
}

export const dynamic = 'force-dynamic';

/** What is configured, and what is still missing. Never returns a secret. */
export async function GET() {
  return withErrorHandling(async () => {
    await requireAdmin();
    return whatsappConfigStatus();
  });
}

const testSchema = z.object({
  phone: z.string().trim().min(1),
  /** Override the generated sample with a link of your own. */
  pdfUrl: z.string().url().optional(),
});

/**
 * Send one message to a number of the admin's choosing, so the connection
 * can be proved before thirty-eight people are involved.
 *
 * Note WhatsApp will only deliver to a number that has been added as a
 * recipient in the Meta app while the account is still unverified.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const { phone, pdfUrl } = testSchema.parse(await req.json());

    const to = normalisePhone(phone);
    if (!to) {
      return { ok: false, error: 'That does not look like a usable phone number.' };
    }

    const provider = getWhatsAppProvider();
    const attachment = pdfUrl ?? (await sampleSlip());

    const result = await provider.send({
      to,
      employeeName: 'TEST MESSAGE',
      periodLabel: 'January 2026',
      netPaidLabel: formatRupees(calculatePay(SAMPLE, 30).netPaid),
      pdfUrl: attachment,
      pdfFilename: 'sample-payslip.pdf',
      details: {
        daysWorked: SAMPLE.daysWorked,
        grossLabel: formatRupees(SAMPLE.grossSalary),
        earningsLabel: formatRupees(sumEarnings(SAMPLE, calculatePay(SAMPLE, 30))),
        deductionsLabel: formatRupees(sumDeductions(SAMPLE)),
      },
    });

    return {
      ...result,
      provider: provider.name,
      simulated: provider.name === 'mock',
      to,
      pdfUrl: attachment,
    };
  });
}
