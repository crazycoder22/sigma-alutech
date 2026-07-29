import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalisePhone,
  messageText,
  smsText,
  isGsm7,
  getWhatsAppProvider,
  isLiveProvider,
  whatsappConfigStatus,
} from '@/lib/payroll/whatsapp';

const KEYS = [
  'TWILIO_SMS_FROM',
  'TWILIO_MESSAGING_SERVICE_SID',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_CONTENT_SID',
  'TWILIO_STATUS_CALLBACK',
  'WHATSAPP_PROVIDER',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TEMPLATE',
  'WHATSAPP_TEMPLATE_LANG',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('phone normalisation', () => {
  it('accepts the shapes people actually type', () => {
    expect(normalisePhone('9876543210')).toBe('919876543210');
    expect(normalisePhone('98765 43210')).toBe('919876543210');
    expect(normalisePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalisePhone('919876543210')).toBe('919876543210');
    expect(normalisePhone('0919876543210')).toBe('919876543210');
  });

  it('rejects what cannot be dialled', () => {
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone('12345')).toBeNull();
    expect(normalisePhone('not a number')).toBeNull();
  });
});

describe('message wording', () => {
  it('names the person, the month and the amount', () => {
    const text = messageText({
      to: '919876543210',
      employeeName: 'BHAVNA SINGH',
      periodLabel: 'June 2026',
      netPaidLabel: '39,929.00',
      pdfUrl: 'https://example.test/slip.pdf',
      pdfFilename: 'slip.pdf',
    });
    expect(text).toContain('BHAVNA SINGH');
    expect(text).toContain('June 2026');
    expect(text).toContain('39,929.00');
  });
});

describe('provider selection', () => {
  it('simulates unless explicitly set to meta', async () => {
    expect(getWhatsAppProvider().name).toBe('mock');
    expect(isLiveProvider()).toBe(false);

    process.env.WHATSAPP_PROVIDER = 'MOCK';
    expect(getWhatsAppProvider().name).toBe('mock');
  });

  it('is not live on meta alone — credentials have to be there too', () => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    expect(getWhatsAppProvider().name).toBe('meta');
    expect(isLiveProvider()).toBe(false);

    process.env.WHATSAPP_TOKEN = 'token';
    expect(isLiveProvider()).toBe(false); // still no phone number id

    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    expect(isLiveProvider()).toBe(true);
  });

  it('the mock refuses the same rows a real send would', async () => {
    const p = getWhatsAppProvider();
    const base = {
      employeeName: 'X',
      periodLabel: 'June 2026',
      netPaidLabel: '1.00',
      pdfFilename: 'a.pdf',
    };
    expect(
      (await p.send({ ...base, to: '', pdfUrl: 'https://e.test/a.pdf' })).ok
    ).toBe(false);
    expect((await p.send({ ...base, to: '9876543210', pdfUrl: '' })).ok).toBe(false);
    expect(
      (await p.send({ ...base, to: '9876543210', pdfUrl: 'https://e.test/a.pdf' })).ok
    ).toBe(true);
  });
});

describe('configuration status', () => {
  it('lists what is missing without leaking a secret', () => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    process.env.WHATSAPP_TOKEN = 'super-secret-token';

    const status = whatsappConfigStatus();
    expect(status.live).toBe(false);
    expect(status.missing).toContain('WHATSAPP_PHONE_NUMBER_ID');

    const token = status.settings.find((s) => s.key === 'WHATSAPP_TOKEN')!;
    expect(token.set).toBe(true);
    expect(token.secret).toBe(true);
    expect(token.value).toBeUndefined();
    expect(JSON.stringify(status)).not.toContain('super-secret-token');
  });

  it('shows defaults for the settings that have them', () => {
    const status = whatsappConfigStatus();
    const template = status.settings.find((s) => s.key === 'WHATSAPP_TEMPLATE')!;
    expect(template.value).toBe('payslip_notification');
    expect(template.set).toBe(false);
  });
});

describe('twilio', () => {
  it('is selected by name, and needs its own credentials', () => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
    expect(getWhatsAppProvider().name).toBe('twilio');
    expect(isLiveProvider()).toBe(false);

    process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    expect(isLiveProvider()).toBe(false); // no sender yet

    process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
    expect(isLiveProvider()).toBe(true);
  });

  it('describes twilio settings, not meta ones, when selected', () => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
    const keys = whatsappConfigStatus().settings.map((s) => s.key);
    expect(keys).toContain('TWILIO_ACCOUNT_SID');
    expect(keys).toContain('TWILIO_WHATSAPP_FROM');
    expect(keys).not.toContain('WHATSAPP_PHONE_NUMBER_ID');
  });

  it('keeps the auth token out of the response', () => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
    process.env.TWILIO_AUTH_TOKEN = 'twilio-secret-token';
    const status = whatsappConfigStatus();
    const token = status.settings.find((s) => s.key === 'TWILIO_AUTH_TOKEN')!;
    expect(token.set).toBe(true);
    expect(token.value).toBeUndefined();
    expect(JSON.stringify(status)).not.toContain('twilio-secret-token');
  });

  it('only counts the webhook ready once it can verify a callback', () => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    expect(whatsappConfigStatus().webhookReady).toBe(false);
    process.env.TWILIO_STATUS_CALLBACK = 'https://example.test/api/whatsapp/webhook/twilio';
    expect(whatsappConfigStatus().webhookReady).toBe(true);
  });
});

describe('nothing is reported missing once a provider is fully configured', () => {
  it('twilio', () => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
    const status = whatsappConfigStatus();
    expect(status.live).toBe(true);
    expect(status.missing).toEqual([]);
  });

  it('meta', () => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_TOKEN = 'secret';
    const status = whatsappConfigStatus();
    expect(status.live).toBe(true);
    expect(status.missing).toEqual([]);
  });

  it('but mock is always reported as not sending', () => {
    const status = whatsappConfigStatus();
    expect(status.live).toBe(false);
    expect(status.missing[0]).toContain('WHATSAPP_PROVIDER');
  });
});

describe('credentials pasted with stray whitespace still work', () => {
  it('trims the twilio pair, which otherwise fails as 20003', () => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = '  ACxxx\n';
    process.env.TWILIO_AUTH_TOKEN = 'secret\n';
    process.env.TWILIO_WHATSAPP_FROM = ' +14155238886 ';
    expect(isLiveProvider()).toBe(true);
  });

  it('trims the meta pair too', () => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    process.env.WHATSAPP_TOKEN = 'token\n';
    process.env.WHATSAPP_PHONE_NUMBER_ID = ' 123456 ';
    expect(isLiveProvider()).toBe(true);
  });
});

describe('credential shape checks', () => {
  const twilioSetting = (key: string) =>
    whatsappConfigStatus().settings.find((s) => s.key === key)!;

  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = 'twilio';
  });

  it('accepts a well-formed pair silently', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC' + 'a'.repeat(32);
    process.env.TWILIO_AUTH_TOKEN = 'b'.repeat(32);
    process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
    expect(twilioSetting('TWILIO_ACCOUNT_SID').malformed).toBeUndefined();
    expect(twilioSetting('TWILIO_AUTH_TOKEN').malformed).toBeUndefined();
    expect(twilioSetting('TWILIO_WHATSAPP_FROM').malformed).toBeUndefined();
  });

  it('spots the two values swapped', () => {
    process.env.TWILIO_ACCOUNT_SID = 'b'.repeat(32);
    process.env.TWILIO_AUTH_TOKEN = 'AC' + 'a'.repeat(32);
    expect(twilioSetting('TWILIO_ACCOUNT_SID').malformed).toMatch(/AC/);
    expect(twilioSetting('TWILIO_AUTH_TOKEN').malformed).toMatch(/Account SID/);
  });

  it('spots an API key used as the account sid', () => {
    process.env.TWILIO_ACCOUNT_SID = 'SK' + 'a'.repeat(32);
    expect(twilioSetting('TWILIO_ACCOUNT_SID').malformed).toMatch(/API Key/);
  });

  it('reports a truncated token by length, never by value', () => {
    process.env.TWILIO_AUTH_TOKEN = 'abc123';
    const setting = twilioSetting('TWILIO_AUTH_TOKEN');
    expect(setting.malformed).toContain('6');
    expect(setting.malformed).not.toContain('abc123');
    expect(JSON.stringify(whatsappConfigStatus())).not.toContain('abc123');
  });

  it('spots a sender missing its country code', () => {
    process.env.TWILIO_WHATSAPP_FROM = '4155238886';
    expect(twilioSetting('TWILIO_WHATSAPP_FROM').malformed).toMatch(/E\.164/);
  });
});

describe('sms', () => {
  const message = {
    to: '919876543210',
    employeeName: 'BHAVNA SINGH',
    periodLabel: 'June 2026',
    netPaidLabel: '39,929.00',
    pdfUrl: 'https://blob.example/documents/payslips/2026-06/slip-abc123.pdf',
    pdfFilename: 'slip.pdf',
    details: {
      daysWorked: 28,
      grossLabel: '39,000.00',
      earningsLabel: '44,000.00',
      deductionsLabel: '4,071.00',
    },
  };

  it('carries the figures, since it cannot carry the PDF', () => {
    const text = smsText(message);
    expect(text).toContain('BHAVNA SINGH');
    expect(text).toContain('June 2026');
    expect(text).toContain('Days worked: 28');
    expect(text).toContain('Gross: 39,000.00');
    expect(text).toContain('Earnings: 44,000.00');
    expect(text).toContain('Deductions: 4,071.00');
    expect(text).toContain('Net paid: Rs 39,929.00');
    expect(text).toContain(message.pdfUrl);
  });

  it('stays inside GSM-7, which keeps segments at 153 rather than 67', () => {
    // A rupee sign or a curly quote here would silently double the cost
    // of every payslip and halve the capacity of every segment.
    const text = smsText(message);
    expect(isGsm7(text)).toBe(true);
    expect(text).not.toContain('\u20b9');
  });

  it('is a sane number of segments', () => {
    const text = smsText(message);
    const segments = Math.ceil(text.length / 153);
    expect(segments).toBeLessThanOrEqual(3);
  });

  it('still says something useful without the detail block', () => {
    const text = smsText({ ...message, details: undefined });
    expect(text).toContain('Net paid: Rs 39,929.00');
    expect(text).not.toContain('Days worked');
  });

  it('is selected by name and accepts either kind of sender', () => {
    process.env.WHATSAPP_PROVIDER = 'sms';
    process.env.TWILIO_ACCOUNT_SID = 'AC' + 'a'.repeat(32);
    process.env.TWILIO_AUTH_TOKEN = 'b'.repeat(32);
    expect(getWhatsAppProvider().name).toBe('sms');
    expect(isLiveProvider()).toBe(false);

    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG' + 'c'.repeat(32);
    expect(isLiveProvider()).toBe(true);
    expect(whatsappConfigStatus().missing).toEqual([]);
  });

  it('describes the DLT-aware settings when selected', () => {
    process.env.WHATSAPP_PROVIDER = 'sms';
    const settings = whatsappConfigStatus().settings;
    const service = settings.find((s) => s.key === 'TWILIO_MESSAGING_SERVICE_SID')!;
    expect(service.hint).toMatch(/DLT/);
    expect(settings.map((s) => s.key)).not.toContain('TWILIO_CONTENT_SID');
  });
});

