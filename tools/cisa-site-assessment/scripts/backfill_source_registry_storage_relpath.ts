#!/usr/bin/env npx tsx
/**
 * Update storage_relpath in source_registry for all rows that have a resolvable file.
 * Uses local_path or existing storage_relpath to resolve under CORPUS_SOURCES_ROOT,
 * then sets storage_relpath to the normalized relative path (forward slashes).
 *
 * Env: CORPUS_DATABASE_URL (required). CORPUS_SOURCES_ROOT (optional).
 *
 * Usage:
 *   npx tsx scripts/backfill_source_registry_storage_relpath.ts [--dry-run]
 *
 *   --dry-run   Log updates only; do not write to the database.
 */

import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

function getCorpusSourcesRoot(): string {
  const raw = process.env.CORPUS_SOURCES_ROOT ?? path.join(psaRebuildRoot, "storage", "corpus_sources");
  return path.isAbsolute(raw) ? raw : path.resolve(psaRebuildRoot, raw);
}

function isUnderRoot(rootAbs: string, candidateAbs: string): boolean {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) || rel === "";
}

/** Normalize to forward slashes for storage_relpath. */
function toRelpath(p: string): string {
  return p.replace(/\\/g, "/").trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[DRY RUN] No database updates.");
  }

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL is required.");
    process.exit(1);
  }

  const corpusRoot = getCorpusSourcesRoot();
  console.log(`CORPUS_SOURCES_ROOT: ${corpusRoot}\n`);

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    const rows = await pool.query<{
      id: string;
      source_key: string;
      storage_relpath: string | null;
      local_path: string | null;
    }>(
      `SELECT id, source_key, storage_relpath, local_path
       FROM public.source_registry
       WHERE (storage_relpath IS NOT NULL AND trim(storage_relpath) <> '')
          OR (local_path IS NOT NULL AND trim(local_path) <> '')`
    );

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const row of rows.rows) {
      let absPath: string | null = null;

      // Prefer storage_relpath, then local_path (same as file route)
      if (row.storage_relpath) {
        try {
          const rel = row.storage_relpath.replace(/\\/g, path.sep).trim();
          const resolved = path.resolve(corpusRoot, rel);
          if (isUnderRoot(corpusRoot, resolved)) {
            absPath = resolved;
          }
        } catch {
          // skip
        }
      }
      if (!absPath && row.local_path) {
        const local = row.local_path.replace(/\\/g, "/").trim();
        if (path.isAbsolute(local)) {
          if (isUnderRoot(corpusRoot, local)) {
            absPath = local;
          }
        } else {
          try {
            const resolved = path.resolve(corpusRoot, local);
            if (isUnderRoot(corpusRoot, resolved)) {
              absPath = resolved;
            }
          } catch {
            // skip
          }
        }
      }

      if (!absPath) {
        skipped++;
        continue;
      }
      if (!existsSync(absPath)) {
        missing++;
        console.log(`  [MISSING] ${row.source_key} -> ${absPath}`);
        continue;
      }

      const relPath = path.relative(corpusRoot, absPath);
      const normalized = toRelpath(relPath);
      const current = row.storage_relpath ? toRelpath(row.storage_relpath) : null;
      if (current === normalized) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [would set] ${row.source_key}: ${current ?? "NULL"} -> ${normalized}`);
      } else {
        await pool.query(
          `UPDATE public.source_registry SET storage_relpath = $1, updated_at = now() WHERE id = $2`,
          [normalized, row.id]
        );
        console.log(`  [updated] ${row.source_key} -> ${normalized}`);
      }
      updated++;
    }

    console.log(`\nDone. Updated: ${updated}, skipped (no change): ${skipped}, missing file: ${missing}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
