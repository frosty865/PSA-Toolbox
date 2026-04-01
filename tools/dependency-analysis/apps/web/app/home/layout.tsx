import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home · Infrastructure Dependency Assessment | PSA Toolbox',
  description: 'IDA — operational entry',
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
