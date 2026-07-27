import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandling, notFound, parseId } from '@/lib/api-helpers';
import { deleteEmployee, updateEmployee } from '@/lib/payroll/store';
import { employeeSchema, toEmployeeRecord } from '../route';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Employee');
    const input = employeeSchema.parse(await req.json());
    const employee = await updateEmployee(id, toEmployeeRecord(input));
    if (!employee) return notFound('Employee');
    return { employee };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    await requireAdmin();
    const id = parseId((await params).id);
    if (id === null) return notFound('Employee');
    const employee = await deleteEmployee(id);
    if (!employee) return notFound('Employee');
    return { ok: true };
  });
}
