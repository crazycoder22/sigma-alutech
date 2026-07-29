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
 *   "meta"          → WhatsApp Cloud API, direct
 *   "twilio"        → Twilio as the business solution provider
 *
 * Twilio and Meta reach the same network; Twilio brokers the relationship
 * and adds a sandbox you can send from today, before Meta has verified
 * the business. Neither removes the need for an approved template — a
 * payslip is business-initiated, and those are never free text outside a
 * 24-hour reply window.
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

/* ---------------- configuration ---------------- */

/**
 * Which settings are present. Never returns a value — the token is a
 * secret and the admin screen only needs to know whether it is there.
 */
export interface WhatsAppSetting {
  key: string;
  /** Explicitly present in the environment. */
  set: boolean;
  /** What breaks without it. */
  need: 'live' | 'webhook' | 'optional';
  secret: boolean;
  hint: string;
  /** Effective value — the default when unset. Never set for secrets. */
  value?: string;
  /** True when the value in use is the built-in default. */
  isDefault?: boolean;
}

export interface WhatsAppConfigStatus {
  provider: string;
  live: boolean;
  /** The delivery webhook rejects everything without an app secret. */
  webhookReady: boolean;
  graphVersion: string;
  settings: WhatsAppSetting[];
  /** Required to go live and not supplied. */
  missing: string[];
}

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0';

export function whatsappConfigStatus(): WhatsAppConfigStatus {
  const env = (k: string) => process.env[k] ?? '';

  const plain = (
    key: string,
    need: WhatsAppSetting['need'],
    hint: string,
    fallback?: string
  ): WhatsAppSetting => {
    const raw = env(key);
    return {
      key,
      set: Boolean(raw),
      need,
      secret: false,
      hint,
      value: raw || fallback,
      isDefault: !raw && Boolean(fallback),
    };
  };

  const secret = (
    key: string,
    need: WhatsAppSetting['need'],
    hint: string
  ): WhatsAppSetting => ({
    key,
    set: Boolean(env(key)),
    need,
    secret: true,
    hint,
  });

  const provider0 = (env('WHATSAPP_PROVIDER') || 'mock').toLowerCase();

  const metaSettings: WhatsAppSetting[] = [
    plain(
      'WHATSAPP_PHONE_NUMBER_ID',
      'live',
      'Meta app → WhatsApp → API setup → "Phone number ID" (a number, not the phone number itself).'
    ),
    secret(
      'WHATSAPP_TOKEN',
      'live',
      'A permanent System User access token with whatsapp_business_messaging. The temporary 24-hour token is only good for a first test.'
    ),
    plain(
      'WHATSAPP_TEMPLATE',
      'live',
      'Name of the approved template. A template with this exact name must exist in Meta.',
      'payslip_notification'
    ),
    plain(
      'WHATSAPP_TEMPLATE_LANG',
      'optional',
      'Language code the template was approved under, e.g. en or en_US.',
      'en'
    ),
    secret(
      'WHATSAPP_VERIFY_TOKEN',
      'webhook',
      'Any string you invent. Paste the same one into Meta → WhatsApp → Configuration → Verify token.'
    ),
    secret(
      'WHATSAPP_APP_SECRET',
      'webhook',
      'Meta app → Settings → Basic → App secret. The webhook refuses every callback without it, so delivery status never updates.'
    ),
  ];

  const twilioSettings: WhatsAppSetting[] = [
    plain(
      'TWILIO_ACCOUNT_SID',
      'live',
      'Twilio console → Account Info → Account SID (starts AC).'
    ),
    secret(
      'TWILIO_AUTH_TOKEN',
      'live',
      'Twilio console → Account Info → Auth Token. Also signs the delivery callbacks.'
    ),
    plain(
      'TWILIO_WHATSAPP_FROM',
      'live',
      'The WhatsApp sender in E.164, e.g. +14155238886. The sandbox number works for testing.'
    ),
    plain(
      'TWILIO_CONTENT_SID',
      'optional',
      'An approved Content template (starts HX). Without it Twilio sends plain text, which only WhatsApp\'s 24-hour session window allows — sandbox testing only, never a salary day.'
    ),
    plain(
      'TWILIO_MEDIA_VARIABLE',
      'optional',
      'Set only if your template takes the PDF as a content variable rather than as media, e.g. "4".'
    ),
    plain(
      'TWILIO_STATUS_CALLBACK',
      'webhook',
      'The full https URL of /api/whatsapp/webhook/twilio. Sent with every message, and the URL Twilio signs.'
    ),
  ];

  const settings: WhatsAppSetting[] = [
    plain(
      'WHATSAPP_PROVIDER',
      'live',
      'One of "mock" (simulate), "meta" (WhatsApp Cloud API) or "twilio".',
      'mock'
    ),
    ...(provider0 === 'twilio' ? twilioSettings : metaSettings),
  ];

  const provider = provider0;

  // Only the settings with no usable default block going live. The
  // provider blocks separately: it has a default, but that default
  // simulates.
  const missing = settings
    .filter((s) => s.need === 'live' && !s.set && !s.isDefault)
    .map((s) => s.key);
  if (provider !== 'meta') missing.unshift('WHATSAPP_PROVIDER (still "' + provider + '")');

  return {
    provider,
    live: isLiveProvider(),
    webhookReady:
      provider === 'twilio'
        ? Boolean(env('TWILIO_AUTH_TOKEN') && env('TWILIO_STATUS_CALLBACK'))
        : Boolean(env('WHATSAPP_APP_SECRET') && env('WHATSAPP_VERIFY_TOKEN')),
    graphVersion: GRAPH_VERSION,
    settings,
    missing,
  };
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
    if (!message.pdfUrl) {
      return { ok: false, error: 'Payslip has not been generated yet' };
    }

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

    // One retry, and only for the failures that are worth retrying —
    // rate limits and Meta being briefly unwell. A rejected template or a
    // bad number fails the same way twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.post(body);
      if (result.ok || !result.retryable) return result.send;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    }
    return { ok: false, error: 'WhatsApp did not respond after a retry' };
  }

  private async post(
    body: unknown
  ): Promise<{ ok: boolean; retryable: boolean; send: SendResult }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: { message?: string; code?: number } }).error;
        const detail = err?.message ?? `HTTP ${res.status}`;
        const retryable = res.status === 429 || res.status >= 500;
        return {
          ok: false,
          retryable,
          send: { ok: false, error: detail },
        };
      }
      const id = (data as { messages?: Array<{ id?: string }> }).messages?.[0]?.id;
      return { ok: true, retryable: false, send: { ok: true, providerId: id } };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        retryable: true,
        send: {
          ok: false,
          error: aborted ? 'WhatsApp timed out' : 'Network error reaching WhatsApp',
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ---------------- Twilio ---------------- */

/**
 * Twilio's Messages API. Two shapes:
 *
 *  - with TWILIO_CONTENT_SID, an approved Content template, variables
 *    filled positionally exactly as the Meta path does;
 *  - without it, a plain body and media — which only WhatsApp's 24-hour
 *    session window allows, i.e. the sandbox. Good for proving the wiring,
 *    not for a salary day.
 */
class TwilioProvider implements WhatsAppProvider {
  readonly name = 'twilio';

  constructor(
    private accountSid = process.env.TWILIO_ACCOUNT_SID ?? '',
    private authToken = process.env.TWILIO_AUTH_TOKEN ?? '',
    private from = process.env.TWILIO_WHATSAPP_FROM ?? '',
    private contentSid = process.env.TWILIO_CONTENT_SID ?? '',
    private mediaVariable = process.env.TWILIO_MEDIA_VARIABLE ?? ''
  ) {}

  get configured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.from);
  }

  async send(message: PayslipMessage): Promise<SendResult> {
    if (!this.configured) {
      return { ok: false, error: 'Twilio is not configured' };
    }
    const to = normalisePhone(message.to);
    if (!to) return { ok: false, error: 'No usable phone number' };
    if (!message.pdfUrl) {
      return { ok: false, error: 'Payslip has not been generated yet' };
    }

    const form = new URLSearchParams();
    form.set('From', `whatsapp:${e164(this.from)}`);
    form.set('To', `whatsapp:${e164(to)}`);

    if (this.contentSid) {
      const vars: Record<string, string> = {
        '1': message.employeeName,
        '2': message.periodLabel,
        '3': message.netPaidLabel,
      };
      // A document header can be either a content variable or ordinary
      // media, depending on how the template was built. Naming the
      // variable index switches between them.
      if (this.mediaVariable) vars[this.mediaVariable] = message.pdfUrl;
      else form.set('MediaUrl', message.pdfUrl);
      form.set('ContentSid', this.contentSid);
      form.set('ContentVariables', JSON.stringify(vars));
    } else {
      form.set('Body', messageText(message));
      form.set('MediaUrl', message.pdfUrl);
    }

    const callback = process.env.TWILIO_STATUS_CALLBACK ?? '';
    if (callback) form.set('StatusCallback', callback);

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
          signal: controller.signal,
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
        code?: number;
      };
      if (!res.ok) {
        const detail = data.message ?? `HTTP ${res.status}`;
        return { ok: false, error: data.code ? `${detail} (${data.code})` : detail };
      }
      return { ok: true, providerId: data.sid };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        error: aborted ? 'Twilio timed out' : 'Network error reaching Twilio',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Twilio wants E.164 with the plus; we store bare digits. */
function e164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : raw;
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const choice = (process.env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase();
  if (choice === 'meta') return new MetaProvider();
  if (choice === 'twilio') return new TwilioProvider();
  return new MockProvider();
}

/** True when messages actually leave the building. */
export function isLiveProvider(): boolean {
  const p = getWhatsAppProvider();
  return p.name !== 'mock' && p.configured;
}
