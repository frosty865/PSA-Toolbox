import type { Metadata } from 'next';
import './globals.css';
import './CISA_Design_System.css';
import '../styles/psa-toolbox-house.css';
import { RootLayoutClientLoader } from '@/components/RootLayoutClientLoader';

export const metadata: Metadata = {
  title: 'PSA Toolbox · Infrastructure Dependency Tool',
  description:
    'U.S. Department of Homeland Security — dependency assessment and registered PSA tools.',
  applicationName: 'PSA Toolbox',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Offline-first: fonts from public/fonts if present */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body className="tsp-theme" data-brand="psa">
        <noscript>
          <div
            style={{
              padding: '24px',
              fontFamily: 'system-ui, Segoe UI, sans-serif',
              maxWidth: '42rem',
              lineHeight: 1.5,
            }}
          >
            <strong>This application requires JavaScript.</strong>
          </div>
        </noscript>
        <RootLayoutClientLoader>{children}</RootLayoutClientLoader>
      </body>
    </html>
  );
}
