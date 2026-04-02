#!/usr/bin/env npx tsx
/**
 * Rewrite corpus_documents.canonical_path (and optionally source_registry paths) from legacy
 * absolute paths (e.g. D:\psa-workspace\PDF's) to the new model: paths relative to CORPUS_SOURCES_ROOT.
 * psa-workspace no longer exists; the new model stores relative paths (e.g. raw/PDF's/file.pdf)
 * so files are resolved at read time via getCorpusSourcesRoot() + path.
 *
 * Database: CORPUS only.
 *
 * Env (from .env.local or process.env):
 *   CORPUS_DATABASE_URL   required
 *   OLD_PATH_PREFIX       optional — e.g. D:\psa-workspace\PDF's or D:/psa-workspace/PDF's
 *                         Default: D:/psa-workspace (and D:/psa-workspace/PDF's is matched as prefix)
 *   CORPUS_SOURCES_ROOT   optional — used only for --absolute; default storage/corpus_sources
 *
 * Usage:
 *   npx tsx scripts/rewrite_corpus_document_paths.ts [--dry-run] [--source-registry] [--absolute]
 *
 *   --dry-run         Log changes only; do not UPDATE.
 *   --source-registry Also rewrite source_registry.local_path and storage_relpath.
 *   --absolute        Write absolute paths under CORPUS_SOURCES_ROOT (legacy). Default: write relative paths (new model).
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

const psaRebuildRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Normalize for prefix comparison: forward slashes, lowercase on Windows. */
function normForPrefix(p: string): string {
  const withForward = p.replace(/\\/g, "/").trim();
  return process.platform === "win32" ? withForward.toLowerCase() : withForward;
}

/** Default old prefix: psa-workspace (no longer exists). */
const DEFAULT_OLD_PREFIX = "d:/psa-workspace";

/**
 * Rewrite path to new model: relative to CORPUS_SOURCES_ROOT (e.g. raw/PDF's/file.pdf).
 * Uses forward slashes. If absolutePath does not start with oldPrefixNorm, returns empty string (no rewrite).
 */
function rewriteToRelative(oldPrefixNorm: string, absolutePath: string): string {
  const absNorm = normForPrefix(absolutePath);
  if (!absNorm.startsWith(oldPrefixNorm)) return "";
  const tail = absNorm.slice(oldPrefixNorm.length).replace(/^\/+/, "");
  if (!tail) return "";
  return "raw/" + tail;
}

/** Legacy: replace old prefix with absolute path under newRoot. */
function rewriteToAbsolute(oldPrefixNorm: string, newRoot: string, absolutePath: string): string {
  const absNorm = normForPrefix(absolutePath);
  if (!absNorm.startsWith(oldPrefixNorm)) return absolutePath;
  const tail = absNorm.slice(oldPrefixNorm.length).replace(/^\//, "");
  return path.normalize(path.join(newRoot, tail));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const doSourceRegistry = process.argv.includes("--source-registry");
  const useAbsolute = process.argv.includes("--absolute");

  const dbUrl = process.env.CORPUS_DATABASE_URL;
  if (!dbUrl) {
    console.error("CORPUS_DATABASE_URL is required");
    process.exit(1);
  }

  const oldPrefixRaw = (process.env.OLD_PATH_PREFIX || DEFAULT_OLD_PREFIX).trim();
  const oldPrefixNorm = normForPrefix(oldPrefixRaw);
  const newRootRaw =
    process.env.CORPUS_SOURCES_ROOT || path.join(psaRebuildRoot, "storage", "corpus_sources");
  const newRoot = path.isAbsolute(newRootRaw) ? path.resolve(newRootRaw) : path.resolve(psaRebuildRoot, newRootRaw);

  if (dryRun) {
    console.log("DRY RUN: no updates will be written.");
  }
  console.log("OLD_PATH_PREFIX (normalized):", oldPrefixNorm);
  console.log("New model:", useAbsolute ? "absolute under NEW_ROOT" : "relative (e.g. raw/... under CORPUS_SOURCES_ROOT)");
  if (useAbsolute) console.log("NEW_ROOT:", newRoot);

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(dbUrl) ?? dbUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    // 1) corpus_documents.canonical_path
    const countTotal = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.corpus_documents`
    );
    const countWithPath = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.corpus_documents WHERE canonical_path IS NOT NULL AND trim(canonical_path) <> ''`
    );
    const docsResult = await pool.query<{ id: string; canonical_path: string }>(
      `SELECT id, canonical_path FROM public.corpus_documents WHERE canonical_path IS NOT NULL AND trim(canonical_path) <> ''`
    );
    const matchingPrefix = docsResult.rows.filter((row) =>
      normForPrefix(row.canonical_path.trim()).startsWith(oldPrefixNorm)
    ).length;
    console.log(
      `corpus_documents: ${countTotal.rows[0]?.n ?? 0} total, ${countWithPath.rows[0]?.n ?? 0} with non-empty canonical_path, ${matchingPrefix} with path starting with old prefix.`
    );
    let docUpdated = 0;
    for (const row of docsResult.rows) {
      const current = row.canonical_path.trim();
      const newPath = useAbsolute
        ? rewriteToAbsolute(oldPrefixNorm, newRoot, current)
        : rewriteToRelative(oldPrefixNorm, current);
      if (newPath === "" || newPath === current) continue;
      console.log(`[corpus_documents] ${row.id}: ${current} → ${newPath}`);
      if (!dryRun) {
        await pool.query(`UPDATE public.corpus_documents SET canonical_path = $1, updated_at = now() WHERE id = $2`, [
          newPath,
          row.id,
        ]);
      }
      docUpdated++;
    }
    console.log(`corpus_documents: ${docUpdated} row(s) ${dryRun ? "would be " : ""}updated.`);

    // 2) source_registry.local_path and storage_relpath (optional)
    if (doSourceRegistry) {
      const srResult = await pool.query<{ id: string; local_path: string | null; storage_relpath: string | null }>(
        `SELECT id, local_path, storage_relpath FROM public.source_registry WHERE (local_path IS NOT NULL AND trim(local_path) <> '') OR (storage_relpath IS NOT NULL AND trim(storage_relpath) <> '')`
      );
      let srUpdated = 0;
      for (const row of srResult.rows) {
        const updates: string[] = [];
        const params: (string | null)[] = [];
        let idx = 1;

        if (row.local_path && normForPrefix(row.local_path.trim()).startsWith(oldPrefixNorm)) {
          const newLocal = useAbsolute
            ? rewriteToAbsolute(oldPrefixNorm, newRoot, row.local_path.trim())
            : rewriteToRelative(oldPrefixNorm, row.local_path.trim());
          if (newLocal) {
            updates.push(`local_path = $${idx++}`);
            params.push(newLocal);
            console.log(`[source_registry.local_path] ${row.id}: ${row.local_path} → ${newLocal}`);
          }
        }
        if (row.storage_relpath && normForPrefix(row.storage_relpath.trim()).startsWith(oldPrefixNorm)) {
          const newRel = useAbsolute
            ? rewriteToAbsolute(oldPrefixNorm, newRoot, row.storage_relpath.trim())
            : rewriteToRelative(oldPrefixNorm, row.storage_relpath.trim());
          if (newRel) {
            updates.push(`storage_relpath = $${idx++}`);
            params.push(newRel);
            console.log(`[source_registry.storage_relpath] ${row.id}: ${row.storage_relpath} → ${newRel}`);
          }
        }
        if (updates.length === 0) continue;
        params.push(row.id);
        if (!dryRun) {
          await pool.query(
            `UPDATE public.source_registry SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx}`,
            params
          );
        }
        srUpdated++;
      }
      console.log(`source_registry: ${srUpdated} row(s) ${dryRun ? "would be " : ""}updated.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
