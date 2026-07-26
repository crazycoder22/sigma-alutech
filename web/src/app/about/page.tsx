import type { Metadata } from 'next';
import { getProjects, getSiteStats } from '@/lib/catalog';
import { SITE, quoteHref } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Sigma Alutech fabricates and installs premium aluminium fenestration in Bangalore — an authorized Technal partner since 2000.',
};

const STEPS = [
  {
    title: 'Survey & system selection',
    note: 'Site visit, drawings review, glazing spec',
  },
  {
    title: 'Shop drawings & approval',
    note: 'Fabrication drawings signed off with the architect',
  },
  {
    title: 'In-house fabrication',
    note: 'Cut, machined and assembled in Bangalore',
  },
  {
    title: 'Installation & handover',
    note: 'Own crews, snag list closed before sign-off',
  },
];

export default async function AboutPage() {
  const [stats, projects] = await Promise.all([getSiteStats(), getProjects()]);

  // Lead with real project photography rather than a placeholder.
  const withPhotos = projects.filter((p) => p.images.length);
  const showcase = withPhotos[0]?.images[0] ?? projects[0]?.thumbnail ?? '/images/hero/hero-1.svg';
  const secondary =
    withPhotos[1]?.images[0] ?? withPhotos[0]?.images[1] ?? '/images/hero/hero-2.svg';

  return (
    <>
      <section className="container">
        <div className="about-intro">
          <div className="about-intro__copy">
            <span className="eyebrow">About us</span>
            <h1 className="about-intro__title">Twenty-five years of aluminium craft</h1>
            <p className="about-intro__text">
              {`Founded in ${SITE.city} in ${SITE.established}, ${SITE.name} fabricates and installs premium aluminium fenestration — windows, doors, facades and balustrades — for the region's most demanding residential, hospitality and industrial projects.`}
            </p>
            <p className="about-intro__text">
              We work directly with architects and main contractors from shop drawings
              through to handover, with our own fabrication shop and installation crews.
              That single line of accountability is why clients like Brigade, Bosch and
              GITAM come back.
            </p>
          </div>
          <div className="media about-intro__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={showcase} alt={`${SITE.name} project work`} />
          </div>
        </div>
      </section>

      <div className="stats stats--band">
        <div className="stat">
          <div className="stat__number">{SITE.established}</div>
          <div className="stat__label">Founded</div>
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
          <div className="stat__number">{stats.products}</div>
          <div className="stat__label">Systems supplied</div>
        </div>
      </div>

      <section className="container">
        <div className="about-panels">
          <div className="about-panel about-panel--tint">
            <span className="label">Technal partnership</span>
            <h2 className="about-panel__title">Authorized Technal Partner</h2>
            <p className="about-panel__text">
              Every system we install is engineered by Technal, the French aluminium
              specialist — tested for wind load, water tightness and acoustic performance
              to European standards, then fabricated to their tolerances in our workshop.
            </p>
          </div>

          <div className="about-panel">
            <span className="label">How we work</span>
            <div className="steps">
              {STEPS.map((step, i) => (
                <div className="step" key={step.title}>
                  <span className="step__num">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="step__title">{step.title}</span>
                    <span className="step__note" style={{ display: 'block' }}>
                      {step.note}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="contact-band" id="contact">
        <div className="container">
          <div className="contact-band__grid">
            <div className="contact-band__copy">
              <h2 className="contact-band__title">Visit or write to us</h2>
              <div className="contact-band__lines">
                {SITE.address}
                <br />
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                <br />
                <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a>
                <br />
                {SITE.hours}
              </div>
              <div className="contact-band__actions">
                <a className="btn btn--on-ink" href={quoteHref()}>
                  Enquire now
                </a>
                <a
                  className="btn btn--ghost-ink"
                  href={SITE.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </div>
            </div>
            <div className="media contact-band__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={secondary} alt={`${SITE.name} installation`} />
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: 'var(--section-padding) var(--gutter)' }}>
        <div className="map">
          <iframe
            src={SITE.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${SITE.name} location`}
          ></iframe>
        </div>
      </section>
    </>
  );
}
