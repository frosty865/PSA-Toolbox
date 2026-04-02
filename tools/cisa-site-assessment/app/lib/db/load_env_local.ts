/**
 * Load .env.local without setting global TLS overrides.
 * TLS is handled only at pg connection level (ensureNodePgTls + applyNodeTls).
 * Uses dotenv.parse(); applies parsed vars to process.env except excluded keys;
 * explicitly prevents the script from ever running with a well-known Node TLS override.
 */

import { parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const EXCLUDED_KEYS = new Set(["NODE_TLS_REJECT_UNAUTHORIZED"]);

/**
 * Loads .env.local into process.env via parse(). Skips EXCLUDED_KEYS.
 * Only sets vars that are not already defined in process.env.
 * After applying, unsets the excluded TLS key so the script never relies on global TLS.
 */
export function loadEnvLocal(cwd: string = process.cwd()): void {
  const envPath = resolve(cwd, ".env.local");
  if (!existsSync(envPath)) return;

  const parsed = parse(readFileSync(envPath, "utf-8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (EXCLUDED_KEYS.has(k)) continue;
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
  for (const k of EXCLUDED_KEYS) {
    delete process.env[k];
  }
}
