#!/usr/bin/env npx tsx
/**
 * NON-NEGOTIABLE RUNTIME DB GUARD
 *
 * Ensures RUNTIME_DATABASE_URL uses DIRECT Postgres (port 5432), never PgBouncer (6543).
 * Run before tests or startup: npx tsx tools/assert_runtime_direct.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const raw = process.env.RUNTIME_DATABASE_URL;
if (!raw) {
  console.error("RUNTIME_DATABASE_URL is not set");
  process.exit(1);
}

let u: URL;
try {
  u = new URL(raw);
} catch (e) {
  console.error("RUNTIME_DATABASE_URL is not a valid URL:", (e as Error).message);
  process.exit(1);
}

const port = u.port || "5432";

if (port === "6543") {
  console.error(
    `INVALID CONFIG: RUNTIME is pointing to PgBouncer (6543).\n` +
      `RUNTIME must use DIRECT Postgres (5432).\n` +
      `Host=${u.hostname} DB=${u.pathname || "/"}`
  );
  process.exit(1);
}

if (u.searchParams.get("sslmode") !== "require") {
  console.error("RUNTIME_DATABASE_URL must have sslmode=require");
  process.exit(1);
}
// uselibpqcompat is Node-only (injected in ensureNodePgTls); do not require in env

console.log("[OK] RUNTIME is using DIRECT Postgres:", u.hostname, "port", port);
