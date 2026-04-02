#!/usr/bin/env npx tsx
/**
 * Remove all modules and all module-related data from the RUNTIME database.
 * Same logical order as DELETE /api/admin/modules/[moduleCode] but for every module.
 *
 * Env: RUNTIME_DATABASE_URL or RUNTIME_DB_URL (required).
 *
 * Usage:
 *   npx tsx scripts/clean_all_modules.ts [--dry-run]
 *
 *   --dry-run   Log what would be deleted; do not execute.
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

loadEnvLocal(psaRebuildRoot);

const DELETES: { label: string; sql: string }[] = [
  { label: "module_chunk_comprehension", sql: "DELETE FROM public.module_chunk_comprehension" },
  { label: "module_corpus_links", sql: "DELETE FROM public.module_corpus_links" },
  { label: "module_documents", sql: "DELETE FROM public.module_documents" },
  { label: "module_sources", sql: "DELETE FROM public.module_sources" },
  { label: "module_vulnerability_candidates", sql: "DELETE FROM public.module_vulnerability_candidates" },
  { label: "module_drafts", sql: "DELETE FROM public.module_drafts" },
  { label: "assessment_modules", sql: "DELETE FROM public.assessment_modules" },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[DRY RUN] No rows will be deleted.\n");
  }

  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.RUNTIME_DB_URL;
  if (!runtimeUrl) {
    console.error("RUNTIME_DATABASE_URL or RUNTIME_DB_URL is required.");
    process.exit(1);
  }

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(runtimeUrl) ?? runtimeUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    if (dryRun) {
      const counts: Record<string, number> = {};
      for (const { label, sql } of DELETES) {
        const table = sql.replace(/DELETE FROM public\.(\w+).*/, "$1");
        const countResult = await pool.query(
          `SELECT COUNT(*) AS n FROM public.${table}`
        ).catch(() => ({ rows: [{ n: "?" }] }));
        counts[label] = Number(countResult.rows[0]?.n ?? 0);
      }
      console.log("[DRY RUN] Row counts that would be deleted:");
      for (const [label, n] of Object.entries(counts)) {
        console.log(`  ${label}: ${n}`);
      }
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const { label, sql } of DELETES) {
        const r = await client.query(sql);
        const n = r.rowCount ?? 0;
        console.log(`  ${label}: ${n} rows`);
      }
      await client.query("COMMIT");
      console.log("Done. All modules and related data removed.");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
