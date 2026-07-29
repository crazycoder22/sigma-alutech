import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';
import {
  getWhatsAppProvider,
  normalisePhone,
  whatsappConfigStatus,
} from '@/lib/payroll/whatsapp';

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
  /** A public PDF link; the template's header needs a document. */
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
    const result = await provider.send({
      to,
      employeeName: 'TEST MESSAGE',
      periodLabel: 'a test',
      netPaidLabel: '0.00',
      pdfUrl: pdfUrl ?? 'https://sigma-alutech.vercel.app/images/logo.png',
      pdfFilename: 'test.pdf',
    });

    return {
      ...result,
      provider: provider.name,
      simulated: provider.name === 'mock',
      to,
    };
  });
}
