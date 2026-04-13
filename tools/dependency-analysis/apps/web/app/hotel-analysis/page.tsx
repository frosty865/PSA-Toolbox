import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hotel Operational Security Toolkit | CISA',
  description: 'Web-based HOST viewer for the hospitality assessment workspace.',
  applicationName: 'CISA HOST',
};

export default function HotelAnalysisPage() {
  return (
    <main style={{ width: '100%', minHeight: '100vh', background: '#f4f7fb' }}>
      <iframe
        title="Hotel Operational Security Toolkit"
        src="/hotel-analysis/HOST%20V3.html"
        style={{ border: 0, width: '100%', minHeight: '100vh', display: 'block' }}
      />
    </main>
  );
}
