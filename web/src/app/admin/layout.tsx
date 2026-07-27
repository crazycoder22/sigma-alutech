import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { getSiteStats } from '@/lib/catalog';
import { listEmployees } from '@/lib/payroll/store';
import { AdminChrome } from '@/components/admin/AdminChrome';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  // Signed out (the login screen) gets a bare shell — no sidebar.
  if (!session) {
    return <div className="admin admin--auth">{children}</div>;
  }

  const [stats, staff] = await Promise.all([getSiteStats(), listEmployees()]);

  return (
    <div className="admin admin--app">
      <AdminChrome
        email={session.email}
        productCount={stats.products}
        projectCount={stats.projects}
        employeeCount={staff.length}
      />
      <div className="admin__main">{children}</div>
    </div>
  );
}
