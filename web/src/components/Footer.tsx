'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null; // admin area has its own chrome
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div
              className="nav__logo-text"
              style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}
            >
              SIGMA <span style={{ color: 'var(--gold-primary)' }}>ALUTECH</span>
            </div>
            <p className="footer__brand-text">
              Premium aluminium fabrication solutions. Authorized Technal partner delivering
              French engineering excellence in India since 2000.
            </p>
          </div>

          <div>
            <h4 className="footer__heading">Quick Links</h4>
            <Link href="/#about" className="footer__link">About Us</Link>
            <Link href="/products" className="footer__link">Products</Link>
            <Link href="/projects" className="footer__link">Projects</Link>
            <Link href="/#contact" className="footer__link">Contact</Link>
          </div>

          <div>
            <h4 className="footer__heading">Products</h4>
            <Link href="/products#windows" className="footer__link">Windows</Link>
            <Link href="/products#doors" className="footer__link">Doors</Link>
            <Link href="/products#sliding" className="footer__link">Sliding Systems</Link>
            <Link href="/products#facades" className="footer__link">Facades</Link>
            <Link href="/products#balustrades" className="footer__link">Balustrades</Link>
            <Link href="/products#handles" className="footer__link">Handles</Link>
          </div>
        </div>

        <div className="footer__bottom">
          <span className="footer__copyright">
            &copy; {new Date().getFullYear()} Sigma Alutech. All rights reserved.
          </span>
          <span className="footer__formerly">
            Formerly Ravi Enterprises &bull; Established 2000
          </span>
        </div>
      </div>
    </footer>
  );
}
