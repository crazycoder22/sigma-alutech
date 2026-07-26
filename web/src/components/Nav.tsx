'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_LINKS, quoteHref } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  const isAdmin = pathname.startsWith('/admin');
  // Pages that lead with a full-bleed photograph carry the nav on top of it.
  const overHero = pathname === '/' || /^\/projects\/[^/]+$/.test(pathname);
  // The projects index opens on an ink band, so the bar matches it.
  const onInk = pathname === '/projects';

  // Reset per-route state on navigation, including back/forward.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setScrolled(false);
  }

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (isAdmin) return null; // the admin area has its own chrome

  const isActive = (href: string) => {
    const base = href.split('#')[0];
    if (base === '/') return pathname === '/';
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  // Dark chrome whenever the bar sits on ink or on a photograph.
  const dark = onInk || (overHero && !scrolled);

  const classes = [
    'nav',
    overHero ? 'nav--over' : '',
    onInk ? 'nav--ink' : '',
    dark ? 'nav--dark' : '',
    scrolled ? 'scrolled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <nav className={classes} id="nav">
        <div className="container nav__inner">
          <Link href="/" className="nav__logo">
            SIGMA <span>ALUTECH</span>
          </Link>

          <div className="nav__links">
            <Link href="/" className={`nav__link${isActive('/') ? ' active' : ''}`}>
              Home
            </Link>
            {NAV_LINKS.filter((l) => !l.href.includes('#')).map((l) => (
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
            <a className="btn btn--small nav__cta" href={quoteHref()}>
              Get a quote
            </a>
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
