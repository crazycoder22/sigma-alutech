import ExcelJS from 'exceljs';
import { toPaise } from './calc';

/**
 * Parser for the office salary workbook (RESAL*.xls — actually xlsx).
 *
 * Layout: a two-line header on rows 6–7, then one employee every other row
 * starting at row 9 (blank spacer rows between). Column A is the serial
 * number, B the name. Rather than hard-code row numbers we take any row
 * with a numeric column A and a non-empty column B, which survives the
 * sheet growing or losing its spacer rows.
 *
 * Derived columns (SAL/DAY, NET, OT AMT, TOTAL, BALANCE, NET PAID) are
 * formulas in the sheet; we read their cached values only to cross-check
 * and recompute everything ourselves.
 */

export interface ImportedRow {
  serial: number;
  name: string;
  daysInPeriod: number;
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
  /** NET SALARY PAID as the sheet computed it, for reconciliation. */
  sheetNetPaid: number;
}

export interface ImportResult {
  sheetName: string;
  rows: ImportedRow[];
  /** Rows whose recomputed net differs from the sheet's own figure. */
  discrepancies: Array<{ name: string; sheet: number; computed: number }>;
}

/** Columns are 1-indexed to match Excel. */
const COL = {
  serial: 1,
  name: 2,
  daysInPeriod: 3,
  daysWorked: 4,
  gross: 5,
  otHours: 8,
  outsidePay: 10,
  advancePending: 12,
  advanceDeducted: 13,
  netPaid: 15,
  attendanceBonus: 16,
  phoneDeduction: 17,
  pf: 18,
  busPass: 19,
  annualBonus: 20,
} as const;

function num(cell: ExcelJS.Cell | undefined): number {
  if (!cell) return 0;
  const v = cell.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  // Formula cells expose their cached result.
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as { result?: unknown }).result;
    return typeof r === 'number' ? r : 0;
  }
  const parsed = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'result' in v) {
    return String((v as { result?: unknown }).result ?? '').trim();
  }
  if (typeof v === 'object' && 'richText' in v) {
    return (v as ExcelJS.RichText[] & { richText: ExcelJS.RichText[] }).richText
      .map((t) => t.text)
      .join('')
      .trim();
  }
  return String(v).trim();
}

export async function parseSalaryWorkbook(
  data: ArrayBuffer | Buffer,
  preferredSheet?: string
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  const buffer: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data));
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet =
    (preferredSheet && wb.getWorksheet(preferredSheet)) ??
    wb.worksheets.find((ws) => ws.actualRowCount > 10) ??
    wb.worksheets[0];

  if (!sheet) throw new Error('The workbook has no readable sheets.');

  const rows: ImportedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 8) return; // header block
    const serial = num(row.getCell(COL.serial));
    const name = str(row.getCell(COL.name));
    if (!serial || !name) return;

    rows.push({
      serial,
      name,
      daysInPeriod: num(row.getCell(COL.daysInPeriod)) || 30,
      daysWorked: num(row.getCell(COL.daysWorked)),
      grossSalary: toPaise(num(row.getCell(COL.gross))),
      otHours: num(row.getCell(COL.otHours)),
      outsidePay: toPaise(num(row.getCell(COL.outsidePay))),
      advancePending: toPaise(num(row.getCell(COL.advancePending))),
      advanceDeducted: toPaise(num(row.getCell(COL.advanceDeducted))),
      attendanceBonus: toPaise(num(row.getCell(COL.attendanceBonus))),
      phoneDeduction: toPaise(num(row.getCell(COL.phoneDeduction))),
      pfContribution: toPaise(num(row.getCell(COL.pf))),
      busPass: toPaise(num(row.getCell(COL.busPass))),
      annualBonus: toPaise(num(row.getCell(COL.annualBonus))),
      sheetNetPaid: toPaise(num(row.getCell(COL.netPaid))),
    });
  });

  if (rows.length === 0) {
    throw new Error(
      'No employee rows found. Expected a serial number in column A and a name in column B.'
    );
  }

  return { sheetName: sheet.name, rows, discrepancies: [] };
}

/** Normalised key for matching a sheet name to an employee record. */
export function matchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')       // drop parenthetical notes: "ABHI (SURYA SON)"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
