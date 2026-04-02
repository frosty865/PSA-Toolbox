#!/usr/bin/env npx tsx
/**
 * Backfill corpus_documents.canonical_path from PDFs on disk.
 *
 * Scans CORPUS_SOURCES_ROOT (e.g. storage/corpus_sources) for all .pdf files,
 * computes SHA256 for each, and sets canonical_path to the relative path
 * (e.g. raw/subdir/file.pdf) for matching corpus_documents rows.
 *
 * Env: CORPUS_DATABASE_URL (required). CORPUS_SOURCES_ROOT (optional).
 *
 * Usage:
 *   npx tsx scripts/backfill_corpus_document_paths_from_disk.ts [--dry-run]
 *
 *   --dry-run   Log matches and would-be updates only; do not write.
 */

import path from "path";
import { createReadStream } from "fs";
import { readdir } from "fs/promises";
import { createHash } from "crypto";
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
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(psaRebuildRoot, raw);
}

/** Relative path with forward slashes (for canonical_path). */
function toRelpath(absPath: string, root: string): string {
  const rel = path.relative(root, absPath);
  return rel.replace(/\\/g, "/").trim();
}

function isUnderRoot(rootAbs: string, candidateAbs: string): boolean {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) || rel === "";
}

/** Compute SHA256 of file (streaming). */
function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/** Recursively collect all .pdf paths under dir. */
async function collectPdfs(dir: string, root: string, list: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await collectPdfs(full, root, list);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      if (isUnderRoot(root, full)) {
        list.push(full);
      }
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[DRY RUN] No database updates.\n");
  }

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL is required.");
    process.exit(1);
  }

  const root = getCorpusSourcesRoot();
  console.log(`CORPUS_SOURCES_ROOT: ${root}\n`);
  console.log("Scanning for PDFs...");
  const pdfPaths: string[] = [];
  await collectPdfs(root, root, pdfPaths);
  console.log(`Found ${pdfPaths.length} PDF(s).\n`);

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  let matched = 0;
  let updated = 0;
  let skipped = 0; // already had canonical_path
  let notInDb = 0;

  try {
    for (let i = 0; i < pdfPaths.length; i++) {
      const absPath = pdfPaths[i];
      const relPath = toRelpath(absPath, root);
      process.stdout.write(`\r[${i + 1}/${pdfPaths.length}] ${path.basename(absPath)}`);
      let hash: string;
      try {
        hash = await sha256File(absPath);
      } catch (err) {
        console.error(`\n[SKIP] ${relPath}: ${(err as Error).message}`);
        continue;
      }
      const row = await pool.query<{ id: string; canonical_path: string | null }>(
        `SELECT id, canonical_path FROM public.corpus_documents WHERE file_hash = $1`,
        [hash]
      );
      if (row.rows.length === 0) {
        notInDb++;
        continue;
      }
      matched++;
      const existing = (row.rows[0].canonical_path ?? "").trim();
      if (existing === relPath) {
        skipped++;
        continue;
      }
      console.log(`\n  → ${relPath} (file_hash=${hash.slice(0, 12)}…)${existing ? ` [overwrite: ${existing.slice(0, 40)}…]` : ""}`);
      if (!dryRun) {
        await pool.query(
          `UPDATE public.corpus_documents SET canonical_path = $1, updated_at = now() WHERE id = $2`,
          [relPath, row.rows[0].id]
        );
      }
      updated++;
    }
  } finally {
    await pool.end();
  }

  console.log("\n");
  console.log("Summary:");
  console.log(`  PDFs on disk:     ${pdfPaths.length}`);
  console.log(`  Matched by hash:  ${matched}`);
  console.log(`  Updated:         ${updated}${dryRun ? " (dry run)" : ""}`);
  console.log(`  Skipped (had path or same): ${skipped}`);
  console.log(`  Not in corpus_documents:   ${notInDb}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
