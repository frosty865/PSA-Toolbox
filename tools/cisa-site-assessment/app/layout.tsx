import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './styles/mobile.css';
import CisaApiBasePathShim from './components/CisaApiBasePathShim';

function metadataBaseFromEnv(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw.endsWith('/') ? raw.slice(0, -1) : raw);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBaseFromEnv(),
  title: 'Modular Site Assessment',
  description:
    'Modular assessment for Protective Security Advisors—flexible assessments by sector and subsector.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CisaApiBasePathShim />
        {/* App shell for the CISA site-assessment workflow */}
        <header className="header">
          <div className="header-content">
            <div className="logo">
              <Link href="/" className="logo-text">
                <h1>Protective Security Assessment System</h1>
              </Link>
            </div>
            <nav className="nav-links" aria-label="Primary">
              <Link href="/" className="nav-link">Home</Link>
              <Link href="/assessments" className="nav-link">Assessments</Link>
              <Link href="/admin" className="nav-link">Admin</Link>
            </nav>
          </div>
        </header>
        <main id="main-content" className="container">
          {children}
        </main>
      </body>
    </html>
  );
}

