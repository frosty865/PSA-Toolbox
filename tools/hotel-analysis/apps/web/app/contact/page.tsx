import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | Infrastructure Dependency Tool',
  description: 'Contact information for support and business inquiries.',
};

export default function ContactPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.6 }}>
      <h1>Contact</h1>
      <p>For support, access, or business inquiries, contact the service owner:</p>
      <ul>
        <li>
          Email: <a href="mailto:contact@zophielgroup.com">contact@zophielgroup.com</a>
        </li>
        <li>
          Security reports: <a href="/security/">Security policy</a>
        </li>
      </ul>
    </main>
  );
}
