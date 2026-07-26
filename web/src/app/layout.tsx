import type { Metadata } from 'next';
import { Marcellus, Jost } from 'next/font/google';
import '@/styles/variables.css';
import '@/styles/base.css';
import '@/styles/layout.css';
import '@/styles/components.css';
import '@/styles/pages.css';
import '@/styles/admin.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { RevealObserver } from '@/components/RevealObserver';

const marcellus = Marcellus({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-marcellus',
});

const jost = Jost({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jost',
});

export const metadata: Metadata = {
  title: {
    default: 'Sigma Alutech | Premium Aluminium Fabrication | Bangalore',
    template: '%s | Sigma Alutech',
  },
  description:
    'Sigma Alutech — premium aluminium fabrication and an authorized Technal partner in Bangalore. Windows, doors, facades, sliding systems and balustrades since 2000.',
};

// Applies the stored theme before first paint so there is no flash.
const themeInit = `(function(){try{var t=localStorage.getItem('sigma-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${marcellus.variable} ${jost.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <Nav />
        {children}
        <Footer />
        <RevealObserver />
      </body>
    </html>
  );
}
