'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SITE } from '@/lib/site';

const PRODUCT_LINKS = [
  { slug: 'windows', label: 'Windows' },
  { slug: 'doors', label: 'Doors' },
  { slug: 'sliding', label: 'Sliding Systems' },
  { slug: 'facades', label: 'Facades' },
  { slug: 'balustrades', label: 'Balustrades' },
  { slug: 'handles', label: 'Handles' },
];

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null; // admin has its own chrome

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__logo">
              SIGMA <span>ALUTECH</span>
            </div>
            <p className="footer__text">
              Premium aluminium fabrication and an authorized Technal partner, delivering
              French engineering to {SITE.city} since {SITE.established}.
            </p>
          </div>

          <div>
            <h4 className="footer__heading">Explore</h4>
            <Link href="/products" className="footer__link">Products</Link>
            <Link href="/projects" className="footer__link">Projects</Link>
            <Link href="/about" className="footer__link">About</Link>
            <Link href="/about#contact" className="footer__link">Contact</Link>
          </div>

          <div>
            <h4 className="footer__heading">Systems</h4>
            {PRODUCT_LINKS.map((p) => (
              <Link key={p.slug} href={`/products?category=${p.slug}`} className="footer__link">
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </span>
          <span>
            Formerly Ravi Enterprises · {SITE.city}, since {SITE.established}
          </span>
        </div>
      </div>
    </footer>
  );
}
