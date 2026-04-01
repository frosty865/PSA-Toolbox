/**
 * Platform runtime detection for WEB-ONLY app.
 * Safe to call in browser and in SSR (returns false for server-side when window is undefined).
 */

/**
 * True when running in a browser context (not SSR).
 * WEB-ONLY: Always detects browser environment for web app execution.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}
