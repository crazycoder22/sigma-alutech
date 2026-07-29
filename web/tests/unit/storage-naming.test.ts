import { describe, it, expect } from 'vitest';
import { payslipFilename } from '@/lib/payroll/pdf';

/**
 * The filename is derived from the employee's name, so on its own it is
 * entirely guessable. That is fine only because the stored object carries
 * a random suffix — see saveDocument. This test exists to make the
 * assumption explicit: if anyone reaches for addRandomSuffix: false again,
 * they should have to think about this.
 */
describe('payslip filenames are guessable by design', () => {
  it('is a plain slug of the name and period', () => {
    expect(payslipFilename('BHAVNA SINGH', '2026-06-01')).toBe(
      'payslip-2026-06-bhavna-singh.pdf'
    );
    expect(payslipFilename('HEMA R (HELPER)', '2026-06-01')).toBe(
      'payslip-2026-06-hema-r.pdf'
    );
  });

  it('never collides for two people in the same month', () => {
    const a = payslipFilename('MANI', '2026-06-01');
    const b = payslipFilename('MANOJ KUMAR', '2026-06-01');
    expect(a).not.toBe(b);
  });
});
