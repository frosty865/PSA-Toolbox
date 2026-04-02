import type { PoolConfig } from "pg";

/**
 * Explicit connection-level TLS for pg. Always sets ssl.rejectUnauthorized: false
 * so connections work with Supabase, self-signed certs, and SSL inspection.
 * No global NODE_TLS_REJECT_UNAUTHORIZED; behavior is deterministic.
 * Accepts PoolConfig so callers can pass max, idleTimeoutMillis, etc.
 */
export function applyNodeTls(config: PoolConfig): PoolConfig {
  return {
    ...config,
    ssl:
      config.ssl && typeof config.ssl === "object"
        ? { ...config.ssl, rejectUnauthorized: false }
        : { rejectUnauthorized: false },
  };
}
