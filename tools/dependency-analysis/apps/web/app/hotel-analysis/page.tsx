import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hotel Operational Security Toolkit | CISA',
  description: 'Web-based HOST entry point for the hospitality assessment workspace.',
  applicationName: 'CISA HOST',
};

export default function HotelAnalysisPage() {
  return (
    <main style={{ maxWidth: 960, margin: '8vh auto', padding: '24px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#10233d' }}>
      <section style={{ background: '#fff', border: '1px solid #d6deea', borderRadius: 18, boxShadow: '0 12px 32px rgba(16, 35, 61, 0.08)', padding: 28 }}>
        <p style={{ margin: '0 0 8px', color: '#0f5b9e', fontSize: '0.92rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Hotel Operational Security Toolkit
        </p>
        <h1 style={{ margin: '0 0 12px', fontSize: '2rem', lineHeight: 1.1 }}>Open the tool</h1>
        <p style={{ margin: '0 0 16px', color: '#52627a', lineHeight: 1.55 }}>
          The actual HOST pages live in the assessment app. Use the direct assessment entry point below.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li><a href="/assessment/categories/">Open the HOST assessment pages</a></li>
          <li><a href="/assessment/report/">Open the report page</a></li>
        </ul>
      </section>
    </main>
  );
}
