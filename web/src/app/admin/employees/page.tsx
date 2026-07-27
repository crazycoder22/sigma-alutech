import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listEmployees } from '@/lib/payroll/store';
import { EmployeesAdmin } from '@/components/admin/EmployeesAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesPage() {
  const session = await getSession();
  if (!session) redirect('/admin');
  return <EmployeesAdmin employees={await listEmployees()} />;
}
