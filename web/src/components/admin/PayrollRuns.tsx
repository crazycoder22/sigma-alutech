'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PayrollRun } from '@/db';
import { formatPeriod, formatRupees } from '@/lib/payroll/calc';

interface RunSummary extends PayrollRun {
  lineCount: number;
  totalNet: number;
  sentCount: number;
}

interface Props {
  runs: RunSummary[];
  activeEmployees: number;
}

/** Current month as "2026-06". */
function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  generated: 'Payslips ready',
  sent: 'Sent',
};

export function PayrollRuns({ runs, activeEmployees }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState(thisMonth());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createRun() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start that month');
        return;
      }
      router.push(`/admin/payroll/${data.run.id}`);
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  }

  async function remove(run: RunSummary) {
    if (!confirm(`Delete the ${formatPeriod(run.period)} run and its payslips?`)) return;
    const res = await fetch(`/api/payroll/${run.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Delete failed');
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">Payroll</h1>
          <div className="admin-head__meta">
            {runs.length} month{runs.length === 1 ? '' : 's'} · {activeEmployees} active
            employees
          </div>
        </div>
        <div className="admin-head__actions">
          <input
            className="grid-input"
            style={{ width: 150, textAlign: 'left', padding: '11px 14px' }}
            type="month"
            aria-label="Pay month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <button
            className="btn btn--primary btn--small"
            onClick={createRun}
            disabled={busy || !period}
            data-testid="start-run"
          >
            {busy ? 'Opening…' : 'Start month'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="admin-flash" style={{ paddingTop: 16 }}>
          <div className="form-error">{error}</div>
        </div>
      ) : null}

      <div className="admin-body">
        {runs.length === 0 ? (
          <div className="admin-empty">
            No payroll months yet. Pick a month above and press <strong>Start month</strong>,
            then upload the salary sheet.
          </div>
        ) : (
          <div className="rec-table rec-table--always">
            <div className="rec-row rec-row--head rec-row--run">
              <div>Month</div>
              <div>Employees</div>
              <div>Net payable</div>
              <div>Status</div>
              <div></div>
            </div>
            {runs.map((run) => (
              <div className="rec-row rec-row--run" key={run.id} data-testid={`run-row-${run.period}`}>
                <div>
                  <Link href={`/admin/payroll/${run.id}`} className="rec-row__name">
                    {formatPeriod(run.period)}
                  </Link>
                </div>
                <div className="rec-row__cell">{run.lineCount}</div>
                <div className="rec-row__cell">{formatRupees(run.totalNet)}</div>
                <div className="rec-row__cell">
                  {STATUS_LABEL[run.status] ?? run.status}
                  {run.sentCount > 0 ? ` · ${run.sentCount} sent` : ''}
                </div>
                <div className="rec-row__actions">
                  <Link className="btn btn--outline btn--small" href={`/admin/payroll/${run.id}`}>
                    Open
                  </Link>
                  <button className="btn btn--danger btn--small" onClick={() => remove(run)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
