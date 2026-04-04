import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Infrastructure Dependency Tool',
  description: 'About the Infrastructure Dependency Tool (IDT) and service owner.',
};

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.6 }}>
      <h1>About</h1>
      <p>
        The Infrastructure Dependency Tool (IDT) helps organizations map critical service
        dependencies, assess disruption impact, and produce deterministic reporting outputs.
      </p>
      <p>
        This service is operated by Zophiel Group for assessment and planning workflows.
      </p>
    </main>
  );
}
