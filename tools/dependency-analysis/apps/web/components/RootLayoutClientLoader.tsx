'use client';

import { AssessmentProvider } from '@/lib/assessment-context';
import CisaHeader from '@/components/branding/CisaHeader';
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

/** Landing (/) has no chrome; IDA routes and /t/… use CisaHeader. Static /hotel-analysis/* is served from public/ (no React shell). */
export function RootLayoutClientLoader({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isLanding = pathname === '/' || pathname === '';
  const isHotelAnalysis = pathname.startsWith('/hotel-analysis');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (isDev()) return;
    if (window.location.protocol === 'file:') return;
    const prefix = (process.env.NEXT_PUBLIC_FIELD_STATIC_BASE_PATH ?? '').replace(/\/$/, '');
    const swPath = `${prefix}/sw.js`.replace(/\/+/g, '/');
    navigator.serviceWorker.register(swPath.startsWith('/') ? swPath : `/${swPath}`).catch(() => {});
  }, []);

  return (
    <AssessmentProvider>
      <div className="ida-app">
        {isLanding || isHotelAnalysis ? (
          <div className="container">{children}</div>
        ) : (
          <>
            <CisaHeader variant="page" title="Infrastructure Dependency Tool (IDT)" />
            <div className="container">{children}</div>
          </>
        )}
      </div>
    </AssessmentProvider>
  );
}
