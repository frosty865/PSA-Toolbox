import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Host V3 · PSA Toolbox',
  description: 'Host V3 product shell inside the unified PSA Toolbox web application.',
};

export default function HostV3Layout({ children }: { children: ReactNode }) {
  return children;
}
