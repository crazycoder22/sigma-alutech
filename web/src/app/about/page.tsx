import type { Metadata } from 'next';
import { getProjects, getSiteStats } from '@/lib/catalog';
import { Enquiry } from '@/components/Enquiry';
import { SITE, quoteHref } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Sigma Alutech fabricates and installs premium aluminium fenestration in Bangalore — an authorized Technal partner since 2000.',
};

export default async function AboutPage() {
  const [stats, projects] = await Promise.all([getSiteStats(), getProjects()]);

  // Lead with a real project photograph rather than a placeholder.
  const showcase =
    projects.find((p) => p.images.length)?.images[0] ??
    projects.find((p) => p.thumbnail)?.thumbnail ??
    '/images/hero/hero-1.svg';

  return (
    <>
      <section className="container">
        <div className="page-intro">
          <span className="eyebrow">About us</span>
          <h1 className="page-intro__title">Twenty-five years of aluminium craft</h1>
          {/* One expression: JSX drops the space after `}` when the text wraps. */}
          <p className="page-intro__lead">
            {`Founded in ${SITE.city} in ${SITE.established}, ${SITE.name} fabricates and installs premium aluminium fenestration — windows, doors, facades and balustrades — for the region's most demanding residential, hospitality and industrial projects.`}
          </p>
        </div>

        <div className="media about__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={showcase} alt={`${SITE.name} project work`} />
        </div>

        <div className="about-card">
          <span className="label">Technal partnership</span>
          <h2 className="about-card__title">Authorized Technal Partner</h2>
          <p className="about-card__text">
            Every system we install is engineered by Technal, the French aluminium
            specialist — tested for wind, water and acoustic performance to European
            standards, and supplied in India through Hydro BS India.
          </p>
        </div>

        <div className="stats stats--quad">
          <div className="stat">
            <div className="stat__number">25+</div>
            <div className="stat__label">Years in business</div>
          </div>
          <div className="stat">
            <div className="stat__number">{stats.projects}</div>
            <div className="stat__label">Landmark projects</div>
          </div>
          <div className="stat">
            <div className="stat__number">{stats.categories}</div>
            <div className="stat__label">Product categories</div>
          </div>
          <div className="stat">
            <div className="stat__number">30+</div>
            <div className="stat__label">Skilled technicians</div>
          </div>
        </div>

        <div className="split" id="contact">
          <div className="contact-block">
            <h2 className="contact-block__title">Visit or write to us</h2>
            <div className="contact-block__lines">
              {SITE.address}
              <br />
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              <br />
              <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a>
              <br />
              {SITE.hours}
            </div>
            <div className="contact-block__actions">
              <a className="btn btn--primary" href={quoteHref()}>
                Enquire
              </a>
              <a
                className="btn btn--outline"
                href={SITE.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </div>

          <div className="map">
            <iframe
              src={SITE.mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${SITE.name} location`}
            ></iframe>
          </div>
        </div>
      </section>

      <Enquiry />
    </>
  );
}
