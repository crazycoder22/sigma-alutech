'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Props {
  email: string;
  productCount: number;
  projectCount: number;
  employeeCount: number;
}

function initials(email: string): string {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Small round moon/sun control matching the ink chrome. */
function InkThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('sigma-theme', next);
    } catch {
      /* storage blocked */
    }
  }
  return (
    <button
      className="ink-icon-btn"
      data-theme-toggle
      aria-label="Toggle light/dark theme"
      onClick={toggle}
    >
      <svg
        className="theme-toggle__moon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
      <svg
        className="theme-toggle__sun"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}

export function AdminChrome({
  email,
  productCount,
  projectCount,
  employeeCount,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const onProducts = pathname.startsWith('/admin/products');
  const onProjects = pathname.startsWith('/admin/projects');
  const onEmployees = pathname.startsWith('/admin/employees');
  const onPayroll = pathname.startsWith('/admin/payroll');

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin');
    router.refresh();
  }

  return (
    <>
      {/* ---------- Mobile: ink header + tabs ---------- */}
      <header className="admin-top">
        <div className="admin-top__bar">
          <div className="admin-top__brand">
            <span className="admin-logo">
              SIGMA <span>ALUTECH</span>
            </span>
            <span className="admin-top__tag">Admin</span>
          </div>
          <div className="admin-top__actions">
            <InkThemeToggle />
            <button
              className="avatar avatar--sm"
              onClick={signOut}
              title={`${email} — sign out`}
              aria-label="Sign out"
            >
              {initials(email)}
            </button>
          </div>
        </div>
        <nav className="admin-tabs">
          <Link
            href="/admin/products"
            className={`admin-tab${onProducts ? ' active' : ''}`}
          >
            Products <span className="admin-tab__count">{productCount}</span>
          </Link>
          <Link
            href="/admin/projects"
            className={`admin-tab${onProjects ? ' active' : ''}`}
          >
            Projects <span className="admin-tab__count">{projectCount}</span>
          </Link>
          <Link
            href="/admin/payroll"
            className={`admin-tab${onPayroll ? ' active' : ''}`}
          >
            Payroll
          </Link>
          <Link
            href="/admin/employees"
            className={`admin-tab${onEmployees ? ' active' : ''}`}
          >
            Staff <span className="admin-tab__count">{employeeCount}</span>
          </Link>
          <Link href="/" className="admin-tab" target="_blank">
            Site ↗
          </Link>
        </nav>
      </header>

      {/* ---------- Desktop: ink sidebar ---------- */}
      <aside className="admin-side">
        <div className="admin-side__brand">
          <div className="admin-logo">
            SIGMA <span>ALUTECH</span>
          </div>
          <div className="admin-side__tag">Content Admin</div>
        </div>

        <nav className="admin-side__nav">
          <Link
            href="/admin/products"
            className={`admin-side__link${onProducts ? ' active' : ''}`}
          >
            Products <span className="admin-side__count">{productCount}</span>
          </Link>
          <Link
            href="/admin/projects"
            className={`admin-side__link${onProjects ? ' active' : ''}`}
          >
            Projects <span className="admin-side__count">{projectCount}</span>
          </Link>
          <span className="admin-side__group">Payroll</span>
          <Link
            href="/admin/payroll"
            className={`admin-side__link${onPayroll ? ' active' : ''}`}
          >
            Pay months
          </Link>
          <Link
            href="/admin/employees"
            className={`admin-side__link${onEmployees ? ' active' : ''}`}
          >
            Employees <span className="admin-side__count">{employeeCount}</span>
          </Link>
        </nav>

        <div className="admin-side__foot">
          <Link href="/" className="admin-side__site" target="_blank">
            View site ↗
          </Link>
          <div className="admin-user">
            <span className="avatar">{initials(email)}</span>
            <span className="admin-user__id">
              <span className="admin-user__name" title={email}>
                {email.split('@')[0]}
              </span>
              <button className="admin-user__signout" onClick={signOut}>
                Sign out
              </button>
            </span>
            <InkThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
