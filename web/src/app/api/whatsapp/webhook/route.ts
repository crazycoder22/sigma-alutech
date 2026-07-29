import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { applyDeliveryCallback, type DeliveryStatus } from '@/lib/payroll/store';

export const dynamic = 'force-dynamic';

/**
 * Delivery callbacks from the WhatsApp Cloud API.
 *
 * Meta accepts a message, then reports what became of it — delivered,
 * read, or failed — minutes later. Without this endpoint "sent" only ever
 * means "Meta took it", which is not the same as an employee receiving
 * their payslip.
 *
 * This route is **public by necessity**: Meta calls it, not an admin. Its
 * only defence is the signature check below, so it must stay strict.
 * Configure at Meta → app → WhatsApp → Configuration → Webhook:
 *   callback URL  https://<host>/api/whatsapp/webhook
 *   verify token  WHATSAPP_VERIFY_TOKEN
 *   subscribe to  messages
 */

/** Meta's one-time handshake when the webhook URL is saved. */
export async function GET(req: Request) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
  // Read from req.url rather than nextUrl: the same handler is exercised
  // directly in tests with a plain Request.
  const params = new URL(req.url).searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge') ?? '';

  if (!expected) {
    return new NextResponse('WHATSAPP_VERIFY_TOKEN is not set', { status: 503 });
  }
  if (mode !== 'subscribe' || token !== expected) {
    return new NextResponse('Verification failed', { status: 403 });
  }
  // Meta expects the challenge echoed back as plain text.
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/** Constant-time compare of the X-Hub-Signature-256 header. */
function signatureValid(raw: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice('sha256='.length), 'hex');
  } catch {
    return false;
  }
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/** Meta's statuses, mapped onto ours. */
function toDeliveryStatus(status: string): DeliveryStatus | null {
  if (status === 'sent') return 'sent';
  if (status === 'delivered') return 'delivered';
  if (status === 'read') return 'read';
  if (status === 'failed') return 'failed';
  return null; // "deleted", "warning", anything new — ignored on purpose
}

interface StatusEntry {
  id?: string;
  status?: string;
  errors?: Array<{ title?: string; message?: string; error_data?: { details?: string } }>;
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET ?? '';
  const raw = await req.text();

  // No secret means no way to tell Meta from anyone else, and this route
  // writes to the payroll record. Refuse rather than trust the caller.
  if (!secret) {
    console.warn('whatsapp webhook: WHATSAPP_APP_SECRET is not set, refusing');
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  }
  if (!signatureValid(raw, req.headers.get('x-hub-signature-256'), secret)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  const entries =
    (payload as { entry?: Array<{ changes?: Array<{ value?: { statuses?: StatusEntry[] } }> }> })
      .entry ?? [];

  let applied = 0;
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const status = toDeliveryStatus(s.status ?? '');
        if (!status || !s.id) continue;
        const error =
          status === 'failed'
            ? (s.errors?.[0]?.error_data?.details ??
              s.errors?.[0]?.message ??
              s.errors?.[0]?.title ??
              'WhatsApp reported a failure')
            : null;
        if (await applyDeliveryCallback(s.id, status, error)) applied += 1;
      }
    }
  }

  // Always 200 once the signature checks out. A non-2xx makes Meta retry,
  // and a status for a message we do not know about will never succeed.
  return NextResponse.json({ applied });
}
