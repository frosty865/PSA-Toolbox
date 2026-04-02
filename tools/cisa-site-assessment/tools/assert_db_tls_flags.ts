#!/usr/bin/env npx tsx
/**
 * Preflight: confirm RUNTIME_DATABASE_URL and CORPUS_DATABASE_URL have sslmode=require.
 * uselibpqcompat is Node-only (injected at runtime); do NOT require it in env.
 *
 * Run: npx tsx tools/assert_db_tls_flags.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function check(name: string, raw?: string) {
  if (!raw) throw new Error(`${name} is missing`);
  const u = new URL(raw);
  const sslmode = u.searchParams.get("sslmode");
  if (sslmode !== "require")
    throw new Error(
      `${name} sslmode must be require (found ${sslmode ?? "null"})`
    );
  // uselibpqcompat is Node-only; do not require in env (psycopg2 would reject it)
  const compat = u.searchParams.get("uselibpqcompat");
  if (compat != null && compat !== "")
    console.warn(
      `[WARN] ${name} contains uselibpqcompat — remove from .env.local (Node injects it at runtime; psycopg2 rejects it)`
    );
  console.log(
    `[OK] ${name}: host=${u.hostname} port=${u.port} db=${u.pathname || "/"} sslmode=${sslmode}`
  );
}

check("RUNTIME_DATABASE_URL", process.env.RUNTIME_DATABASE_URL);
check("CORPUS_DATABASE_URL", process.env.CORPUS_DATABASE_URL);
