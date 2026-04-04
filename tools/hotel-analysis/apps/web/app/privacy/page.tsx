import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy | Infrastructure Dependency Tool',
  description: 'Privacy notice for the Infrastructure Dependency Tool (IDT).',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.6 }}>
      <h1>Privacy Notice</h1>
      <p>
        This site is used for operational assessment workflows. Assessment data is processed to
        support session-based analysis and report generation.
      </p>
      <p>
        If you have privacy-related questions or need assistance, contact{' '}
        <a href="mailto:contact@zophielgroup.com">contact@zophielgroup.com</a>.
      </p>
    </main>
  );
}
