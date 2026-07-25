'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/products', label: 'Products' },
  { href: '/projects', label: 'Projects' },
  { href: '/#contact', label: 'Contact' },
];

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');
  const [scrolled, setScrolled] = useState(!isHome);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', menuOpen);
    return () => document.body.classList.remove('no-scroll');
  }, [menuOpen]);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (isAdmin) return null; // admin area has its own chrome

  return (
    <nav className={`nav${isHome ? ' nav--overlay' : ''}${scrolled ? ' scrolled' : ''}`} id="nav">
      <div className="container nav__inner">
        <Link href="/" className="nav__logo">
          <div className="nav__logo-text">
            SIGMA <span>ALUTECH</span>
          </div>
        </Link>

        <div className="nav__links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav__link${pathname === l.href ? ' active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex-center gap-md">
          <ThemeToggle />
          <div
            className={`nav__hamburger${menuOpen ? ' open' : ''}`}
            aria-label="Toggle menu"
            role="button"
            tabIndex={0}
            onClick={() => setMenuOpen((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setMenuOpen((v) => !v)}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <div
        className={`nav__mobile-overlay${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
      ></div>
      <div className={`nav__mobile${menuOpen ? ' open' : ''}`}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="nav__mobile-link"
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
