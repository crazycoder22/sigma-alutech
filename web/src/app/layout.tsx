import type { Metadata } from 'next';
import '@/styles/variables.css';
import '@/styles/base.css';
import '@/styles/layout.css';
import '@/styles/components.css';
import '@/styles/pages.css';
import '@/styles/admin.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { RevealObserver } from '@/components/RevealObserver';

export const metadata: Metadata = {
  title: 'Sigma Alutech | Premium Aluminium Fabrication | Bangalore',
  description:
    'Sigma Alutech - Premium Aluminium Fabrication. Authorized Technal partner in Bangalore offering doors, windows, facades, and curtain wall systems since 2000.',
};

const themeInit = `(function(){try{var t=localStorage.getItem('sigma-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Montserrat:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
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
