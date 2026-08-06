'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SITE, quoteHref } from '@/lib/site';

/**
 * Closing call-to-action and footer as a single ink block, matching the
 * desktop design. Detail pages that carry their own CTA hide the pitch.
 */
export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null; // admin has its own chrome

  const isProjectDetail = /^\/projects\/[^/]+$/.test(pathname);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          {isProjectDetail ? (
            <div className="footer__pitch">
              <div className="footer__logo" style={{ fontSize: '1.5rem' }}>
                SIGMA <span>ALUTECH</span>
              </div>
              <p className="footer__lead">
                Premium aluminium fabrication and an authorized Technal partner,
                delivering French engineering to {SITE.city} since {SITE.established}.
              </p>
            </div>
          ) : (
            <div className="footer__pitch">
              <h2 className="footer__title">Planning a project?</h2>
              <p className="footer__lead">
                Send us your drawings or a short brief. We&apos;ll recommend the right
                systems, finishes and glazing — and share a detailed quote within three
                working days.
              </p>
              <div className="footer__actions">
                <a className="btn btn--on-ink" href={quoteHref()}>
                  Request a quote
                </a>
                <a
                  className="btn btn--ghost-ink"
                  href={SITE.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp us
                </a>
              </div>
            </div>
          )}

          <div className="footer__cols">
            <div>
              <h3 className="footer__heading">Explore</h3>
              <Link href="/products" className="footer__link">Products</Link>
              <Link href="/projects" className="footer__link">Projects</Link>
              <Link href="/about" className="footer__link">About</Link>
              <Link href="/about#contact" className="footer__link">Contact</Link>
            </div>
            <div>
              <h3 className="footer__heading">Reach us</h3>
              <div className="footer__lines">
                {SITE.address}
                <br />
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                <br />
                <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a>
              </div>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__logo">
            SIGMA <span>ALUTECH</span>
          </div>
          <div className="footer__fine">
            © {new Date().getFullYear()} {SITE.name} · Authorized Technal Partner
          </div>
        </div>

        {/* Build credit, kept clearly separate from the copyright above:
            Dyuthix built the software, Sigma Alutech owns the business. */}
        <div className="footer__credit">
          Designed and developed by{' '}
          <a href={SITE.developerUrl} target="_blank" rel="noopener noreferrer">
            {SITE.developer}
          </a>
        </div>
      </div>
    </footer>
  );
}
