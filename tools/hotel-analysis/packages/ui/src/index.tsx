import * as React from 'react';

/** Basic page layout wrapper */
export function PageLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem 1.5rem' }}>
      {title ? <h1 style={{ marginTop: 0 }}>{title}</h1> : null}
      {children}
    </div>
  );
}

/** Section with optional heading */
export function Section({
  children,
  heading,
}: {
  children: React.ReactNode;
  heading?: string;
}) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      {heading ? <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>{heading}</h2> : null}
      {children}
    </section>
  );
}

/** Simple container for grouping content */
export function Container({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: '1rem' }}>{children}</div>;
}

export { HelpIcon } from './HelpIcon';
export type { HelpIconProps } from './HelpIcon';
