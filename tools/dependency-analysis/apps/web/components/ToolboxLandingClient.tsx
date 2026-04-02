'use client';

import { useEffect } from 'react';
import { purge } from '@/lib/api';

/** Clears in-browser assessment session when visiting the toolbox home (legacy home behavior). */
export function ToolboxLandingClient() {
  useEffect(() => {
    purge().catch(() => {});
  }, []);
  return null;
}
