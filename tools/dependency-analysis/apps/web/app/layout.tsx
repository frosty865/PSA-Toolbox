import type { Metadata } from 'next';
/* USWDS v3 — U.S. Web Design System stylesheet (npm package). Host V3 product code lives under tools/host-v3/, not here. */
import '@uswds/uswds/css/uswds.min.css';
import './globals.css';
import './ida-design-system.css';
/* PSA Toolbox branding: shared/cisa_styles.css (+ tokens in public/tsp-global.css; see repo shared/psa-tokens.css) */
import '../../../../../shared/cisa_styles.css';
import { RootLayoutClientLoader } from '@/components/RootLayoutClientLoader';

export const metadata: Metadata = {
  title: 'Infrastructure Dependency Assessment | PSA Toolbox',
  description:
    'PSA Infrastructure Dependency Assessment supports structured dependency review and portfolio reporting.',
  applicationName: 'PSA IDA',
  openGraph: {
    title: 'Infrastructure Dependency Assessment | PSA Toolbox',
    description:
      'PSA Infrastructure Dependency Assessment supports structured dependency review and portfolio reporting.',
    siteName: 'PSA Toolbox',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Infrastructure Dependency Assessment | PSA Toolbox',
    description:
      'PSA Infrastructure Dependency Assessment supports structured dependency review and portfolio reporting.',
  },
  icons: {
    icon: '/psa-logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* No remote fonts/CDNs for offline-first and compliance (see docs/SECURITY.md) */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href="/tsp-global.css" />
      </head>
      <body className="tsp-theme" data-brand="psa">
        <RootLayoutClientLoader>{children}</RootLayoutClientLoader>
      </body>
    </html>
  );
}
