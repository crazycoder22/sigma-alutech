import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listRuns, listEmployees } from '@/lib/payroll/store';
import { PayrollRuns } from '@/components/admin/PayrollRuns';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollPage() {
  const session = await getSession();
  if (!session) redirect('/admin');
  const [runs, employees] = await Promise.all([listRuns(), listEmployees(false)]);
  return <PayrollRuns runs={runs} activeEmployees={employees.filter((e) => e.active).length} />;
}
