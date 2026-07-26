/** Company details used across the site chrome and contact blocks. */
export const SITE = {
  name: 'Sigma Alutech',
  tagline: 'Architecture, framed in aluminium.',
  lead:
    'Premium fenestration for homes, hotels and industry. Bangalore, since 2000.',
  city: 'Bangalore',
  established: 2000,
  address: 'Bangalore, Karnataka, India',
  email: 'prajwal.nagaraja@sigmaalutech.com',
  phoneDisplay: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  whatsapp: 'https://wa.me/919876543210',
  hours: 'Mon – Sat: 9:00 AM – 6:00 PM',
  mapEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d248849.84916296514!2d77.49085452924316!3d12.954517008845028!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae1670c9b44e6d%3A0xf8dfc3e8517e4fe0!2sBengaluru%2C%20Karnataka%2C%20India!5e0!3m2!1sen!2sus!4v1706000000000!5m2!1sen!2sus',
} as const;

export const NAV_LINKS = [
  { href: '/products', label: 'Products' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
  { href: '/about#contact', label: 'Contact' },
] as const;

/** Quote request mailto with a helpful prefilled subject. */
export function quoteHref(subject?: string): string {
  const line = subject
    ? `Enquiry — ${subject}`
    : 'Enquiry — Sigma Alutech';
  return `mailto:${SITE.email}?subject=${encodeURIComponent(line)}`;
}
