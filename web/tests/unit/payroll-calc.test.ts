import { describe, it, expect } from 'vitest';
import {
  calculatePay,
  toPaise,
  toRupees,
  formatRupees,
  formatPeriod,
  daysInMonth,
  HOURS_PER_DAY,
} from '@/lib/payroll/calc';

const base = {
  daysWorked: 30,
  grossSalary: toPaise(30000),
  otHours: 0,
  outsidePay: 0,
  advancePending: 0,
  advanceDeducted: 0,
  attendanceBonus: 0,
  phoneDeduction: 0,
  pfContribution: 0,
  busPass: 0,
  annualBonus: 0,
};

describe('calculatePay', () => {
  it('pays exactly the gross for a full month', () => {
    const r = calculatePay(base, 30);
    expect(r.earnedSalary).toBe(toPaise(30000));
    expect(r.netPaid).toBe(toPaise(30000));
  });

  it('pro-rates on days worked', () => {
    const r = calculatePay({ ...base, daysWorked: 15 }, 30);
    expect(r.earnedSalary).toBe(toPaise(15000));
  });

  it('prices overtime at an 8.5-hour day', () => {
    // 30000/30 = 1000/day → 1000/8.5 per hour × 8.5 hours = one day's pay
    const r = calculatePay({ ...base, otHours: HOURS_PER_DAY }, 30);
    expect(r.otAmount).toBe(toPaise(1000));
  });

  it('adds allowances and subtracts deductions', () => {
    const r = calculatePay(
      {
        ...base,
        outsidePay: toPaise(2000),
        attendanceBonus: toPaise(500),
        busPass: toPaise(1200),
        annualBonus: toPaise(1000),
        advanceDeducted: toPaise(3000),
        phoneDeduction: toPaise(200),
        pfContribution: toPaise(1454),
      },
      30
    );
    expect(r.totalEarnings).toBe(toPaise(32000));
    // 32000 + 500 + 1200 + 1000 − 3000 − 200 − 1454
    expect(r.netPaid).toBe(toPaise(30046));
  });

  it('tracks the advance balance', () => {
    const r = calculatePay(
      { ...base, advancePending: toPaise(5000), advanceDeducted: toPaise(2000) },
      30
    );
    expect(r.balanceAdvance).toBe(toPaise(3000));
  });

  it('never divides by zero when the period is unset', () => {
    const r = calculatePay(base, 0);
    expect(Number.isFinite(r.earnedSalary)).toBe(true);
    expect(r.earnedSalary).toBe(toPaise(30000));
  });
});

describe('money helpers', () => {
  it('round-trips rupees through paise', () => {
    expect(toPaise(1234.56)).toBe(123456);
    expect(toRupees(123456)).toBe(1234.56);
    expect(toPaise('1,234.56')).toBe(123456);
    expect(toPaise(null)).toBe(0);
    expect(toPaise('')).toBe(0);
  });

  it('formats with Indian digit grouping', () => {
    expect(formatRupees(toPaise(789554))).toBe('7,89,554.00');
    expect(formatRupees(toPaise(1234.5), true)).toBe('₹1,234.50');
  });
});

describe('period helpers', () => {
  it('labels a period key', () => {
    expect(formatPeriod('2026-06-01')).toBe('June 2026');
  });

  it('knows the length of a month', () => {
    expect(daysInMonth('2026-06-01')).toBe(30);
    expect(daysInMonth('2026-07-01')).toBe(31);
    expect(daysInMonth('2024-02-01')).toBe(29);
  });
});

describe('payslip presentation', () => {
  it('the printed earnings total equals the lines above it', async () => {
    const { sumEarnings, earningsBreakdown, sumDeductions, deductionsBreakdown } =
      await import('@/lib/payroll/calc');
    const input = {
      ...base,
      daysWorked: 28,
      grossSalary: toPaise(39000),
      otHours: 12,
      outsidePay: toPaise(5100),
      attendanceBonus: toPaise(500),
      busPass: toPaise(2500),
      advanceDeducted: toPaise(2500),
      phoneDeduction: toPaise(250),
      pfContribution: toPaise(1571),
    };
    const derived = calculatePay(input, 30);

    const lines = earningsBreakdown(input, derived);
    expect(sumEarnings(input, derived)).toBe(lines.reduce((n, r) => n + r.amount, 0));

    const deds = deductionsBreakdown(input);
    expect(sumDeductions(input)).toBe(deds.reduce((n, r) => n + r.amount, 0));

    // The two printed totals still reconcile to the net the sheet pays.
    expect(sumEarnings(input, derived) - sumDeductions(input)).toBe(derived.netPaid);
  });
});
