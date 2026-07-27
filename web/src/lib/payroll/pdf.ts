import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PayrollLine } from '@/db';
import { SITE } from '@/lib/site';
import {
  deductionsBreakdown,
  earningsBreakdown,
  formatPeriod,
  formatRupees,
  sumDeductions,
  sumEarnings,
} from './calc';

/** Ink and gold, matching the site. */
const INK = rgb(0.078, 0.067, 0.047);
const MUTED = rgb(0.486, 0.451, 0.384);
const GOLD = rgb(0.627, 0.486, 0.2);
const RULE = rgb(0.902, 0.875, 0.812);
const TINT = rgb(0.969, 0.953, 0.918);

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** pdf-lib has no letter-spacing, so lay the glyphs out by hand. */
function drawTracked(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; tracking: number }
): number {
  let x = opts.x;
  for (const ch of text) {
    page.drawText(ch, { x, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
    x += opts.font.widthOfTextAtSize(ch, opts.size) + opts.tracking;
  }
  return x - opts.x;
}

function trackedWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + tracking * Math.max(text.length - 1, 0);
}

function line(page: PDFPage, y: number, x1 = M, x2 = A4.w - M) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.7, color: RULE });
}

function label(page: PDFPage, f: Fonts, text: string, x: number, y: number) {
  drawTracked(page, text.toUpperCase(), {
    x,
    y,
    size: 7.5,
    font: f.bold,
    color: MUTED,
    tracking: 1.1,
  });
}

/** Build a one-page salary statement. */
export async function renderPayslip(
  linePlain: PayrollLine,
  period: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const f: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  doc.setTitle(`Salary statement — ${linePlain.employeeName} — ${formatPeriod(period)}`);
  doc.setProducer(SITE.name);
  doc.setCreator(SITE.name);

  let y = A4.h - M;

  // ---- Masthead ----
  page.drawRectangle({ x: 0, y: y - 18, width: A4.w, height: 66, color: INK });
  const sigmaWidth = drawTracked(page, 'SIGMA ', {
    x: M,
    y: y + 14,
    size: 17,
    font: f.bold,
    color: rgb(0.969, 0.953, 0.918),
    tracking: 1.4,
  });
  drawTracked(page, 'ALUTECH', {
    x: M + sigmaWidth,
    y: y + 14,
    size: 17,
    font: f.bold,
    color: rgb(0.788, 0.643, 0.357),
    tracking: 1.4,
  });
  drawTracked(page, 'SALARY STATEMENT', {
    x: A4.w - M - trackedWidth('SALARY STATEMENT', f.bold, 9, 1.6),
    y: y + 18,
    size: 9,
    font: f.bold,
    color: rgb(0.788, 0.643, 0.357),
    tracking: 1.6,
  });
  page.drawText(formatPeriod(period), {
    x: A4.w - M - f.regular.widthOfTextAtSize(formatPeriod(period), 9),
    y: y + 3,
    size: 9,
    font: f.regular,
    color: rgb(0.71, 0.674, 0.6),
  });

  y -= 56;

  // ---- Employee ----
  label(page, f, 'Employee', M, y);
  y -= 18;
  page.drawText(linePlain.employeeName, { x: M, y, size: 17, font: f.bold, color: INK });

  const rightX = A4.w / 2 + 20;
  label(page, f, 'Days worked', rightX, y + 18);
  page.drawText(`${linePlain.daysWorked}`, {
    x: rightX,
    y,
    size: 17,
    font: f.bold,
    color: INK,
  });

  y -= 14;
  page.drawText(
    `Monthly gross ${formatRupees(linePlain.grossSalary)}  ·  Per day ${formatRupees(
      linePlain.salaryPerDay
    )}`,
    { x: M, y, size: 9, font: f.regular, color: MUTED }
  );
  y -= 16;
  line(page, y);
  y -= 26;

  const input = linePlain;
  const derived = linePlain;

  // ---- Earnings ----
  label(page, f, 'Earnings', M, y);
  y -= 16;
  for (const row of earningsBreakdown(input, derived)) {
    page.drawText(row.label, { x: M, y, size: 10, font: f.regular, color: INK });
    if (row.detail) {
      page.drawText(row.detail, {
        x: M + 150,
        y,
        size: 9,
        font: f.regular,
        color: MUTED,
      });
    }
    const amount = formatRupees(row.amount);
    page.drawText(amount, {
      x: A4.w - M - f.regular.widthOfTextAtSize(amount, 10),
      y,
      size: 10,
      font: f.regular,
      color: INK,
    });
    y -= 18;
  }

  y -= 2;
  line(page, y + 6);
  y -= 10;
  page.drawText('Total earnings', { x: M, y, size: 10, font: f.bold, color: INK });
  // Must equal the lines printed above, so sum them rather than reuse the
  // spreadsheet's narrower TOTAL column.
  const totalTxt = formatRupees(sumEarnings(input, derived));
  page.drawText(totalTxt, {
    x: A4.w - M - f.bold.widthOfTextAtSize(totalTxt, 10),
    y,
    size: 10,
    font: f.bold,
    color: INK,
  });

  y -= 34;

  // ---- Deductions ----
  const deductions = deductionsBreakdown(input);
  label(page, f, 'Deductions', M, y);
  y -= 16;
  if (deductions.length === 0) {
    page.drawText('None', { x: M, y, size: 10, font: f.regular, color: MUTED });
    y -= 18;
  }
  for (const row of deductions) {
    page.drawText(row.label, { x: M, y, size: 10, font: f.regular, color: INK });
    const amount = `- ${formatRupees(row.amount)}`;
    page.drawText(amount, {
      x: A4.w - M - f.regular.widthOfTextAtSize(amount, 10),
      y,
      size: 10,
      font: f.regular,
      color: INK,
    });
    y -= 18;
  }

  const totalDeductions = sumDeductions(input);
  y -= 2;
  line(page, y + 6);
  y -= 10;
  page.drawText('Total deductions', { x: M, y, size: 10, font: f.bold, color: INK });
  const dedTxt = `- ${formatRupees(totalDeductions)}`;
  page.drawText(dedTxt, {
    x: A4.w - M - f.bold.widthOfTextAtSize(dedTxt, 10),
    y,
    size: 10,
    font: f.bold,
    color: INK,
  });

  y -= 40;

  // ---- Net paid ----
  page.drawRectangle({
    x: M,
    y: y - 16,
    width: A4.w - M * 2,
    height: 52,
    color: TINT,
  });
  // Gold edge on the leading side, so the net reads as the conclusion.
  page.drawRectangle({ x: M, y: y - 16, width: 3, height: 52, color: GOLD });
  drawTracked(page, 'NET SALARY PAID', {
    x: M + 18,
    y: y + 18,
    size: 8,
    font: f.bold,
    color: GOLD,
    tracking: 1.4,
  });
  const net = `Rs ${formatRupees(derived.netPaid)}`;
  page.drawText(net, {
    x: A4.w - M - 18 - f.bold.widthOfTextAtSize(net, 20),
    y: y + 4,
    size: 20,
    font: f.bold,
    color: INK,
  });

  y -= 52;

  // ---- Advance ledger, only when relevant ----
  if (input.advancePending || input.advanceDeducted || derived.balanceAdvance) {
    y -= 16;
    label(page, f, 'Advance', M, y);
    y -= 16;
    const ledger: Array<[string, number]> = [
      ['Opening advance', input.advancePending],
      ['Deducted this month', input.advanceDeducted],
      ['Balance carried forward', derived.balanceAdvance],
    ];
    for (const [text, amount] of ledger) {
      page.drawText(text, { x: M, y, size: 9.5, font: f.regular, color: MUTED });
      const a = formatRupees(amount);
      page.drawText(a, {
        x: A4.w - M - f.regular.widthOfTextAtSize(a, 9.5),
        y,
        size: 9.5,
        font: f.regular,
        color: INK,
      });
      y -= 16;
    }
  }

  // ---- Footer ----
  const footerY = M + 12;
  line(page, footerY + 22);
  page.drawText(
    `${SITE.name} · ${SITE.address} · ${SITE.phoneDisplay}`,
    { x: M, y: footerY + 8, size: 8, font: f.regular, color: MUTED }
  );
  page.drawText(
    'Computer-generated statement. Please contact the office with any query.',
    { x: M, y: footerY - 4, size: 8, font: f.regular, color: MUTED }
  );

  return doc.save();
}

/** Filename used in Blob storage and in the zip download. */
export function payslipFilename(name: string, period: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `payslip-${period.slice(0, 7)}-${slug || 'employee'}.pdf`;
}
