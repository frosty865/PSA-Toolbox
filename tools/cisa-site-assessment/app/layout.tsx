import Link from 'next/link';
import './globals.css';
import './styles/mobile.css';
import CisaApiBasePathShim from './components/CisaApiBasePathShim';

export const metadata = {
  title: 'CISA Site Assessment',
  description: 'Protective Security Assessment workflow for CISA site assessments',
  icons: { icon: '/favicon.ico' }
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
            <nav className="nav-links">
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

