import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect('/admin/products');

  return (
    <>
      <header className="admin-top">
        <div className="admin-top__bar">
          <div className="admin-top__brand">
            <span className="admin-logo">
              SIGMA <span>ALUTECH</span>
            </span>
            <span className="admin-top__tag">Admin</span>
          </div>
          <Link href="/" className="admin-side__site">
            ← Back to site
          </Link>
        </div>
      </header>

      <div className="admin-login">
        <h1>Admin Sign In</h1>
        <LoginForm />
      </div>
    </>
  );
}
