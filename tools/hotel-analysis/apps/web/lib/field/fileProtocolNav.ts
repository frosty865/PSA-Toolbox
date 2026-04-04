/**
 * When the field bundle is opened via file://, Next's client router and root-absolute
 * paths do not work. Use these helpers for navigation and link hrefs.
 */

import { isFieldStaticMode } from '@/lib/field/isFieldStaticMode';

function depthPrefix(): string {
  if (typeof document === 'undefined') return './';
  const depth = Number(document.documentElement.getAttribute('data-idt-out-depth') ?? '0');
  return depth <= 0 ? './' : `${'../'.repeat(depth)}`;
}

/** Full navigation (replaces router.push) for file:// field builds. */
export function navigateFieldFile(absPath: string): void {
  if (typeof window === 'undefined') return;
  window.location.href = hrefFieldFile(absPath);
}

/** Resolve a root-absolute app path to a relative URL for file:// (same folder layout as post-build rewrite). */
export function hrefFieldFile(absPath: string): string {
  const prefix = depthPrefix();
  if (absPath === '/') return `${prefix}index.html`;
  const p = absPath.startsWith('/') ? absPath.slice(1) : absPath;
  return `${prefix}${p.endsWith('/') ? p : `${p}/`}`;
}

export function shouldUseFieldFileNavigation(): boolean {
  return (
    typeof window !== 'undefined' &&
    isFieldStaticMode() &&
    window.location.protocol === 'file:'
  );
}
