import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { applyDeliveryCallback, type DeliveryStatus } from '@/lib/payroll/store';

export const dynamic = 'force-dynamic';

/**
 * Delivery callbacks from Twilio.
 *
 * Same job as the Meta webhook next door, different signature scheme:
 * Twilio signs the full callback URL concatenated with every POST field
 * sorted by name, HMAC-SHA1 with the account's auth token, base64.
 *
 * Set as TWILIO_STATUS_CALLBACK so it rides along on each send, or in the
 * Twilio console against the sender.
 */

/** https://www.twilio.com/docs/usage/security#validating-requests */
function signatureValid(
  url: string,
  params: Record<string, string>,
  header: string | null,
  authToken: string
): boolean {
  if (!header) return false;
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');
  const expected = createHmac('sha1', authToken).update(payload, 'utf8').digest();
  let given: Buffer;
  try {
    given = Buffer.from(header, 'base64');
  } catch {
    return false;
  }
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/** Twilio's message statuses, mapped onto ours. */
function toDeliveryStatus(status: string): DeliveryStatus | null {
  switch (status.toLowerCase()) {
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
    case 'undelivered':
      return 'failed';
    default:
      // queued, sending, accepted — nothing has happened yet.
      return null;
  }
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  if (!authToken) {
    console.warn('twilio webhook: TWILIO_AUTH_TOKEN is not set, refusing');
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  }

  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  // Twilio signs the URL it was configured with. Behind Vercel's proxy the
  // request URL is already the public one, but honour the forwarded host
  // so a preview deployment validates too.
  const configured = process.env.TWILIO_STATUS_CALLBACK;
  const url = configured || req.url;

  if (!signatureValid(url, params, req.headers.get('x-twilio-signature'), authToken)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }

  const status = toDeliveryStatus(params.MessageStatus ?? '');
  const sid = params.MessageSid || params.SmsSid;
  if (!status || !sid) return NextResponse.json({ applied: 0 });

  const error =
    status === 'failed'
      ? (params.ErrorMessage ??
        (params.ErrorCode ? `Twilio error ${params.ErrorCode}` : 'Twilio reported a failure'))
      : null;

  const applied = (await applyDeliveryCallback(sid, status, error)) ? 1 : 0;
  return NextResponse.json({ applied });
}
