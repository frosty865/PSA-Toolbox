import Link from 'next/link';
import './globals.css';
import './styles/mobile.css';

export const metadata = {
  title: 'PSA Processing Monitor',
  description: 'System status and processing visibility for PSA assessments',
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
        {/* Temporarily minimal layout to debug loading issue */}
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

