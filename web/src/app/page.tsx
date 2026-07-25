import Link from 'next/link';
import { getFeaturedProjects, getCatalog } from '@/lib/catalog';
import { HeroSlider } from '@/components/HeroSlider';

export const dynamic = 'force-dynamic';

const CATEGORY_GRADIENTS: Record<string, string> = {
  windows: 'linear-gradient(135deg, #1a1a2e, #2a2a3e)',
  doors: 'linear-gradient(135deg, #1a2a1a, #2a3a2a)',
  sliding: 'linear-gradient(135deg, #2a1a1a, #3a2a2a)',
  facades: 'linear-gradient(135deg, #1a1a2e, #1e2a3e)',
  balustrades: 'linear-gradient(135deg, #2a2a1a, #3a3a2a)',
  handles: 'linear-gradient(135deg, #1e1e2e, #2e2e3e)',
};

const WHY_US = [
  {
    title: 'Technal Certified',
    text: 'Authorized franchisee of Technal by Hydro — world-class French aluminium systems.',
    icon: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></>,
  },
  {
    title: '25+ Years Experience',
    text: 'Proven track record since 2000 across residential, commercial, and industrial projects.',
    icon: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
  },
  {
    title: 'Complete Insulation',
    text: 'Superior thermal, acoustic, and water insulation for maximum comfort and energy savings.',
    icon: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  },
  {
    title: '100+ Color Options',
    text: 'Anodized and powder coated finishes using premium Akzonobel and Jotun coatings, including wood finishes.',
    icon: <><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></>,
  },
  {
    title: 'Maintenance Free',
    text: 'Once installed, our products require zero maintenance, ensuring long-lasting performance.',
    icon: <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94L6.7 20.17a2.5 2.5 0 01-3.54-3.54l6.7-6.73a6 6 0 017.94-7.94L14.7 6.3z" />,
  },
  {
    title: 'Expert Installation',
    text: '30+ well-trained technicians providing end-to-end solutions from design to installation.',
    icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
  },
];

export default async function HomePage() {
  const [featured, catalog] = await Promise.all([getFeaturedProjects(), getCatalog()]);

  return (
    <>
      {/* ========== HERO ========== */}
      <section className="hero" id="hero">
        <HeroSlider />
        <div className="hero__overlay"></div>

        <div className="hero__content">
          <div className="hero__partner">
            <span className="hero__partner-line"></span>
            Authorized Technal Partner
            <span className="hero__partner-line"></span>
          </div>
          <h1 className="hero__title">Sigma Alutech</h1>
          <p className="hero__tagline">
            Premium aluminium fabrication solutions for residential, commercial, and industrial
            spaces. Delivering excellence in Bangalore since 2000.
          </p>
          <div className="hero__cta">
            <Link href="/products" className="btn btn--primary">Explore Products</Link>
            <Link href="/projects" className="btn btn--outline">View Projects</Link>
          </div>
        </div>

        <div className="hero__scroll-indicator">
          <span>Scroll</span>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 4v16M8 20l-4-4M8 20l4-4" />
          </svg>
        </div>
      </section>

      {/* ========== ABOUT ========== */}
      <section className="section" id="about">
        <div className="container">
          <div className="split-section">
            <div className="about__image-container reveal">
              { }
              <img src="/images/hero/hero-1.svg" alt="Sigma Alutech aluminium fabrication project" />
              <div className="about__image-accent"></div>
            </div>

            <div className="reveal reveal-delay-1">
              <span className="section-label">About Us</span>
              <h2 className="section-title">Crafting Precision in Aluminium Since 2000</h2>
              <p className="about__text">
                Sigma Alutech is a premier aluminium fabrication firm and an authorized franchisee
                of Hydro BS India Private Limited, representing the world-renowned Technal brand
                from France. With over two decades of expertise, we deliver end-to-end solutions
                from topology design to product installation.
              </p>
              <p className="about__text">
                Led by Prajwal N (IIM-Trichy) and supported by Mr. Nagaraja M, our team of 30+
                skilled technicians has successfully executed projects spanning luxury hotels,
                high-rise apartments, manufacturing plants, and institutional buildings across
                South India.
              </p>

              <div className="about__partner-note">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold-primary)" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <p>
                  Authorized partner of <strong>Technal by Hydro</strong> &mdash; the world&apos;s
                  largest extruders of aluminium, bringing French engineering excellence to India.
                </p>
              </div>
            </div>
          </div>

          <div className="stats mt-2xl reveal">
            <div className="stat">
              <div className="stat__number">25+</div>
              <div className="stat__label">Years of Experience</div>
            </div>
            <div className="stat">
              <div className="stat__number">30+</div>
              <div className="stat__label">Skilled Technicians</div>
            </div>
            <div className="stat">
              <div className="stat__number">29</div>
              <div className="stat__label">Major Projects</div>
            </div>
            <div className="stat">
              <div className="stat__number">100+</div>
              <div className="stat__label">Color Options</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== PRODUCT CATEGORIES ========== */}
      <section className="section section--alt" id="products">
        <div className="container">
          <div className="section-header reveal">
            <span className="section-label">Our Products</span>
            <h2 className="section-title">Premium Aluminium Systems</h2>
            <p className="section-subtitle">
              A comprehensive range of Technal-certified aluminium solutions designed for superior
              performance, aesthetics, and durability.
            </p>
          </div>

          <div className="grid-3" id="categoryGrid">
            {catalog.map((cat, i) => (
              <Link
                key={cat.slug}
                href={`/products#${cat.slug}`}
                className={`category-card reveal reveal-delay-${(i % 3) + 1}`}
              >
                <div
                  className="category-card__image"
                  style={{
                    background: CATEGORY_GRADIENTS[cat.slug] ?? CATEGORY_GRADIENTS.windows,
                    width: '100%',
                    height: '100%',
                  }}
                ></div>
                <div className="category-card__overlay">
                  <div className="category-card__name">{cat.name}</div>
                  <div className="category-card__desc">{cat.description}</div>
                  <div className="category-card__arrow">
                    Explore <span>&rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-2xl">
            <Link href="/products" className="btn btn--outline">View All Products</Link>
          </div>
        </div>
      </section>

      {/* ========== FEATURED PROJECTS ========== */}
      <section className="section" id="projects">
        <div className="container">
          <div className="section-header reveal">
            <span className="section-label">Our Portfolio</span>
            <h2 className="section-title">Projects That Define Us</h2>
            <p className="section-subtitle">
              From five-star hotels to luxury villas and industrial facilities, our work speaks for
              itself.
            </p>
          </div>

          <div className="featured-projects__grid" id="featuredProjectsGrid">
            {featured.map((project) => (
              <div key={project.slug} className="project-card reveal visible">
                { }
                <img
                  className="project-card__image"
                  src={project.thumbnail}
                  alt={project.name}
                  loading="lazy"
                />
                <div className="project-card__overlay">
                  <div className="project-card__category">{project.categoryName}</div>
                  <div className="project-card__name">{project.name}</div>
                  <div className="project-card__meta">
                    {project.location} &bull; {project.year}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-2xl">
            <Link href="/projects" className="btn btn--outline">View All Projects</Link>
          </div>
        </div>
      </section>

      {/* ========== WHY CHOOSE US ========== */}
      <section className="section section--alt" id="why-us">
        <div className="container">
          <div className="section-header reveal">
            <span className="section-label">Why Choose Us</span>
            <h2 className="section-title">The Sigma Alutech Advantage</h2>
          </div>

          <div className="why-us__grid">
            {WHY_US.map((item, i) => (
              <div key={item.title} className={`why-us__item reveal reveal-delay-${(i % 3) + 1}`}>
                <div className="why-us__icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gold-primary)" strokeWidth="1.5">
                    {item.icon}
                  </svg>
                </div>
                <h4 className="why-us__item-title">{item.title}</h4>
                <p className="why-us__item-text">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CONTACT ========== */}
      <section className="section" id="contact">
        <div className="container">
          <div className="section-header reveal">
            <span className="section-label">Get In Touch</span>
            <h2 className="section-title">Contact Us</h2>
            <p className="section-subtitle">
              Reach out for consultations, quotes, or to learn more about our products and
              services.
            </p>
          </div>

          <div className="contact__grid">
            <div className="reveal">
              <div className="contact__item">
                <div className="contact__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <div className="contact__label">Office Address</div>
                  <div className="contact__value">Bangalore, Karnataka, India</div>
                </div>
              </div>

              <div className="contact__item">
                <div className="contact__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </div>
                <div>
                  <div className="contact__label">Phone</div>
                  <div className="contact__value">
                    <a href="tel:+919876543210">+91 98765 43210</a>
                  </div>
                </div>
              </div>

              <div className="contact__item">
                <div className="contact__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                </div>
                <div>
                  <div className="contact__label">Email</div>
                  <div className="contact__value">
                    <a href="mailto:prajwal.nagaraja@sigmaalutech.com">prajwal.nagaraja@sigmaalutech.com</a>
                  </div>
                </div>
              </div>

              <div className="contact__item">
                <div className="contact__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <div className="contact__label">Business Hours</div>
                  <div className="contact__value">Mon - Sat: 9:00 AM - 6:00 PM</div>
                </div>
              </div>

              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="contact__whatsapp"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Chat on WhatsApp
              </a>
            </div>

            <div className="contact__map reveal reveal-delay-1">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d248849.84916296514!2d77.49085452924316!3d12.954517008845028!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae1670c9b44e6d%3A0xf8dfc3e8517e4fe0!2sBengaluru%2C%20Karnataka%2C%20India!5e0!3m2!1sen!2sus!4v1706000000000!5m2!1sen!2sus"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Sigma Alutech Location"
              ></iframe>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
