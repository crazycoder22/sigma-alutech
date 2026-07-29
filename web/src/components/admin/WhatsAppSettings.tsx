'use client';

import { useState } from 'react';
import type { WhatsAppConfigStatus } from '@/lib/payroll/whatsapp';

interface Props {
  status: WhatsAppConfigStatus;
  /** Where Meta should call back, derived from the request host. */
  webhookUrl: string;
}

interface TestResult {
  ok?: boolean;
  error?: string;
  provider?: string;
  simulated?: boolean;
  to?: string;
  providerId?: string;
}

export function WhatsAppSettings({ status, webhookUrl }: Props) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: 'Network error — please try again' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">WhatsApp</h1>
          <div className="admin-head__meta">
            {status.live
              ? 'Connected — payslips are delivered for real.'
              : 'Not connected — sending is simulated and reaches nobody.'}
          </div>
        </div>
      </div>

      <div className="admin-body">
        {status.live ? null : (
          <div className="notice" data-testid="wa-not-live">
            <div>
              <strong>Sending is simulated.</strong> Every send is validated and
              recorded against the payslip line, but no message leaves. Fill in the
              settings below in Vercel → Settings → Environment Variables, then
              redeploy — running deployments keep the values they were built with.
            </div>
            {status.missing.length ? (
              <div className="notice__sample">
                Still needed before anything can be sent:{' '}
                <em>{status.missing.join(', ')}</em>
              </div>
            ) : null}
          </div>
        )}

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head">
            <span className="panel__title">Configuration</span>
          </div>
          <div className="rec-table rec-table--always">
            <div className="rec-row rec-row--head rec-row--wa">
              <div>Setting</div>
              <div>Value</div>
              <div>Status</div>
            </div>
            {status.settings.map((s) => (
              <div className="rec-row rec-row--wa" key={s.key} data-testid={`wa-${s.key}`}>
                <div>
                  <div className="rec-row__name">{s.key}</div>
                  <div className="rec__slug">{s.hint}</div>
                </div>
                <div className="rec-row__cell">
                  {s.secret ? (
                    <span className="wa-secret">{s.set ? 'set · hidden' : '—'}</span>
                  ) : (
                    <span className={s.isDefault ? 'wa-secret' : 'wa-value'}>
                      {s.value || '—'}
                    </span>
                  )}
                </div>
                <div className="rec-row__cell">
                  {s.set ? (
                    <span className="chip-ok">Set</span>
                  ) : s.isDefault ? (
                    <span className="chip-idle">Default</span>
                  ) : s.need === 'live' ? (
                    <span className="chip-bad">Needed to send</span>
                  ) : s.need === 'webhook' ? (
                    <span className="chip-warn">Needed for status</span>
                  ) : (
                    <span className="chip-idle">Optional</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head">
            <span className="panel__title">Webhook</span>
          </div>
          {status.webhookReady ? null : (
            <p className="panel__note" data-testid="wa-webhook-warn">
              <strong>Not ready.</strong> Callbacks are refused until the signing
              secret is set, so a payslip never moves past &ldquo;Sent&rdquo;.
            </p>
          )}
          <p className="panel__note">
            {status.provider === 'twilio'
              ? 'Twilio reports what became of each message here — delivered, read or failed. Put this URL in TWILIO_STATUS_CALLBACK; it rides along on every send and is the URL Twilio signs.'
              : 'Meta reports what became of each message here — delivered, read or failed. Paste it into Meta → your app → WhatsApp → Configuration, subscribe to messages, and use your WHATSAPP_VERIFY_TOKEN as the verify token.'}{' '}
            Without it a payslip only ever reads as “Sent”, which means the
            provider accepted it, not that anyone received it.
          </p>
          <code className="wa-url" data-testid="wa-webhook">
            {webhookUrl}
          </code>
        </div>

        <form className="panel" onSubmit={sendTest} data-testid="wa-test">
          <div className="panel__head">
            <span className="panel__title">Send a test message</span>
          </div>
          <p className="panel__note">
            Proves the connection before thirty-eight people are involved. While the
            business account is unverified, WhatsApp only delivers to numbers added
            as recipients in the Meta app.
          </p>
          <div className="field" style={{ maxWidth: 320 }}>
            <label className="field__label" htmlFor="wa-phone">
              <span>Phone number</span>
            </label>
            <input
              id="wa-phone"
              type="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-md" style={{ marginTop: 14 }}>
            <button className="btn btn--primary btn--small" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send test'}
            </button>
          </div>

          {result ? (
            <div
              className={result.ok ? 'form-success' : 'form-error'}
              style={{ marginTop: 14 }}
              data-testid="wa-test-result"
            >
              {result.ok
                ? `${result.simulated ? 'Simulated: nothing left the building. ' : 'Sent. '}` +
                  `${result.to ?? ''}${result.providerId ? ` · ${result.providerId}` : ''}`
                : (result.error ?? 'Send failed')}
            </div>
          ) : null}
        </form>
      </div>
    </>
  );
}
