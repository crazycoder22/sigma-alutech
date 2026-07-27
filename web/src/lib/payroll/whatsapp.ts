/**
 * WhatsApp delivery.
 *
 * Sending payslips to employees requires the WhatsApp Business API — a
 * personal number cannot be automated. Until that account exists the
 * `mock` provider lets the whole flow be exercised end to end without
 * contacting anyone.
 *
 * Selected with WHATSAPP_PROVIDER:
 *   unset / "mock"  → simulates the send, reaches nobody
 *   "meta"          → WhatsApp Cloud API (needs token + phone number id +
 *                     an approved template)
 */

export interface PayslipMessage {
  /** Digits only, country code first: 919876543210 */
  to: string;
  employeeName: string;
  periodLabel: string;
  netPaidLabel: string;
  pdfUrl: string;
  pdfFilename: string;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  /** False when configuration is missing; the UI warns instead of failing. */
  readonly configured: boolean;
  send(message: PayslipMessage): Promise<SendResult>;
}

/** Indian mobile numbers, normalised to country-code-first digits. */
export function normalisePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function messageText(m: PayslipMessage): string {
  return (
    `Hello ${m.employeeName}, your salary statement for ${m.periodLabel} is attached. ` +
    `Net paid: Rs ${m.netPaidLabel}. ` +
    `Please contact the office if anything looks incorrect.`
  );
}

/* ---------------- mock ---------------- */

/**
 * Stands in until the WhatsApp Business API account exists. It performs
 * the same validation a real send would, so skipped/failed rows surface
 * for the same reasons, but contacts nobody.
 *
 * Deliberately keeps no in-memory log: the durable record is the
 * per-line delivery status in Postgres, and the message wording is
 * reproducible from the line via `messageText`.
 */
class MockProvider implements WhatsAppProvider {
  readonly name = 'mock';
  readonly configured = true;

  async send(message: PayslipMessage): Promise<SendResult> {
    if (!normalisePhone(message.to)) {
      return { ok: false, error: 'No usable phone number' };
    }
    if (!message.pdfUrl) {
      return { ok: false, error: 'Payslip has not been generated yet' };
    }
    return { ok: true, providerId: `simulated-${Date.now()}` };
  }
}

/* ---------------- Meta WhatsApp Cloud API ---------------- */

class MetaProvider implements WhatsAppProvider {
  readonly name = 'meta';

  constructor(
    private token = process.env.WHATSAPP_TOKEN ?? '',
    private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    private template = process.env.WHATSAPP_TEMPLATE ?? 'payslip_notification',
    private lang = process.env.WHATSAPP_TEMPLATE_LANG ?? 'en'
  ) {}

  get configured(): boolean {
    return Boolean(this.token && this.phoneNumberId);
  }

  async send(message: PayslipMessage): Promise<SendResult> {
    if (!this.configured) {
      return { ok: false, error: 'WhatsApp is not configured' };
    }
    const to = normalisePhone(message.to);
    if (!to) return { ok: false, error: 'No usable phone number' };

    // A document template: header carries the PDF, body the salary line.
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: this.template,
        language: { code: this.lang },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: { link: message.pdfUrl, filename: message.pdfFilename },
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: message.employeeName },
              { type: 'text', text: message.periodLabel },
              { type: 'text', text: message.netPaidLabel },
            ],
          },
        ],
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          (data as { error?: { message?: string } }).error?.message ??
          `HTTP ${res.status}`;
        return { ok: false, error: detail };
      }
      const id = (data as { messages?: Array<{ id?: string }> }).messages?.[0]?.id;
      return { ok: true, providerId: id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const choice = (process.env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase();
  return choice === 'meta' ? new MetaProvider() : new MockProvider();
}

/** True when messages actually leave the building. */
export function isLiveProvider(): boolean {
  const p = getWhatsAppProvider();
  return p.name !== 'mock' && p.configured;
}
