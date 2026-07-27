'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useMemo, useRef, useState } from 'react';
import type { PayrollLine, PayrollRun } from '@/db';
import { SITE } from '@/lib/site';
import {
  calculatePay,
  HOURS_PER_DAY,
  deductionsBreakdown,
  earningsBreakdown,
  formatPeriod,
  formatRupees,
  sumDeductions,
  sumEarnings,
  toRupees,
  toPaise,
  type PayDerived,
} from '@/lib/payroll/calc';
import { messageText } from '@/lib/payroll/whatsapp';

interface Props {
  run: PayrollRun & { lines: PayrollLine[] };
  /** Net paid per name last month, for the moved-sharply marker. */
  previousNet: Record<string, number>;
  whatsappLive: boolean;
}

/** A line is worth a second look once its pay moves this far. */
const SWING = 0.2;

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

/** Which mobile screen is open on top of the pay run. */
type Sheet = { kind: 'edit' | 'slip'; index: number } | null;

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

const firstName = (name: string) => {
  const word = name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] ?? name;
  return word.charAt(0) + word.slice(1).toLowerCase();
};

/** Money cell: displays rupees, stores paise. */
function Money({
  value,
  onChange,
  testId,
  className = 'grid-input',
}: {
  value: number;
  onChange: (paise: number) => void;
  testId?: string;
  className?: string;
}) {
  return (
    <input
      className={className}
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
  className = 'grid-input',
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  testId?: string;
  className?: string;
}) {
  return (
    <input
      className={className}
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

/** One labelled input in the mobile editor. */
function PayField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="pay-field">
      <span className="pay-field__label">{label}</span>
      {children}
    </label>
  );
}

export function PayrollRunEditor({ run, previousNet, whatsappLive }: Props) {
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
  const [sheet, setSheet] = useState<Sheet>(null);
  // Several rows can stay open at once, for comparing people side by side.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  function toggleRow(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }

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

  /** Label for the month the comparison is against. */
  const previousLabel = useMemo(() => {
    const [y, m] = run.period.slice(0, 7).split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 2, 1));
    return formatPeriod(
      `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`
    );
  }, [run.period]);

  /** Rows whose pay has moved sharply since last month, as a signed %. */
  const swings = useMemo(
    () =>
      rows.map((r, i) => {
        const before = previousNet[r.employeeName];
        if (!before) return '';
        const change = (derived[i].netPaid - before) / before;
        if (Math.abs(change) < SWING) return '';
        return `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`;
      }),
    [rows, derived, previousNet]
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

  /** Persist the grid. Returns the saved rows, or null when it failed. */
  async function save(): Promise<Row[] | null> {
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
        return null;
      }
      const fresh: Row[] = data.run.lines.map(fromLine);
      setRows(fresh);
      setBaseline(JSON.stringify(fresh));
      setSuccess('Draft saved.');
      setNotices([]);
      router.refresh();
      return fresh;
    } catch {
      setError('Network error — please try again');
      return null;
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

  /** Send everyone still outstanding, or just the given lines. */
  async function send(lineIds?: number[]) {
    const count = lineIds
      ? lineIds.length
      : rows.filter((r) => r.deliveryStatus !== 'sent').length;
    const warning = whatsappLive
      ? `Send ${count} payslip(s) over WhatsApp now? Employees will receive them immediately.`
      : `WhatsApp is not connected yet, so this is a simulation — no message will actually leave. Continue with ${count} payslip(s)?`;
    if (!confirm(warning)) return;

    setBusy('send');
    setError('');
    try {
      const res = await fetch(`/api/payroll/${run.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lineIds ? { lineIds } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Send failed');
        return;
      }
      if (data.run) {
        const fresh: Row[] = data.run.lines.map(fromLine);
        setRows(fresh);
        setBaseline(JSON.stringify(fresh));
      }
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

  /** Mobile: save the whole draft, then send this one person. */
  async function saveAndSend(index: number) {
    const fresh = dirty ? await save() : rows;
    if (!fresh) return;
    const id = fresh[index]?.id;
    if (!id) {
      setError('Save the draft before sending.');
      return;
    }
    if (!fresh[index].pdfUrl) {
      setError('Generate the payslips first — there is nothing to attach yet.');
      return;
    }
    setSheet(null);
    await send([id]);
  }

  const statusLabel = (r: Row) => {
    if (r.deliveryStatus === 'sent') return 'Sent';
    if (r.deliveryStatus === 'failed') return 'Failed';
    if (r.deliveryStatus === 'skipped') return 'Skipped';
    return r.pdfUrl ? 'Ready' : 'Not sent';
  };

  const statusChip = (r: Row) => {
    if (r.deliveryStatus === 'sent') return <span className="chip-ok">Sent</span>;
    if (r.deliveryStatus === 'failed')
      return <span className="chip-bad" title={r.deliveryError ?? ''}>Failed</span>;
    if (r.deliveryStatus === 'skipped')
      return <span className="chip-warn" title={r.deliveryError ?? ''}>Skipped</span>;
    return <span className="chip-idle">{r.pdfUrl ? 'Ready' : '—'}</span>;
  };

  /* ---------------- the computed breakdown ----------------
     Everything the sheet works out from the row above, plus the two
     inputs the grid has no column for. */
  function detailPanel(index: number) {
    const r = rows[index];
    const d = derived[index];
    return (
      <div className="pay-detail" data-testid={`detail-${index}`}>
        <span className="pay-detail__figure">
          <span className="pay-detail__label">Sal / day</span>
          <span className="pay-detail__value" data-testid={`perday-${index}`}>
            {formatRupees(d.salaryPerDay)}
          </span>
        </span>
        <span className="pay-detail__figure">
          <span className="pay-detail__label">Earned salary</span>
          <span className="pay-detail__value" data-testid={`earned-${index}`}>
            {formatRupees(d.earnedSalary)}
          </span>
        </span>
        <span className="pay-detail__figure">
          <span className="pay-detail__label">
            OT amount · {r.otHours} hrs ÷ {HOURS_PER_DAY}
          </span>
          <span className="pay-detail__value" data-testid={`otamt-${index}`}>
            {formatRupees(d.otAmount)}
          </span>
        </span>
        <span className="pay-detail__figure">
          <span className="pay-detail__label">Total earnings</span>
          <span
            className="pay-detail__value pay-detail__value--strong"
            data-testid={`earnings-${index}`}
          >
            {formatRupees(sumEarnings(r, d))}
          </span>
        </span>
        <span className="pay-detail__figure">
          <span className="pay-detail__label">Advance balance</span>
          <span className="pay-detail__value" data-testid={`advbal-${index}`}>
            {formatRupees(d.balanceAdvance)}
          </span>
        </span>

        <label className="pay-detail__figure pay-detail__figure--input">
          <span className="pay-detail__label">Adv. pending</span>
          <Money
            value={r.advancePending}
            onChange={(v) => patch(index, { advancePending: v })}
            testId={`advpending-${index}`}
          />
        </label>
        <label className="pay-detail__figure pay-detail__figure--input">
          <span className="pay-detail__label">Annual bonus</span>
          <Money
            value={r.annualBonus}
            onChange={(v) => patch(index, { annualBonus: v })}
          />
        </label>

        {swings[index] ? (
          <span className="pay-detail__swing">
            {swings[index]} against {previousLabel} — worth checking.
          </span>
        ) : null}
      </div>
    );
  }

  /* ---------------- mobile: one person's pay ----------------
     Plain render helpers, not components: they close over the editor's
     state, and a nested component would remount on every keystroke. */
  function editSheet(index: number) {
    const r = rows[index];
    const d = derived[index];
    return (
      <div className="pay-sheet" data-testid="pay-sheet-edit">
        <div className="pay-sheet__head">
          <button
            className="pay-sheet__back"
            onClick={() => setSheet(null)}
            aria-label="Back to the pay run"
          >
            ←
          </button>
          <span className="pay-sheet__id">
            <span className="pay-sheet__name">{r.employeeName}</span>
            <span className="pay-sheet__sub">
              {formatPeriod(run.period)} · {r.phone || 'no phone number'}
            </span>
          </span>
        </div>

        <div className="pay-sheet__net">
          <span className="pay-sheet__net-label">Net paid</span>
          <span className="pay-sheet__net-value" data-testid="sheet-net">
            Rs {formatRupees(d.netPaid)}
          </span>
        </div>

        <div className="pay-sheet__body">
          <div className="pay-group">
            <div className="pay-group__label">Attendance</div>
            <div className="pay-group__row">
              <PayField label="Days worked">
                <Num
                  className="pay-input"
                  value={r.daysWorked}
                  max={31}
                  onChange={(v) => patch(index, { daysWorked: v })}
                  testId="sheet-days"
                />
              </PayField>
              <PayField label="Overtime hrs">
                <Num
                  className="pay-input"
                  value={r.otHours}
                  onChange={(v) => patch(index, { otHours: v })}
                />
              </PayField>
            </div>
          </div>

          <div className="pay-group">
            <div className="pay-group__label">Earnings</div>
            <PayField label="Monthly gross">
              <Money
                className="pay-input"
                value={r.grossSalary}
                onChange={(v) => patch(index, { grossSalary: v })}
              />
            </PayField>
            <div className="pay-group__row">
              <PayField label="Outside pay">
                <Money
                  className="pay-input"
                  value={r.outsidePay}
                  onChange={(v) => patch(index, { outsidePay: v })}
                />
              </PayField>
              <PayField label="Att. bonus">
                <Money
                  className="pay-input"
                  value={r.attendanceBonus}
                  onChange={(v) => patch(index, { attendanceBonus: v })}
                />
              </PayField>
            </div>
            <PayField label="Bus pass / conveyance">
              <Money
                className="pay-input"
                value={r.busPass}
                onChange={(v) => patch(index, { busPass: v })}
              />
            </PayField>
          </div>

          <div className="pay-group">
            <div className="pay-group__label">Deductions</div>
            <div className="pay-group__row">
              <PayField label="Advance pending">
                <Money
                  className="pay-input"
                  value={r.advancePending}
                  onChange={(v) => patch(index, { advancePending: v })}
                />
              </PayField>
              <PayField label="Advance deducted">
                <Money
                  className="pay-input"
                  value={r.advanceDeducted}
                  onChange={(v) => patch(index, { advanceDeducted: v })}
                />
              </PayField>
            </div>
            <div className="pay-group__row">
              <PayField label="PF">
                <Money
                  className="pay-input"
                  value={r.pfContribution}
                  onChange={(v) => patch(index, { pfContribution: v })}
                />
              </PayField>
            </div>
            <PayField label="Phone bill">
              <Money
                className="pay-input"
                value={r.phoneDeduction}
                onChange={(v) => patch(index, { phoneDeduction: v })}
              />
            </PayField>
            <div className="pay-balance">
              <span>Advance balance after this month</span>
              <span className="pay-balance__value">{formatRupees(d.balanceAdvance)}</span>
            </div>
          </div>

          {/* What the sheet works out from the figures above. */}
          <div className="pay-group">
            <div className="pay-group__label">Calculated</div>
            <div className="pay-calc">
              <div className="pay-calc__row">
                <span>Salary per day</span>
                <span>{formatRupees(d.salaryPerDay)}</span>
              </div>
              <div className="pay-calc__row">
                <span>Earned salary · {r.daysWorked} of {days} days</span>
                <span>{formatRupees(d.earnedSalary)}</span>
              </div>
              <div className="pay-calc__row">
                <span>
                  Overtime · {r.otHours} hrs at {HOURS_PER_DAY} hrs/day
                </span>
                <span>{formatRupees(d.otAmount)}</span>
              </div>
              <div className="pay-calc__row">
                <span>Total earnings</span>
                <span>{formatRupees(d.totalEarnings)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pay-bar">
          <button
            className="btn btn--ink btn--block"
            onClick={async () => {
              if (await save()) setSheet(null);
            }}
            disabled={Boolean(busy)}
          >
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button
            className="btn btn--outline btn--block"
            onClick={() => saveAndSend(index)}
            disabled={Boolean(busy)}
          >
            Save &amp; send
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- mobile: payslip preview ---------------- */
  function slipSheet(index: number) {
    const r = rows[index];
    const d: PayDerived = derived[index];
    const earnings = earningsBreakdown(r, d);
    const deductions = deductionsBreakdown(r);
    const showAdvance = Boolean(r.advancePending || r.advanceDeducted || d.balanceAdvance);

    return (
      <div className="pay-sheet" data-testid="pay-sheet-slip">
        <div className="pay-sheet__head">
          <button
            className="pay-sheet__back"
            onClick={() => setSheet(null)}
            aria-label="Back to the pay run"
          >
            ←
          </button>
          <span className="pay-sheet__title">Payslip</span>
          {r.pdfUrl ? (
            <a className="pay-sheet__pdf" href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
              PDF ⤓
            </a>
          ) : (
            <span className="pay-sheet__pdf pay-sheet__pdf--off">Not generated</span>
          )}
        </div>

        <div className="pay-sheet__body">
          <div className="slip">
            <div className="slip__head">
              <span className="admin-logo">
                SIGMA <span>ALUTECH</span>
              </span>
              <span className="slip__head-right">
                <span className="slip__kicker">Salary statement</span>
                <span className="slip__period">{formatPeriod(run.period)}</span>
              </span>
            </div>

            <div className="slip__body">
              <div className="slip__person">
                <span className="slip__col">
                  <span className="slip__label">Employee</span>
                  <span className="slip__name">{r.employeeName}</span>
                </span>
                <span className="slip__col slip__col--right">
                  <span className="slip__label">Days</span>
                  <span className="slip__name">{r.daysWorked}</span>
                </span>
              </div>

              <div className="slip__section">
                <div className="slip__label">Earnings</div>
                {earnings.map((row) => (
                  <div className="slip__row" key={row.label}>
                    <span>
                      {row.label}
                      {row.detail ? ` · ${row.detail}` : ''}
                    </span>
                    <span>{formatRupees(row.amount)}</span>
                  </div>
                ))}
                <div className="slip__row slip__row--total">
                  <span>Total earnings</span>
                  <span>{formatRupees(sumEarnings(r, d))}</span>
                </div>
              </div>

              <div className="slip__section">
                <div className="slip__label">Deductions</div>
                {deductions.length === 0 ? (
                  <div className="slip__row">
                    <span>None</span>
                    <span>—</span>
                  </div>
                ) : (
                  deductions.map((row) => (
                    <div className="slip__row" key={row.label}>
                      <span>{row.label}</span>
                      <span>- {formatRupees(row.amount)}</span>
                    </div>
                  ))
                )}
                <div className="slip__row slip__row--total">
                  <span>Total deductions</span>
                  <span>- {formatRupees(sumDeductions(r))}</span>
                </div>
              </div>

              <div className="slip__net">
                <span className="slip__net-label">Net salary paid</span>
                <span className="slip__net-value">Rs {formatRupees(d.netPaid)}</span>
              </div>

              {showAdvance ? (
                <div className="slip__section">
                  <div className="slip__label">Advance</div>
                  <div className="slip__row slip__row--quiet">
                    <span>Opening</span>
                    <span>{formatRupees(r.advancePending)}</span>
                  </div>
                  <div className="slip__row slip__row--quiet">
                    <span>Deducted</span>
                    <span>{formatRupees(r.advanceDeducted)}</span>
                  </div>
                  <div className="slip__row slip__row--quiet">
                    <span>Carried forward</span>
                    <span>{formatRupees(d.balanceAdvance)}</span>
                  </div>
                </div>
              ) : null}

              <div className="slip__foot">
                {SITE.name} · {SITE.address} · {SITE.phoneDisplay}
                <br />
                Computer-generated statement.
              </div>
            </div>
          </div>
        </div>

        <div className="pay-bar">
          <button
            className="btn btn--primary btn--block"
            onClick={() => saveAndSend(index)}
            disabled={Boolean(busy) || !r.pdfUrl}
          >
            Send to {firstName(r.employeeName)}
          </button>
          {r.pdfUrl ? (
            <a className="btn btn--outline pay-bar__icon" href={r.pdfUrl} download>
              ⤓
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (sheet) {
    return sheet.kind === 'edit' ? editSheet(sheet.index) : slipSheet(sheet.index);
  }

  return (
    <>
      <div className="editor__head">
        <div>
          <div className="editor__label">Payroll</div>
          <div className="editor__title">{formatPeriod(run.period)}</div>
        </div>
        <div className="editor__head-actions editor__head-actions--run">
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
            onClick={() => send()}
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
          <div className="run-summary__item run-summary__item--emp">
            <span className="run-summary__label">Employees</span>
            <span className="run-summary__value">{rows.length}</span>
          </div>
          <div className="run-summary__item run-summary__item--days">
            <span className="run-summary__label">Days in month</span>
            <input
              className="grid-input run-summary__days"
              type="number"
              min={28}
              max={31}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
            />
          </div>
          <div className="run-summary__item run-summary__item--earn">
            <span className="run-summary__label">Total earnings</span>
            <span className="run-summary__value">{formatRupees(totals.earnings)}</span>
          </div>
          <div className="run-summary__item run-summary__item--net run-summary__item--netcell">
            <span className="run-summary__label">Net payable</span>
            <span className="run-summary__value" data-testid="total-net">
              {formatRupees(totals.net)}
            </span>
          </div>
          <div className="run-summary__item run-summary__item--slips">
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
          <>
            {/* Cards — mobile */}
            <div className="pay-cards">
              {rows.map((r, i) => (
                <div className="pay-card" key={r.id ?? `new-${i}`}>
                  <div className="pay-card__top">
                    <span className="pay-card__id">
                      <span className="pay-card__name">{r.employeeName}</span>
                      <span className="pay-card__sub">
                        {r.phone || 'no phone'} · {r.daysWorked} days
                      </span>
                    </span>
                    <span className="pay-card__money">
                      <span className="pay-card__net">{formatRupees(derived[i].netPaid)}</span>
                      <span className="pay-card__status">{statusLabel(r)}</span>
                    </span>
                  </div>
                  <div className="pay-card__actions">
                    <button
                      className="btn btn--outline btn--small"
                      onClick={() => setSheet({ kind: 'edit', index: i })}
                      data-testid={`edit-pay-${i}`}
                    >
                      Edit pay
                    </button>
                    <button
                      className="btn btn--quiet btn--small"
                      onClick={() => setSheet({ kind: 'slip', index: i })}
                      data-testid={`view-slip-${i}`}
                    >
                      Payslip
                    </button>
                    {r.pdfUrl ? (
                      <a
                        className="btn btn--quiet pay-card__open"
                        href={r.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open the PDF for ${r.employeeName}`}
                      >
                        ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Every editable figure stays in the grid; each row's Details
                opens the computed breakdown underneath it. */}
            <p className="grid-legend">
              Editable inputs only. Open a row&rsquo;s <span>Details</span> to see the
              computed breakdown — sal/day, earned salary, OT amount, total earnings
              and advance balance. Overtime is priced at {HOURS_PER_DAY} hours to the day.
            </p>
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
                    <th className="pay-grid__chev" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <Fragment key={r.id ?? `new-${i}`}>
                      <tr
                        data-testid={`pay-row-${i}`}
                        className={expanded.has(i) ? 'is-open' : undefined}
                      >
                        <td className="pay-grid__name">
                          <div className="pay-grid__person">
                            {r.employeeName}
                            {swings[i] ? (
                              <span
                                className="pay-grid__swing"
                                data-testid={`swing-${i}`}
                                title={`Net paid moved ${swings[i]} from ${previousLabel}. Open Details and check the figures.`}
                              >
                                ●
                              </span>
                            ) : null}
                          </div>
                          <div className="pay-grid__phone">
                            {r.phone || (
                              <span style={{ color: 'var(--danger)' }}>no phone</span>
                            )}
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
                          <Num
                            value={r.otHours}
                            onChange={(v) => patch(i, { otHours: v })}
                            testId={`ot-${i}`}
                          />
                        </td>
                        <td>
                          <Money
                            value={r.outsidePay}
                            onChange={(v) => patch(i, { outsidePay: v })}
                          />
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
                        <td className="pay-grid__net">
                          <span className="pay-grid__netvalue" data-testid={`net-${i}`}>
                            {formatRupees(derived[i].netPaid)}
                          </span>
                          <span className="pay-grid__delivery">
                            {r.pdfUrl ? (
                              <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
                                {statusChip(r)}
                              </a>
                            ) : (
                              statusChip(r)
                            )}
                          </span>
                        </td>
                        <td className="pay-grid__chev">
                          <button
                            className="pay-grid__toggle"
                            onClick={() => toggleRow(i)}
                            aria-expanded={expanded.has(i)}
                            data-testid={`expand-${i}`}
                          >
                            Details {expanded.has(i) ? '▴' : '▾'}
                          </button>
                        </td>
                      </tr>
                      {expanded.has(i) ? (
                        <tr className="pay-detail-row">
                          <td colSpan={12}>{detailPanel(i)}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>


          </>
        )}
      </div>

      {rows.length ? (
        <div className="pay-bar pay-bar--run">
          <button
            className="btn btn--primary btn--block"
            onClick={() => send()}
            disabled={Boolean(busy) || generated === 0}
          >
            {busy === 'send' ? 'Sending…' : 'Send on WhatsApp'}
          </button>
          <a
            className="btn btn--outline pay-bar__icon"
            href={`/api/payroll/${run.id}/download`}
            aria-label="Download every payslip"
          >
            ⤓
          </a>
        </div>
      ) : null}
    </>
  );
}
