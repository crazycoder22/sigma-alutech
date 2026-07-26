import { SITE, quoteHref } from '@/lib/site';

interface Props {
  title?: string;
  text?: string;
  subject?: string;
}

/** The dark "Planning a project?" call-to-action that closes each page. */
export function Enquiry({
  title = 'Planning a project?',
  text = "Tell us about your site — we'll recommend the right systems and share a detailed quote.",
  subject,
}: Props) {
  return (
    <section className="ink enquiry">
      <div className="container">
        <div className="enquiry__inner">
          <h2 className="enquiry__title">{title}</h2>
          <p className="enquiry__text">{text}</p>
          <div className="enquiry__actions">
            <a className="btn btn--on-ink" href={quoteHref(subject)}>
              Request a quote
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
      </div>
    </section>
  );
}
