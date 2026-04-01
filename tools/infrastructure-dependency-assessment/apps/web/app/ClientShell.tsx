'use client';

import { AssessmentProvider } from '@/lib/assessment-context';
import IdaHeader from '@/components/branding/IdaHeader';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/** Skip SW registration in dev so changes replicate immediately. */
function isDev(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.host)
  );
}

export function ClientShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (isDev()) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return (
    <AssessmentProvider>
      <IdaHeader variant="page" />
      <div className="container">{children}</div>
    </AssessmentProvider>
  );
}
