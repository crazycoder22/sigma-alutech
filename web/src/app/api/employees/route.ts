import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-helpers';
import { createEmployee, listEmployees } from '@/lib/payroll/store';
import { toPaise } from '@/lib/payroll/calc';
import { normalisePhone } from '@/lib/payroll/whatsapp';

export const dynamic = 'force-dynamic';

export const employeeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).default(''),
  grossSalary: z.number().nonnegative().default(0),
  pfContribution: z.number().nonnegative().default(0),
  busPass: z.number().nonnegative().default(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

/** Rupee inputs from the form become paise; phone is normalised. */
export function toEmployeeRecord(input: z.infer<typeof employeeSchema>) {
  return {
    name: input.name,
    phone: input.phone ? (normalisePhone(input.phone) ?? input.phone) : '',
    grossSalary: toPaise(input.grossSalary),
    pfContribution: toPaise(input.pfContribution),
    busPass: toPaise(input.busPass),
    active: input.active,
    sortOrder: input.sortOrder,
  };
}

export async function GET() {
  return withErrorHandling(async () => {
    await requireAdmin();
    return { employees: await listEmployees() };
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const input = employeeSchema.parse(await req.json());
    return { employee: await createEmployee(toEmployeeRecord(input)) };
  });
}
