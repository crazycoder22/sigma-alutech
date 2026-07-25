'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin');
    router.refresh();
  }

  const loggedInArea = pathname !== '/admin';

  return (
    <header className="admin-header">
      <div className="container admin-header__inner">
        <Link href="/" className="nav__logo">
          <div className="nav__logo-text">
            SIGMA <span>ALUTECH</span>
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                marginLeft: 8,
                letterSpacing: '0.1em',
              }}
            >
              ADMIN
            </span>
          </div>
        </Link>

        <div className="admin-header__links">
          {loggedInArea ? (
            <>
              <Link
                href="/admin/products"
                className={`admin-header__link${pathname.startsWith('/admin/products') ? ' active' : ''}`}
              >
                Products
              </Link>
              <Link
                href="/admin/projects"
                className={`admin-header__link${pathname.startsWith('/admin/projects') ? ' active' : ''}`}
              >
                Projects
              </Link>
              <Link href="/" className="admin-header__link" target="_blank">
                View Site ↗
              </Link>
              <button className="btn btn--outline btn--small" onClick={signOut}>
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/" className="admin-header__link">
              ← Back to site
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
