'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import type { PayrollLine, PayrollRun } from '@/db';
import {
  calculatePay,
  formatPeriod,
  formatRupees,
  sumEarnings,
  toRupees,
  toPaise,
} from '@/lib/payroll/calc';
import { messageText } from '@/lib/payroll/whatsapp';

interface Props {
  run: PayrollRun & { lines: PayrollLine[] };
  whatsappLive: boolean;
}

/** Editable row state — money kept in paise, shown in rupees. */
interface Row {
  id: number | null;
  employeeId: number | null;
  employeeName: string;
  phone: string;
  daysWorked: number;
  grossSalary: number;
  otHours: number;
  outsidePay: number;
  advancePending: number;
  advanceDeducted: number;
  attendanceBonus: number;
  phoneDeduction: number;
  pfContribution: number;
  busPass: number;
  annualBonus: number;
  sortOrder: number;
  pdfUrl: string | null;
  deliveryStatus: string;
  deliveryError: string | null;
  matched?: boolean;
  sheetName?: string;
}

const fromLine = (l: PayrollLine): Row => ({
  id: l.id,
  employeeId: l.employeeId,
  employeeName: l.employeeName,
  phone: l.phone,
  daysWorked: l.daysWorked,
  grossSalary: l.grossSalary,
  otHours: l.otHours,
  outsidePay: l.outsidePay,
  advancePending: l.advancePending,
  advanceDeducted: l.advanceDeducted,
  attendanceBonus: l.attendanceBonus,
  phoneDeduction: l.phoneDeduction,
  pfContribution: l.pfContribution,
  busPass: l.busPass,
  annualBonus: l.annualBonus,
  sortOrder: l.sortOrder,
  pdfUrl: l.pdfUrl,
  deliveryStatus: l.deliveryStatus,
  deliveryError: l.deliveryError,
});

/** Money cell: displays rupees, stores paise. */
function Money({
  value,
  onChange,
  testId,
}: {
  value: number;
  onChange: (paise: number) => void;
  testId?: string;
}) {
  return (
    <input
      className="grid-input"
      type="number"
      step="1"
      inputMode="decimal"
      data-testid={testId}
      value={value ? toRupees(value) : ''}
      placeholder="0"
      onChange={(e) => onChange(toPaise(e.target.value === '' ? 0 : Number(e.target.value)))}
    />
  );
}

function Num({
  value,
  onChange,
  max,
  testId,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  testId?: string;
}) {
  return (
    <input
      className="grid-input"
      type="number"
      step="1"
      min={0}
      max={max}
      data-testid={testId}
      value={value || ''}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

export function PayrollRunEditor({ run, whatsappLive }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Row[]>(run.lines.map(fromLine));
  const [days, setDays] = useState(run.daysInPeriod);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(run.lines.map(fromLine))
  );
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notices, setNotices] = useState<string[]>([]);

  const dirty = JSON.stringify(rows) !== baseline;
  const generated = rows.filter((r) => r.pdfUrl).length;
  const sent = rows.filter((r) => r.deliveryStatus === 'sent').length;

  const derived = useMemo(
    () => rows.map((r) => calculatePay(r, days)),
    [rows, days]
  );
  const totals = useMemo(
    () => ({
      gross: rows.reduce((n, r) => n + r.grossSalary, 0),
      // Sum the lines an employee actually sees, so the strip reads
      // consistently with each payslip (and always exceeds the net).
      earnings: rows.reduce((n, r, i) => n + sumEarnings(r, derived[i]), 0),
      net: derived.reduce((n, d) => n + d.netPaid, 0),
    }),
    [rows, derived]
  );

  function patch(i: number, change: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...change } : r)));
  }

  /* ---------------- upload ---------------- */
  async function upload(file: File) {
    setBusy('import');
    setError('');
    setNotices([]);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/payroll/import', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not read that workbook');
        return;
      }

      setRows(
        data.lines.map(
          (l: Row & { matched: boolean; sheetName: string }, i: number) => ({
            ...l,
            id: null,
            sortOrder: i,
            pdfUrl: null,
            deliveryStatus: 'pending',
            deliveryError: null,
          })
        )
      );
      setDays(data.daysInPeriod || days);

      const msgs: string[] = [
        `Read ${data.lines.length} rows from “${data.sheetName}”.`,
      ];
      if (data.unmatched.length) {
        msgs.push(
          `${data.unmatched.length} name(s) are not in the employee register and have no phone number: ${data.unmatched.join(', ')}.`
        );
      }
      if (data.missingPhone.length) {
        msgs.push(`No phone number on file for: ${data.missingPhone.join(', ')}.`);
      }
      msgs.push('Nothing is saved until you press Save draft.');
      setNotices(msgs);
    } catch {
      setError('Upload failed — please try again');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /* ---------------- actions ---------------- */
  async function save() {
    setBusy('save');
    setError('');
    try {
      const res = await fetch(`/api/payroll/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysInPeriod: days,
          lines: rows.map((r, i) => ({
            employeeId: r.employeeId,
            employeeName: r.employeeName,
            phone: r.phone,
            daysWorked: r.daysWorked,
            grossSalary: r.grossSalary,
            otHours: r.otHours,
            outsidePay: r.outsidePay,
            advancePending: r.advancePending,
            advanceDeducted: r.advanceDeducted,
            attendanceBonus: r.attendanceBonus,
            phoneDeduction: r.phoneDeduction,
            pfContribution: r.pfContribution,
            busPass: r.busPass,
            annualBonus: r.annualBonus,
            sortOrder: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      const fresh: Row[] = data.run.lines.map(fromLine);
      setRows(fresh);
      setBaseline(JSON.stringify(fresh));
      setSuccess('Draft saved.');
      setNotices([]);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy('');
    }
  }

  async function generate() {
    if (dirty && !confirm('Save the draft first? Unsaved edits will be ignored.')) return;
    setBusy('generate');
    setError('');
    try {
      const res = await fetch(`/api/payroll/${run.id}/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Generation failed');
        return;
      }
      if (data.run) {
        const fresh: Row[] = data.run.lines.map(fromLine);
        setRows(fresh);
        setBaseline(JSON.stringify(fresh));
      }
      setSuccess(`Generated ${data.generated} payslip(s).`);
      if (data.errors?.length) setError(data.errors.join(' · '));
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy('');
    }
  }

  async function send() {
    const pending = rows.filter((r) => r.deliveryStatus !== 'sent').length;
    const warning = whatsappLive
      ? `Send ${pending} payslip(s) over WhatsApp now? Employees will receive them immediately.`
      : `WhatsApp is not connected yet, so this is a simulation — no message will actually leave. Continue with ${pending} payslip(s)?`;
    if (!confirm(warning)) return;

    setBusy('send');
    setError('');
    try {
      const res = await fetch(`/api/payroll/${run.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Send failed');
        return;
      }
      if (data.run) setRows(data.run.lines.map(fromLine));
      setSuccess(
        `${data.simulated ? 'Simulated: ' : ''}${data.sent} sent, ${data.failed} failed, ${data.skipped} skipped.`
      );
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy('');
    }
  }

  const statusChip = (r: Row) => {
    if (r.deliveryStatus === 'sent') return <span className="chip-ok">Sent</span>;
    if (r.deliveryStatus === 'failed')
      return <span className="chip-bad" title={r.deliveryError ?? ''}>Failed</span>;
    if (r.deliveryStatus === 'skipped')
      return <span className="chip-warn" title={r.deliveryError ?? ''}>Skipped</span>;
    return <span className="chip-idle">{r.pdfUrl ? 'Ready' : '—'}</span>;
  };

  return (
    <>
      <div className="editor__head">
        <div>
          <div className="editor__label">Payroll</div>
          <div className="editor__title">{formatPeriod(run.period)}</div>
        </div>
        <div className="editor__head-actions">
          <span className={dirty ? 'editor__dirty' : 'editor__saved'} data-testid="dirty-state">
            {dirty ? '● Unsaved changes' : 'Saved'}
          </span>
          <button
            className="btn btn--outline btn--small"
            onClick={() => fileRef.current?.click()}
            disabled={Boolean(busy)}
          >
            {busy === 'import' ? 'Reading…' : 'Upload sheet'}
          </button>
          <button
            className="btn btn--outline btn--small"
            onClick={save}
            disabled={Boolean(busy) || !dirty}
            data-testid="save-draft"
          >
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            className="btn btn--outline btn--small"
            onClick={generate}
            disabled={Boolean(busy) || rows.length === 0}
            data-testid="generate-payslips"
          >
            {busy === 'generate' ? 'Generating…' : 'Generate payslips'}
          </button>
          <a
            className="btn btn--outline btn--small"
            href={`/api/payroll/${run.id}/download`}
          >
            Download all
          </a>
          <button
            className="btn btn--primary btn--small"
            onClick={send}
            disabled={Boolean(busy) || generated === 0}
            data-testid="send-payslips"
          >
            {busy === 'send' ? 'Sending…' : 'Send on WhatsApp'}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />

      <div className="admin-flash" style={{ paddingTop: 16 }}>
        {!whatsappLive ? (
          <div className="notice">
            <div>
              <strong>WhatsApp is not connected.</strong> Sending is simulated — nothing
              reaches employees. Connect the WhatsApp Business API to go live.
            </div>
            <div className="notice__sample">
              Each person would receive their payslip PDF with:{' '}
              <em>
                {messageText({
                  to: '',
                  employeeName: rows[0]?.employeeName ?? 'Name',
                  periodLabel: formatPeriod(run.period),
                  netPaidLabel: formatRupees(derived[0]?.netPaid ?? 0),
                  pdfUrl: '',
                  pdfFilename: '',
                })}
              </em>
            </div>
          </div>
        ) : null}
        {error ? <div className="form-error">{error}</div> : null}
        {success ? <div className="form-success">{success}</div> : null}
        {notices.length ? (
          <div className="notice" data-testid="import-notice">
            {notices.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="admin-body">
        <div className="run-summary">
          <div className="run-summary__item">
            <span className="run-summary__label">Employees</span>
            <span className="run-summary__value">{rows.length}</span>
          </div>
          <div className="run-summary__item">
            <span className="run-summary__label">Days in month</span>
            <input
              className="grid-input"
              style={{ width: 70, textAlign: 'left' }}
              type="number"
              min={28}
              max={31}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
            />
          </div>
          <div className="run-summary__item">
            <span className="run-summary__label">Total earnings</span>
            <span className="run-summary__value">{formatRupees(totals.earnings)}</span>
          </div>
          <div className="run-summary__item run-summary__item--net">
            <span className="run-summary__label">Net payable</span>
            <span className="run-summary__value" data-testid="total-net">
              {formatRupees(totals.net)}
            </span>
          </div>
          <div className="run-summary__item">
            <span className="run-summary__label">Payslips</span>
            <span className="run-summary__value">
              {generated}/{rows.length} · {sent} sent
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="admin-empty">
            No employees in this run. Upload the salary sheet, or add people on the
            Employees page first.
          </div>
        ) : (
          <div className="grid-scroll">
            <table className="pay-grid">
              <thead>
                <tr>
                  <th className="pay-grid__name">Name</th>
                  <th>Days</th>
                  <th>Gross</th>
                  <th>OT hrs</th>
                  <th>Outside</th>
                  <th>Att. bonus</th>
                  <th>Bus pass</th>
                  <th>Adv. ded.</th>
                  <th>PF</th>
                  <th>Phone ded.</th>
                  <th className="pay-grid__net">Net paid</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? `new-${i}`} data-testid={`pay-row-${i}`}>
                    <td className="pay-grid__name">
                      <div className="pay-grid__person">{r.employeeName}</div>
                      <div className="pay-grid__phone">
                        {r.phone || <span style={{ color: 'var(--danger)' }}>no phone</span>}
                      </div>
                    </td>
                    <td>
                      <Num
                        value={r.daysWorked}
                        max={31}
                        onChange={(v) => patch(i, { daysWorked: v })}
                        testId={`days-${i}`}
                      />
                    </td>
                    <td>
                      <Money
                        value={r.grossSalary}
                        onChange={(v) => patch(i, { grossSalary: v })}
                        testId={`gross-${i}`}
                      />
                    </td>
                    <td>
                      <Num value={r.otHours} onChange={(v) => patch(i, { otHours: v })} />
                    </td>
                    <td>
                      <Money value={r.outsidePay} onChange={(v) => patch(i, { outsidePay: v })} />
                    </td>
                    <td>
                      <Money
                        value={r.attendanceBonus}
                        onChange={(v) => patch(i, { attendanceBonus: v })}
                      />
                    </td>
                    <td>
                      <Money value={r.busPass} onChange={(v) => patch(i, { busPass: v })} />
                    </td>
                    <td>
                      <Money
                        value={r.advanceDeducted}
                        onChange={(v) => patch(i, { advanceDeducted: v })}
                      />
                    </td>
                    <td>
                      <Money
                        value={r.pfContribution}
                        onChange={(v) => patch(i, { pfContribution: v })}
                      />
                    </td>
                    <td>
                      <Money
                        value={r.phoneDeduction}
                        onChange={(v) => patch(i, { phoneDeduction: v })}
                      />
                    </td>
                    <td className="pay-grid__net" data-testid={`net-${i}`}>
                      {formatRupees(derived[i].netPaid)}
                    </td>
                    <td>
                      {r.pdfUrl ? (
                        <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
                          {statusChip(r)}
                        </a>
                      ) : (
                        statusChip(r)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
