'use client';

import { AssessmentProvider } from '@/lib/assessment-context';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <AssessmentProvider>{children}</AssessmentProvider>;
}
