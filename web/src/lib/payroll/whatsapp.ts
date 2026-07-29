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

/** The figures an SMS carries, since it cannot carry the PDF itself. */
export interface PayslipDetails {
  daysWorked: number;
  grossLabel: string;
  earningsLabel: string;
  deductionsLabel: string;
}

export interface PayslipMessage {
  /** Digits only, country code first: 919876543210 */
  to: string;
  employeeName: string;
  periodLabel: string;
  netPaidLabel: string;
  pdfUrl: string;
  pdfFilename: string;
  /** Present when the channel shows figures rather than attaching them. */
  details?: PayslipDetails;
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

/**
 * The SMS body. No attachment is possible, so the figures travel in the
 * text and the PDF is a link.
 *
 * Deliberately GSM-7 only: one non-GSM character (a rupee sign, a curly
 * quote, an en dash) switches the whole message to UCS-2, which halves
 * the per-segment capacity from 153 to 67 and roughly doubles the cost.
 * There is a test pinning this.
 */
export function smsText(m: PayslipMessage): string {
  const d = m.details;
  const lines = [
    `Sigma Alutech - salary for ${m.periodLabel}`,
    m.employeeName,
  ];
  if (d) {
    lines.push(`Days worked: ${d.daysWorked}`);
    lines.push(`Gross: ${d.grossLabel}`);
    lines.push(`Earnings: ${d.earningsLabel}`);
    lines.push(`Deductions: ${d.deductionsLabel}`);
  }
  lines.push(`Net paid: Rs ${m.netPaidLabel}`);
  if (m.pdfUrl) lines.push(`Payslip: ${m.pdfUrl}`);
  lines.push('Contact the office with any query.');
  return lines.join('\n');
}

/** Characters the GSM-7 alphabet can carry. */
const GSM7 =
  "@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u00c6\u00e6\u00df\u00c9 !\"#\u00a4%&'()*+,-./0123456789:;<=>?" +
  "\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0";
const GSM7_EXTENDED = '^{}\\[~]|\u20ac';

/** True when every character survives GSM-7, keeping segments at 153. */
export function isGsm7(text: string): boolean {
  return [...text].every((c) => GSM7.includes(c) || GSM7_EXTENDED.includes(c));
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
  /**
   * Set when the value is present but the wrong shape — the cheapest way
   * to tell "pasted the wrong thing" from "credentials are genuinely
   * wrong", without ever echoing a secret.
   */
  malformed?: string;
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
    fallback?: string,
    check?: (v: string) => string | undefined
  ): WhatsAppSetting => {
    const raw = env(key).trim();
    return {
      key,
      set: Boolean(raw),
      need,
      secret: false,
      hint,
      value: raw || fallback,
      isDefault: !raw && Boolean(fallback),
      malformed: raw ? check?.(raw) : undefined,
    };
  };

  const secret = (
    key: string,
    need: WhatsAppSetting['need'],
    hint: string,
    check?: (v: string) => string | undefined
  ): WhatsAppSetting => {
    const raw = env(key).trim();
    return {
      key,
      set: Boolean(raw),
      need,
      secret: true,
      hint,
      malformed: raw ? check?.(raw) : undefined,
    };
  };

  /* Shape checks. These catch the paste that went astray — the wrong
     field, a truncated copy, an API key where an auth token belongs —
     which otherwise surfaces only as Twilio's opaque 20003. */
  const isAccountSid = (v: string) =>
    /^AC[0-9a-f]{32}$/i.test(v)
      ? undefined
      : v.startsWith('SK')
        ? 'That is an API Key SID (SK…), not the Account SID. The Account SID starts AC.'
        : 'Should be "AC" followed by 32 hex characters.';

  const isAuthToken = (v: string) =>
    /^[0-9a-f]{32}$/i.test(v)
      ? undefined
      : v.startsWith('AC')
        ? 'That looks like an Account SID, not the auth token.'
        : `Should be 32 hex characters; this one is ${v.length}.`;

  const isE164 = (v: string) =>
    /^\+[1-9]\d{7,14}$/.test(v)
      ? undefined
      : 'Should be E.164 with the country code, e.g. +14155238886.';

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

  const smsSettings: WhatsAppSetting[] = [
    plain(
      'TWILIO_ACCOUNT_SID',
      'live',
      'Twilio console → Account Info → Account SID (starts AC).',
      undefined,
      isAccountSid
    ),
    secret('TWILIO_AUTH_TOKEN', 'live', 'Twilio console → Account Info → Auth Token.', isAuthToken),
    plain(
      'TWILIO_MESSAGING_SERVICE_SID',
      'live',
      'Preferred for Indian recipients: a Messaging Service carries the DLT entity and template identifiers TRAI requires. Starts MG.'
    ),
    plain(
      'TWILIO_SMS_FROM',
      'live',
      'A sending number in E.164, used only when no Messaging Service is set.',
      undefined,
      isE164
    ),
    plain(
      'TWILIO_STATUS_CALLBACK',
      'webhook',
      'Full https URL of /api/whatsapp/webhook/twilio. Delivery receipts use the same route.'
    ),
  ];

  const twilioSettings: WhatsAppSetting[] = [
    plain(
      'TWILIO_ACCOUNT_SID',
      'live',
      'Twilio console → Account Info → Account SID (starts AC).',
      undefined,
      isAccountSid
    ),
    secret(
      'TWILIO_AUTH_TOKEN',
      'live',
      'Twilio console → Account Info → Auth Token. Also signs the delivery callbacks.',
      isAuthToken
    ),
    plain(
      'TWILIO_WHATSAPP_FROM',
      'live',
      'The WhatsApp sender in E.164, e.g. +14155238886. The sandbox number works for testing.',
      undefined,
      isE164
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
      'One of "mock" (simulate), "meta" (WhatsApp Cloud API), "twilio" (WhatsApp via Twilio) or "sms" (plain text, figures in the body).',
      'mock'
    ),
    ...(provider0 === 'sms'
      ? smsSettings
      : provider0 === 'twilio'
        ? twilioSettings
        : metaSettings),
  ];

  const provider = provider0;

  // Only the settings with no usable default block going live. The
  // provider blocks separately: it has a default, but that default
  // simulates.
  const missing = settings
    .filter((s) => s.need === 'live' && !s.set && !s.isDefault)
    .map((s) => s.key);
  // SMS needs one sender, not both.
  if (provider0 === 'sms' && (env('TWILIO_MESSAGING_SERVICE_SID') || env('TWILIO_SMS_FROM'))) {
    const both = ['TWILIO_MESSAGING_SERVICE_SID', 'TWILIO_SMS_FROM'];
    for (const k of both) {
      const i = missing.indexOf(k);
      if (i !== -1) missing.splice(i, 1);
    }
  }
  // Only the simulating provider blocks going live; meta and twilio both send.
  if (!['meta', 'twilio', 'sms'].includes(provider)) {
    missing.unshift(`WHATSAPP_PROVIDER (still "${provider}")`);
  }

  return {
    provider,
    live: isLiveProvider(),
    webhookReady:
      provider === 'twilio' || provider === 'sms'
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
    private token = (process.env.WHATSAPP_TOKEN ?? '').trim(),
    private phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim(),
    private template = (process.env.WHATSAPP_TEMPLATE ?? 'payslip_notification').trim(),
    private lang = (process.env.WHATSAPP_TEMPLATE_LANG ?? 'en').trim()
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
    // Trimmed: a credential pasted into a form or piped through a shell
    // very often carries a trailing newline, and the failure it causes
    // (20003, authenticate) looks nothing like whitespace.
    private accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
    private authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim(),
    private from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim(),
    private contentSid = (process.env.TWILIO_CONTENT_SID ?? '').trim(),
    private mediaVariable = (process.env.TWILIO_MEDIA_VARIABLE ?? '').trim()
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
        return { ok: false, error: twilioError(data, res.status) };
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

/**
 * Twilio's own wording for a rejected credential is the single word
 * "Authenticate", which tells an admin nothing. Spell out what to check
 * for the failures that actually happen during setup.
 */
function twilioError(
  data: { message?: string; code?: number },
  httpStatus: number
): string {
  const detail = data.message ?? `HTTP ${httpStatus}`;
  switch (data.code) {
    case 20003:
      return 'Twilio rejected the credentials (20003). Check TWILIO_ACCOUNT_SID starts with AC and belongs to the same project as the auth token, that the token has not been rotated, and that the account is active — a suspended or expired trial fails the same way.';
    case 21211:
      return 'Twilio does not recognise that number (21211).';
    case 21606:
    case 63007:
      return `That sender is not a WhatsApp number (${data.code}). The sandbox sender is +14155238886; a number of your own has to be registered as a WhatsApp sender first.`;
    case 63016:
      return 'Outside the 24-hour window, so free text is not allowed (63016). Set TWILIO_CONTENT_SID to an approved template, or have the recipient message the sandbox again.';
    case 63018:
      return 'The recipient has not joined the sandbox (63018). Send its join phrase from their WhatsApp first.';
    case 21408:
      return 'The account is not permitted to message that country (21408). Enable the destination under Twilio → Messaging → Geo permissions.';
    default:
      return data.code ? `${detail} (${data.code})` : detail;
  }
}

/** Twilio wants E.164 with the plus; we store bare digits. */
function e164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : raw;
}

/* ---------------- SMS (Twilio) ---------------- */

/**
 * Plain SMS through the same Twilio account. No attachment, so the
 * figures are in the body and the payslip is a link.
 *
 * For Indian recipients this is subject to TRAI's DLT regime: the entity,
 * the sender header and the template all have to be registered, and
 * unregistered traffic is scrubbed by the carriers rather than bounced —
 * it simply never arrives. Twilio carries the DLT identifiers through a
 * Messaging Service, which is why TWILIO_MESSAGING_SERVICE_SID is
 * preferred over a bare From.
 */
class SmsProvider implements WhatsAppProvider {
  readonly name = 'sms';

  constructor(
    private accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
    private authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim(),
    private from = (process.env.TWILIO_SMS_FROM ?? '').trim(),
    private messagingServiceSid = (
      process.env.TWILIO_MESSAGING_SERVICE_SID ?? ''
    ).trim()
  ) {}

  get configured(): boolean {
    return Boolean(
      this.accountSid && this.authToken && (this.from || this.messagingServiceSid)
    );
  }

  async send(message: PayslipMessage): Promise<SendResult> {
    if (!this.configured) return { ok: false, error: 'SMS is not configured' };
    const to = normalisePhone(message.to);
    if (!to) return { ok: false, error: 'No usable phone number' };

    const form = new URLSearchParams();
    form.set('To', e164(to));
    // A Messaging Service carries the DLT registration; prefer it.
    if (this.messagingServiceSid) form.set('MessagingServiceSid', this.messagingServiceSid);
    else form.set('From', e164(this.from));
    form.set('Body', smsText(message));

    const callback = (process.env.TWILIO_STATUS_CALLBACK ?? '').trim();
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
      if (!res.ok) return { ok: false, error: twilioError(data, res.status) };
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

export function getWhatsAppProvider(): WhatsAppProvider {
  const choice = (process.env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase();
  if (choice === 'meta') return new MetaProvider();
  if (choice === 'twilio') return new TwilioProvider();
  if (choice === 'sms') return new SmsProvider();
  return new MockProvider();
}

/** True when messages actually leave the building. */
export function isLiveProvider(): boolean {
  const p = getWhatsAppProvider();
  return p.name !== 'mock' && p.configured;
}
