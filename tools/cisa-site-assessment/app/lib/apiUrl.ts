/**
 * Absolute path for client-side fetch() when the app uses `basePath` (e.g. /cisa-site-assessment).
 * Next.js does not prefix raw `/api/...` fetches; `CisaApiBasePathShim` patches fetch in layout, but
 * calling this avoids any ordering gap. Must match `basePath` in next.config.ts.
 */
const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BP) return p;
  return `${BP}${p}`;
}
