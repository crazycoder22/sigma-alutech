import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';
import { listEmployees } from '@/lib/payroll/store';
import { matchKey, parseSalaryWorkbook } from '@/lib/payroll/import';
import { normalisePhone } from '@/lib/payroll/whatsapp';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Parse an uploaded salary workbook and match its rows against the
 * employee register. Nothing is written — the admin reviews the result
 * and saves the run explicitly.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();

    const form = await req.formData();
    const file = form.get('file');
    const sheet = form.get('sheet');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'That workbook is larger than 5 MB.' },
        { status: 400 }
      );
    }

    let parsed;
    try {
      parsed = await parseSalaryWorkbook(
        Buffer.from(await file.arrayBuffer()),
        typeof sheet === 'string' && sheet ? sheet : undefined
      );
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : 'That file could not be read as an Excel workbook.',
        },
        { status: 400 }
      );
    }

    const staff = await listEmployees();
    const byKey = new Map(staff.map((e) => [matchKey(e.name), e]));

    const lines = parsed.rows.map((row, i) => {
      const match = byKey.get(matchKey(row.name));
      return {
        employeeId: match?.id ?? null,
        employeeName: match?.name ?? row.name,
        sheetName: row.name,
        matched: Boolean(match),
        phone: match?.phone ?? '',
        daysWorked: row.daysWorked,
        grossSalary: row.grossSalary,
        otHours: row.otHours,
        outsidePay: row.outsidePay,
        advancePending: row.advancePending,
        advanceDeducted: row.advanceDeducted,
        attendanceBonus: row.attendanceBonus,
        phoneDeduction: row.phoneDeduction,
        // Fall back to the register when the sheet leaves these blank.
        pfContribution: row.pfContribution || match?.pfContribution || 0,
        busPass: row.busPass || match?.busPass || 0,
        annualBonus: row.annualBonus,
        sheetNetPaid: row.sheetNetPaid,
        sortOrder: i,
      };
    });

    const unmatched = lines.filter((l) => !l.matched).map((l) => l.sheetName);
    const missingPhone = lines
      .filter((l) => l.matched && !normalisePhone(l.phone))
      .map((l) => l.employeeName);

    return {
      sheetName: parsed.sheetName,
      daysInPeriod: parsed.rows[0]?.daysInPeriod ?? 30,
      lines,
      unmatched,
      missingPhone,
    };
  });
}
