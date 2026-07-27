'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Employee } from '@/db';
import { formatRupees, toRupees } from '@/lib/payroll/calc';
import { Field, SwitchRow } from './fields';

interface Props {
  employees: Employee[];
}

interface FormState {
  id: number | null;
  name: string;
  phone: string;
  grossSalary: string;
  pfContribution: string;
  busPass: string;
  active: boolean;
  sortOrder: number;
}

const empty = (sortOrder: number): FormState => ({
  id: null,
  name: '',
  phone: '',
  grossSalary: '',
  pfContribution: '',
  busPass: '',
  active: true,
  sortOrder,
});

const toForm = (e: Employee): FormState => ({
  id: e.id,
  name: e.name,
  phone: e.phone,
  grossSalary: String(toRupees(e.grossSalary) || ''),
  pfContribution: String(toRupees(e.pfContribution) || ''),
  busPass: String(toRupees(e.busPass) || ''),
  active: e.active,
  sortOrder: e.sortOrder,
});

const payload = (f: FormState) => ({
  name: f.name.trim(),
  phone: f.phone.trim(),
  grossSalary: Number(f.grossSalary) || 0,
  pfContribution: Number(f.pfContribution) || 0,
  busPass: Number(f.busPass) || 0,
  active: f.active,
  sortOrder: f.sortOrder,
});

/** 10 local digits, or 12 starting 91. */
function phoneLooksValid(phone: string): boolean {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 || (d.length === 12 && d.startsWith('91'));
}

export function EmployeesAdmin({ employees }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = employees.filter((e) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return e.name.toLowerCase().includes(q) || e.phone.includes(q);
  });

  const active = employees.filter((e) => e.active).length;
  const missingPhones = employees.filter((e) => e.active && !phoneLooksValid(e.phone)).length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(form.id ? `/api/employees/${form.id}` : '/api/employees', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(form)),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      setSuccess(form.id ? 'Employee updated.' : 'Employee added.');
      setForm(null);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  }

  async function remove(employee: Employee) {
    if (!confirm(`Remove ${employee.name}? Past payslips are kept.`)) return;
    const res = await fetch(`/api/employees/${employee.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Delete failed');
      return;
    }
    setSuccess(`Removed ${employee.name}.`);
    router.refresh();
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">Employees</h1>
          <div className="admin-head__meta">
            {active} active of {employees.length}
            {missingPhones > 0 ? ` · ${missingPhones} without a usable phone number` : ''}
          </div>
        </div>
        <div className="admin-head__actions">
          <div className="search">
            <span className="search__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search employees…"
              aria-label="Search employees"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="btn btn--primary btn--small head-add"
            data-testid="add-employee"
            onClick={() => {
              setError('');
              setSuccess('');
              setForm(empty(employees.length));
            }}
          >
            + Add employee
          </button>
        </div>
      </div>

      {error || success ? (
        <div className="admin-flash" style={{ paddingTop: 16 }}>
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
        </div>
      ) : null}

      <div className="admin-body">
        {form ? (
          <form className="panel" onSubmit={save} data-testid="employee-editor" style={{ marginBottom: 20 }}>
            <div className="panel__head">
              <span className="panel__title">{form.id ? 'Edit employee' : 'New employee'}</span>
            </div>
            <div className="field-row field-row--3">
              <Field
                id="e-name"
                label="Name"
                required
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                id="e-phone"
                label="WhatsApp number"
                placeholder="98765 43210"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <Field
                id="e-gross"
                label="Monthly gross (₹)"
                type="number"
                value={form.grossSalary}
                onChange={(v) => setForm({ ...form, grossSalary: v })}
              />
            </div>
            <div className="field-row field-row--3">
              <Field
                id="e-pf"
                label="PF contribution (₹)"
                type="number"
                value={form.pfContribution}
                onChange={(v) => setForm({ ...form, pfContribution: v })}
              />
              <Field
                id="e-bus"
                label="Bus pass (₹)"
                type="number"
                value={form.busPass}
                onChange={(v) => setForm({ ...form, busPass: v })}
              />
              <div />
            </div>
            <SwitchRow
              id="e-active"
              title="Currently employed"
              note="Inactive people are left out of new payroll runs"
              checked={form.active}
              onChange={(active) => setForm({ ...form, active })}
            />
            {form.phone && !phoneLooksValid(form.phone) ? (
              <div className="form-error">
                That does not look like a 10-digit Indian mobile number — WhatsApp delivery
                will skip this person.
              </div>
            ) : null}
            <div className="flex gap-md">
              <button className="btn btn--primary btn--small" type="submit" disabled={busy}>
                {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add employee'}
              </button>
              <button
                className="btn btn--outline btn--small"
                type="button"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {visible.length === 0 ? (
          <div className="admin-empty">
            {employees.length === 0
              ? 'No employees yet. Add them here, or upload a salary sheet on the Payroll page and the names will be matched automatically.'
              : 'No employees match this search.'}
          </div>
        ) : null}

        {/* Cards — mobile */}
        <div className="emp-cards">
          {visible.map((e) => (
            <div className="emp-card" key={e.id} data-testid={`employee-row-${e.id}`}>
              <div className="emp-card__top">
                <span className="emp-card__name">
                  {e.name}
                  {!e.active ? <span className="tag--type">Inactive</span> : null}
                </span>
                <span
                  className={`emp-card__phone${
                    phoneLooksValid(e.phone) ? '' : ' emp-card__phone--missing'
                  }`}
                >
                  {e.phone || 'Missing'}
                </span>
              </div>
              <div className="emp-card__stats">
                <span className="emp-stat">
                  <span className="emp-stat__label">Gross</span>
                  <span className="emp-stat__value">{formatRupees(e.grossSalary)}</span>
                </span>
                <span className="emp-stat">
                  <span className="emp-stat__label">PF</span>
                  <span className="emp-stat__value">{formatRupees(e.pfContribution)}</span>
                </span>
                <span className="emp-stat">
                  <span className="emp-stat__label">Bus pass</span>
                  <span className="emp-stat__value">{formatRupees(e.busPass)}</span>
                </span>
              </div>
              <div className="emp-card__actions">
                <button
                  className="btn btn--outline btn--small"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setForm(toForm(e));
                  }}
                >
                  Edit
                </button>
                <button className="btn btn--danger btn--small" onClick={() => remove(e)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Table — desktop */}
        {visible.length ? (
          <div className="rec-table">
            <div className="rec-row rec-row--head rec-row--emp">
              <div>Name</div>
              <div>WhatsApp</div>
              <div>Gross</div>
              <div>PF</div>
              <div>Bus pass</div>
              <div></div>
            </div>
            {visible.map((e) => (
              <div className="rec-row rec-row--emp" key={e.id} data-testid={`employee-tr-${e.id}`}>
                <div>
                  <div className="rec-row__name">{e.name}</div>
                  {!e.active ? <div className="rec__slug">Inactive</div> : null}
                </div>
                <div className="rec-row__cell">
                  {e.phone ? (
                    phoneLooksValid(e.phone) ? (
                      e.phone
                    ) : (
                      <span style={{ color: 'var(--danger)' }}>{e.phone} ?</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--danger)' }}>Missing</span>
                  )}
                </div>
                <div className="rec-row__cell">{formatRupees(e.grossSalary)}</div>
                <div className="rec-row__cell">{formatRupees(e.pfContribution)}</div>
                <div className="rec-row__cell">{formatRupees(e.busPass)}</div>
                <div className="rec-row__actions">
                  <button
                    className="btn btn--outline btn--small"
                    onClick={() => {
                      setError('');
                      setSuccess('');
                      setForm(toForm(e));
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn btn--danger btn--small" onClick={() => remove(e)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {form ? null : (
        <div className="pay-bar pay-bar--run">
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              setError('');
              setSuccess('');
              setForm(empty(employees.length));
            }}
          >
            + Add employee
          </button>
        </div>
      )}
    </>
  );
}
