import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSalaryWorkbook, matchKey } from '@/lib/payroll/import';
import { calculatePay, toPaise } from '@/lib/payroll/calc';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../fixtures/salary-sample.xlsx');

// The fixture mirrors the office workbook's layout with invented people —
// real salary data is never committed to this repository.
const workbook = await parseSalaryWorkbook(fs.readFileSync(FIXTURE));

describe('parseSalaryWorkbook', () => {
  it('finds every employee row despite the blank spacer rows', () => {
    expect(workbook.rows).toHaveLength(8);
    expect(workbook.rows[0].name).toBe('ARJUN RAO');
    expect(workbook.rows.at(-1)!.name).toBe('HEMA R (HELPER)');
  });

  it('reads inputs in paise', () => {
    const row = workbook.rows[0];
    expect(row.grossSalary).toBe(toPaise(30000));
    expect(row.daysWorked).toBe(30);
    expect(row.daysInPeriod).toBe(30);
    expect(row.busPass).toBe(toPaise(1200));
  });

  it('reads the cached results of formula cells', () => {
    const deepak = workbook.rows.find((r) => r.name === 'DEEPAK N')!;
    expect(deepak.otHours).toBe(34);
    expect(deepak.outsidePay).toBe(toPaise(2750));
    expect(deepak.sheetNetPaid).toBeGreaterThan(0);
  });

  it('recomputes every net exactly as the sheet did', () => {
    for (const row of workbook.rows) {
      const derived = calculatePay(row, row.daysInPeriod);
      // Allow a paise of rounding between the sheet's floats and our integers.
      expect(
        Math.abs(derived.netPaid - row.sheetNetPaid),
        `${row.name}: sheet ${row.sheetNetPaid} vs computed ${derived.netPaid}`
      ).toBeLessThanOrEqual(1);
    }
  });

  it('rejects a workbook with no employee rows', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Empty').getCell('A1').value = 'nothing here';
    const buf = await wb.xlsx.writeBuffer();
    await expect(parseSalaryWorkbook(Buffer.from(buf))).rejects.toThrow(
      /No employee rows/
    );
  });
});

describe('matchKey', () => {
  it('ignores case, punctuation and parenthetical notes', () => {
    expect(matchKey('ABHI (SURYA SON)')).toBe('abhi');
    expect(matchKey('RAJASHEKAR  P')).toBe('rajashekar p');
    expect(matchKey('Sunny (Hemender)')).toBe('sunny');
  });

  it('matches the same person written slightly differently', () => {
    expect(matchKey('KRISHNA KUMAR')).toBe(matchKey('Krishna  Kumar'));
  });

  it('keeps genuinely different people apart', () => {
    expect(matchKey('KRISHNA P')).not.toBe(matchKey('KRISHNA KUMAR'));
  });
});
