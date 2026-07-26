'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_LINKS, quoteHref } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Home leads with the ink hero, so its bar is dark in both themes.
  const isHome = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');

  // Close the drawer on any navigation, including back/forward.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (isAdmin) return null; // the admin area has its own chrome

  const isActive = (href: string) =>
    href.startsWith('/#') || href.includes('#')
      ? pathname === href.split('#')[0]
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav className={`nav${isHome ? ' nav--ink' : ''}`} id="nav">
        <div className="container nav__inner">
          <Link href="/" className="nav__logo">
            SIGMA <span>ALUTECH</span>
          </Link>

          <div className="nav__links">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav__link${isActive(l.href) ? ' active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="nav__actions">
            <ThemeToggle />
            <button
              className="nav__toggle"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="nav-drawer"
              onClick={() => setOpen((v) => !v)}
            >
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`nav__scrim${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      ></div>

      <div className={`nav__drawer${open ? ' open' : ''}`} id="nav-drawer">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav__drawer-link${isActive(l.href) ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
        <a className="btn btn--on-ink nav__drawer-cta" href={quoteHref()}>
          Request a quote
        </a>
      </div>
    </>
  );
}
