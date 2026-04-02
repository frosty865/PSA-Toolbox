#!/usr/bin/env npx tsx
/**
 * Ensure corpus PDFs are at flat raw/<basename> so normalized source_registry paths resolve.
 *
 * After normalize_storage_paths_to_flat_raw.ts, source_registry has storage_relpath like
 * raw/<basename>.pdf. If files are still in subdirs (e.g. raw/incoming/tier1/file.pdf),
 * the file route returns 404. This script finds those PDFs and copies (or moves with
 * --move) them to raw/<basename> under CORPUS_SOURCES_ROOT.
 *
 * Reads source_registry from CORPUS; scans CORPUS_SOURCES_ROOT for PDFs; for each row
 * whose expected path (raw/<basename>) is missing, finds a file with that basename and
 * copies/moves it to raw/<basename>.
 *
 * Env: CORPUS_DATABASE_URL (required), CORPUS_SOURCES_ROOT (default: storage/corpus_sources).
 *
 * Usage:
 *   npx tsx scripts/copy_corpus_to_flat_raw.ts [--dry-run] [--move]
 */

import path from "path";
import { readdir, copyFile, rename, access } from "fs/promises";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

function getCorpusRoot(): string {
  const raw = process.env.CORPUS_SOURCES_ROOT ?? "";
  const cwd = process.cwd();
  const resolved = raw.trim()
    ? (path.isAbsolute(raw) ? raw : path.resolve(cwd, raw))
    : path.resolve(cwd, "storage", "corpus_sources");
  const base = path.basename(resolved);
  if (base === "storage") {
    return path.join(resolved, "corpus_sources");
  }
  return resolved;
}

function basename(relpath: string): string {
  const normalized = relpath.replace(/\\/g, "/").trim();
  const last = normalized.split("/").pop() ?? normalized;
  return last || "file.pdf";
}

async function collectPdfsUnder(dir: string): Promise<string[]> {
  const list: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...(await collectPdfsUnder(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      list.push(full);
    }
  }
  return list;
}

async function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true).catch(() => false);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const useMove = process.argv.includes("--move");
  if (dryRun) console.log("[DRY RUN] No copies or renames.\n");

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL required.");
    process.exit(1);
  }

  const root = getCorpusRoot();
  const rawDir = path.join(root, "raw");
  console.log(`Corpus root: ${root}`);
  console.log(`Raw dir:     ${rawDir}\n`);

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    const rows = await pool.query<{ id: string; storage_relpath: string | null; local_path: string | null }>(
      `SELECT id, storage_relpath, local_path FROM public.source_registry
       WHERE (storage_relpath IS NOT NULL AND trim(storage_relpath) <> '')
          OR (local_path IS NOT NULL AND trim(local_path) <> '')`
    );

    const sources = rows.rows;
    if (sources.length === 0) {
      console.log("No source_registry rows with storage_relpath or local_path.");
      return;
    }

    console.log(`Scanning for PDFs under ${root}…`);
    const allPdfs = await collectPdfsUnder(root);
    if (allPdfs.length === 0) {
      console.log("No PDFs found under corpus root. Nothing to copy.");
      return;
    }

    // basename -> first absolute path found (so we resolve to one file per basename)
    const basenameToPath = new Map<string, string>();
    for (const pdfPath of allPdfs) {
      const name = path.basename(pdfPath);
      if (!basenameToPath.has(name)) {
        basenameToPath.set(name, pdfPath);
      }
    }
    console.log(`  Found ${allPdfs.length} PDF(s); ${basenameToPath.size} unique basenames.\n`);

    let copied = 0;
    let skippedExists = 0;
    let skippedNoMatch = 0;

    for (const row of sources) {
      const rel = (row.storage_relpath ?? row.local_path ?? "").trim().replace(/\\/g, "/");
      const name = basename(rel);
      const expectedPath = path.join(root, "raw", name);

      if (await fileExists(expectedPath)) {
        skippedExists++;
        continue;
      }

      const sourcePath = basenameToPath.get(name);
      if (!sourcePath) {
        skippedNoMatch++;
        console.log(`  [no match] basename="${name.slice(0, 50)}${name.length > 50 ? "…" : ""}" (id=${row.id.slice(0, 8)}…)`);
        continue;
      }

      // Don't move/copy if source is already the target (same file)
      const srcNorm = path.resolve(sourcePath);
      const dstNorm = path.resolve(expectedPath);
      if (srcNorm === dstNorm) {
        skippedExists++;
        continue;
      }

      if (dryRun) {
        console.log(`  [would copy] ${path.relative(root, sourcePath)} → raw/${name}`);
        copied++;
        continue;
      }

      try {
        if (useMove) {
          await rename(sourcePath, expectedPath);
          console.log(`  [moved] ${path.relative(root, sourcePath)} → raw/${name}`);
        } else {
          await copyFile(sourcePath, expectedPath);
          console.log(`  [copied] ${path.relative(root, sourcePath)} → raw/${name}`);
        }
        copied++;
      } catch (e) {
        console.warn(`  [error] ${name}: ${e}`);
      }
    }

    console.log("");
    console.log(`Done. Copied/moved: ${copied}; already at raw/<basename>: ${skippedExists}; no matching file: ${skippedNoMatch}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
