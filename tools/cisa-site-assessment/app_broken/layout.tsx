import Link from 'next/link';
import './globals.css';
import USWDSInit from './components/USWDSInit';
import TaxonomyDropdown from './components/TaxonomyDropdown';
import DoctrineValidator from './components/DoctrineValidator';

export const metadata = {
  title: 'PSA Processing Monitor',
  description: 'System status and processing visibility for PSA assessments'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DoctrineValidator />
        <USWDSInit />
        <header className="header">
          <div className="header-content">
            <div className="logo">
              <Link href="/assessments" className="logo-text">
                <h1>Protective Security Assessment System</h1>
              </Link>
            </div>
            <nav className="nav-links">
              <Link href="/assessments" className="nav-link">Assessments</Link>
              <TaxonomyDropdown />
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
