import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalisePhone,
  messageText,
  getWhatsAppProvider,
  isLiveProvider,
  whatsappConfigStatus,
} from '@/lib/payroll/whatsapp';

const KEYS = [
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

