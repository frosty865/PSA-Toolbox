/**
 * Absolute path for client-side fetch() when the app uses `basePath` (e.g. /cisa-site-assessment).
 * Next.js does not prefix raw `/api/...` fetches; `CisaApiBasePathShim` patches fetch in layout, but
 * calling this avoids any ordering gap. Must match `basePath` in next.config.ts.
 *
 * With `trailingSlash: true` (see next.config.ts), App Router API URLs must end in `/` or Next can
 * mis-match routes and return **405** (e.g. DELETE hitting `assessments/route.ts` instead of
 * `[assessmentId]/route.ts`).
 */
const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Keep in sync with `trailingSlash` in next.config.ts */
const TRAILING_SLASH = true;

function withTrailingSlashBeforeQuery(pathWithOptionalQuery: string): string {
  const q = pathWithOptionalQuery.indexOf("?");
  const pathname = q >= 0 ? pathWithOptionalQuery.slice(0, q) : pathWithOptionalQuery;
  const search = q >= 0 ? pathWithOptionalQuery.slice(q) : "";
  if (pathname.length <= 1 || pathname.endsWith("/")) {
    return pathWithOptionalQuery;
  }
  return `${pathname}/${search}`;
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const normalized = TRAILING_SLASH ? withTrailingSlashBeforeQuery(p) : p;
  if (!BP) return normalized;
  return `${BP}${normalized}`;
}
