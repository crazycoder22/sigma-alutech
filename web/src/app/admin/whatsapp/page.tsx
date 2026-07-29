import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { whatsappConfigStatus } from '@/lib/payroll/whatsapp';
import { WhatsAppSettings } from '@/components/admin/WhatsAppSettings';

export const dynamic = 'force-dynamic';

export default async function AdminWhatsAppPage() {
  const session = await getSession();
  if (!session) redirect('/admin');

  // Built from the request so the value shown is the one Meta must call,
  // whichever host the admin happens to be on.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';

  const status = whatsappConfigStatus();
  const path =
    status.provider === 'twilio' ? '/api/whatsapp/webhook/twilio' : '/api/whatsapp/webhook';

  return <WhatsAppSettings status={status} webhookUrl={`${proto}://${host}${path}`} />;
}
