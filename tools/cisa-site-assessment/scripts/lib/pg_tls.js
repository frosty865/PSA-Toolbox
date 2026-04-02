/**
 * Libpq-compatible TLS for pg (Node). Normalize connection string and apply
 * connection-level SSL so behavior is deterministic (Supabase, self-signed, production).
 * Do not set or rely on global Node TLS state.
 */

/**
 * Normalize Postgres URL for Node pg: preserve original, add sslmode=require if missing,
 * add uselibpqcompat=true so pg uses libpq-compatible SSL semantics.
 * @param {string|null|undefined} urlStr
 * @returns {string|undefined}
 */
function ensureNodePgTls(urlStr) {
  if (!urlStr) return undefined;
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    return urlStr;
  }
  const proto = u.protocol.toLowerCase();
  if (proto !== 'postgres:' && proto !== 'postgresql:') return urlStr;
  if (!u.searchParams.get('sslmode')) u.searchParams.set('sslmode', 'require');
  if (!u.searchParams.get('uselibpqcompat')) u.searchParams.set('uselibpqcompat', 'true');
  return u.toString();
}

/**
 * Apply connection-level TLS to pg config: set ssl.rejectUnauthorized = false
 * so connections work with Supabase/self-signed certs. Behavior is local to the Pool.
 * @param {import('pg').PoolConfig} config
 * @returns {import('pg').PoolConfig}
 */
function applyNodeTls(config) {
  const ssl =
    config.ssl && typeof config.ssl === 'object'
      ? { ...config.ssl, rejectUnauthorized: false }
      : { rejectUnauthorized: false };
  return { ...config, ssl };
}

module.exports = { ensureNodePgTls, applyNodeTls };
