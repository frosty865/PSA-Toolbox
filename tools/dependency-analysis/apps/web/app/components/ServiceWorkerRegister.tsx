'use client';

import { useEffect } from 'react';

/** Skip SW registration in dev so changes replicate immediately. */
function isDev(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.host)
  );
}

/** Registers the service worker for offline caching. Safe to run in browser only. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (isDev()) return; // Don't cache during development; changes must replicate to server
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
