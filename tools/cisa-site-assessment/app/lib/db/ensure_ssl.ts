/**
 * Normalize Postgres URL for Node pg: preserve original URL, add libpq-compatible
 * SSL semantics so pg does not treat sslmode=require as verify-full.
 *
 * - Adds sslmode=require if missing.
 * - Adds uselibpqcompat=true (Node only; do NOT add in .env.local — psycopg2 rejects it).
 */

export function ensureNodePgTls(
  urlStr: string | undefined | null
): string | undefined {
  if (!urlStr) return undefined;

  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return urlStr;
  }

  const proto = u.protocol.toLowerCase();
  if (proto !== "postgres:" && proto !== "postgresql:") return urlStr;

  if (!u.searchParams.get("sslmode")) u.searchParams.set("sslmode", "require");
  if (!u.searchParams.get("uselibpqcompat"))
    u.searchParams.set("uselibpqcompat", "true");

  return u.toString();
}

/** @deprecated Use ensureNodePgTls */
export function ensurePostgresTls(
  urlStr: string | undefined | null
): string | undefined {
  return ensureNodePgTls(urlStr);
}
