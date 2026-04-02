import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Policy | Infrastructure Dependency Tool',
  description: 'Security contact and vulnerability disclosure policy.',
};

export default function SecurityPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.6 }}>
      <h1>Security Policy</h1>
      <p>
        To report a suspected vulnerability, email{' '}
        <a href="mailto:security@zophielgroup.com">security@zophielgroup.com</a> with steps to
        reproduce, impact, and supporting evidence.
      </p>
      <p>
        Please do not disclose vulnerabilities publicly until remediation is complete.
      </p>
    </main>
  );
}
