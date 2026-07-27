import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRun, previousNetByName } from '@/lib/payroll/store';
import { parseId } from '@/lib/api-helpers';
import { isLiveProvider } from '@/lib/payroll/whatsapp';
import { PayrollRunEditor } from '@/components/admin/PayrollRunEditor';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/admin');

  const id = parseId((await params).id);
  if (id === null) notFound();
  const run = await getRun(id);
  if (!run) notFound();

  const previousNet = await previousNetByName(run.period);

  return (
    <PayrollRunEditor
      run={run}
      previousNet={previousNet}
      whatsappLive={isLiveProvider()}
    />
  );
}
