import type { Metadata } from 'next';
import { CisaCommandHero } from '@/components/CisaCommandHero';
import { loadToolboxManifest } from '@/lib/toolboxManifest';
import '@/styles/toolbox-landing.css';

export const metadata: Metadata = {
  title: 'Hotel Operational Security Toolkit | CISA',
  description: 'Web-based HOST launcher for the hospitality assessment workspace.',
  applicationName: 'CISA HOST',
};

export default async function HotelAnalysisPage() {
  const manifest = await loadToolboxManifest();
  const hostTool = manifest?.tools.find((tool) => tool.id === 'hotel-analysis');

  return (
    <main className="psa-toolbox-landing">
      <div className="psa-toolbox-landing__hero">
        <CisaCommandHero
          topbandSub="Hotel Operational Security Toolkit"
          eyebrow="HOST"
          title="Hotel Operational Security Toolkit"
          subtitle="Open the hospitality assessment workspace in the browser. This is the web-based HOST entry point used by the toolbox."
          cta={{ href: '/hotel-analysis/', label: 'Open HOST' }}
          chips={[
            { label: 'Hospitality' },
            { label: 'Security review' },
            { label: 'Web app' },
          ]}
          howItFitsHeading="Entry point"
          howItFits={[
            {
              title: 'Open the web app',
              body: 'HOST is served through the Next.js app, so the landing page is always available at /hotel-analysis/.',
            },
            {
              title: 'Follow the canonical link',
              body: 'Legacy bookmarks can still point at HOST V3 while the current web entry remains the landing page.',
            },
            {
              title: 'Keep it browser based',
              body: 'No standalone installation is required to use the hosted HOST workspace.',
            },
          ]}
        />
      </div>

      <section className="cisa-doc psa-toolbox-landing__tools">
        <header className="psa-toolbox-landing__tools-header">
          <div className="psa-toolbox-landing__tools-intro">
            <h2 className="psa-toolbox-section-title">Launch HOST</h2>
            <p className="psa-toolbox-section-lede">
              {hostTool?.description ??
                'Use HOST from the browser and keep the assessment workflow in the web app.'}
            </p>
          </div>
        </header>
        <div className="cisa-callout" role="note">
          <strong>Primary route:</strong> <a href="/hotel-analysis/">/hotel-analysis/</a>
        </div>
      </section>
    </main>
  );
}
