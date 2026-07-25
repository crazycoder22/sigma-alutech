import type { Metadata } from 'next';
import { AdminHeader } from '@/components/admin/AdminHeader';

export const metadata: Metadata = {
  title: 'Admin | Sigma Alutech',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="admin-shell">
      <AdminHeader />
      <main className="admin-main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
