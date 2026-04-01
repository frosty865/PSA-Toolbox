/**
 * API base URL for fetch calls. Use this for all /api/* requests.
 * WEB-ONLY: Same-origin by default; override via NEXT_PUBLIC_API_BASE env variable if needed.
 */

/**
 * Returns the origin to prefix to API paths. No trailing slash.
 * - Default: '' (same-origin HTTP to Next.js server)
 * - Custom: Set NEXT_PUBLIC_API_BASE environment variable to override
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? '').trim();
  return base;
}
