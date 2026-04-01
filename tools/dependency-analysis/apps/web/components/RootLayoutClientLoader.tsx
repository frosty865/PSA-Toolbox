'use client';

import { AssessmentProvider } from '@/lib/assessment-context';
import IdaHeader from '@/components/branding/IdaHeader';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

function isDev(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.host)
  );
}

/** Single client boundary: inlines shell to avoid RSC lazy "promise resolves to undefined" error. */
export function RootLayoutClientLoader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  /** Unified toolbox shell: no IDA header on landing or Host V3 product routes */
  const isToolboxShell =
    pathname === '/' || pathname === '' || pathname.startsWith('/host-v3');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (isDev()) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return (
    <AssessmentProvider>
      <div className="ida-app">
        {isToolboxShell ? (
          <div className="container">{children}</div>
        ) : (
          <>
            <IdaHeader variant="page" />
            <div className="container">{children}</div>
          </>
        )}
      </div>
    </AssessmentProvider>
  );
}
