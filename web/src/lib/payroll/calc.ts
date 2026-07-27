/**
 * Salary calculation, mirroring the formulas in the office spreadsheet
 * (RESAL*.xls). Every amount is in **paise** (integer) so nothing drifts.
 *
 * From the sheet:
 *   SAL/DAY   = GROSS / daysInPeriod
 *   NET       = DAYS WORKED × SAL/DAY
 *   OT AMT    = OT HRS / 8.5 × SAL/DAY
 *   TOTAL     = NET + OT AMT + OUTSIDE PAY
 *   BALANCE   = ADVANCE PENDING − ADVANCE DEDUCTED
 *   NET PAID  = TOTAL + ATTND BONUS + BUS PASS + ANNUAL BONUS
 *               − ADVANCE DEDUCTED − PHONE DEDUCTION − PF
 */

/** Hours in a standard working day, from the sheet's `=H/(8.5)*F` OT formula. */
export const HOURS_PER_DAY = 8.5;

export interface PayInputs {
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
}

export interface PayDerived {
  salaryPerDay: number;
  earnedSalary: number;
  otAmount: number;
  totalEarnings: number;
  balanceAdvance: number;
  netPaid: number;
}

const round = (n: number) => Math.round(n);

export function calculatePay(input: PayInputs, daysInPeriod: number): PayDerived {
  const days = daysInPeriod > 0 ? daysInPeriod : 30;

  const salaryPerDay = round(input.grossSalary / days);
  // Derive from gross rather than the rounded per-day figure so a full
  // month always pays exactly the gross.
  const earnedSalary = round((input.grossSalary * input.daysWorked) / days);
  const otAmount = round(
    (input.grossSalary / days / HOURS_PER_DAY) * input.otHours
  );

  const totalEarnings = earnedSalary + otAmount + input.outsidePay;
  const balanceAdvance = input.advancePending - input.advanceDeducted;

  const netPaid =
    totalEarnings +
    input.attendanceBonus +
    input.busPass +
    input.annualBonus -
    input.advanceDeducted -
    input.phoneDeduction -
    input.pfContribution;

  return {
    salaryPerDay,
    earnedSalary,
    otAmount,
    totalEarnings,
    balanceAdvance,
    netPaid,
  };
}

/**
 * Everything added, in payslip order. Note `totalEarnings` on the run
 * mirrors the spreadsheet's TOTAL column, which counts only salary + OT
 * + outside pay; bonuses and the bus pass are added at the net stage.
 * A payslip must show a total that matches the lines above it, so use
 * `sumEarnings` for display.
 */
export function earningsBreakdown(input: PayInputs, derived: PayDerived) {
  return [
    { label: 'Earned salary', detail: `${input.daysWorked} days`, amount: derived.earnedSalary },
    { label: 'Overtime', detail: input.otHours ? `${input.otHours} hrs` : '', amount: derived.otAmount },
    { label: 'Outside pay', detail: '', amount: input.outsidePay },
    { label: 'Attendance bonus', detail: '', amount: input.attendanceBonus },
    { label: 'Bus pass / conveyance', detail: '', amount: input.busPass },
    { label: 'Annual bonus', detail: '', amount: input.annualBonus },
  ].filter((r) => r.amount !== 0);
}

/** Sum of the earning lines shown on the payslip. */
export function sumEarnings(input: PayInputs, derived: PayDerived): number {
  return earningsBreakdown(input, derived).reduce((n, r) => n + r.amount, 0);
}

/** Sum of everything taken off. */
export function deductionsBreakdown(input: PayInputs) {
  return [
    { label: 'Advance deducted', detail: '', amount: input.advanceDeducted },
    { label: 'PF contribution', detail: '', amount: input.pfContribution },
    { label: 'Phone bill', detail: '', amount: input.phoneDeduction },
  ].filter((r) => r.amount !== 0);
}

/* ---------------- money helpers ---------------- */

/** Rupees (possibly fractional) → paise. */
export function toPaise(rupees: number | string | null | undefined): number {
  if (rupees === null || rupees === undefined || rupees === '') return 0;
  const n = typeof rupees === 'string' ? Number(rupees.replace(/,/g, '')) : rupees;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Paise → rupees as a number (for form fields). */
export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/** Paise → "12,345.67" using Indian digit grouping. */
export function formatRupees(paise: number, withSymbol = false): string {
  const value = Math.round(paise) / 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return withSymbol ? `₹${formatted}` : formatted;
}

/** "June 2026" from a "2026-06-01" period key. */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Days in the calendar month of a period key. */
export function daysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function sumDeductions(input: PayInputs): number {
  return deductionsBreakdown(input).reduce((n, r) => n + r.amount, 0);
}
