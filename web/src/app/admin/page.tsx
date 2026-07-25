import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect('/admin/products');

  return (
    <div className="admin-login">
      <h1>Admin Sign In</h1>
      <LoginForm />
    </div>
  );
}
