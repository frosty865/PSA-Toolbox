#!/usr/bin/env tsx
/**
 * Rename PDFs in module_sources/raw/_PENDING to human-readable names
 * using document title from CORPUS (corpus_documents.inferred_title) or fallback from filename.
 * (Legacy: also supports incoming/_processed/_PENDING if present.)
 *
 * Usage: npx tsx tools/rename_pending_pdfs_by_title.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createReadStream } from "fs";
import { ensureRuntimePoolConnected } from "../app/lib/db/runtime_client";
import { getCorpusPool } from "../app/lib/db/corpus_client";

dotenv.config({ path: ".env.local" });

const MODULE_SOURCES_ROOT =
  process.env.MODULE_SOURCES_ROOT ||
  path.resolve(process.cwd(), "storage", "module_sources");
/** Prefer raw/_PENDING (canonical); fallback to legacy incoming/_processed/_PENDING */
const PENDING_DIR = path.join(MODULE_SOURCES_ROOT, "raw", "_PENDING");
const PENDING_DIR_LEGACY = path.join(
  MODULE_SOURCES_ROOT,
  "incoming",
  "_processed",
  "_PENDING"
);
const MAX_FILENAME_LENGTH = 200;
const DRY_RUN = process.argv.includes("--dry-run");

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/** Remove common PDF producer suffixes and trailing hash-like segments for a cleaner fallback title. */
function cleanFilenameStem(name: string): string {
  let s = name.replace(/\.pdf$/i, "").trim();
  // Remove common suffixes: -Adobe PDF Library, -Microsoft® Word..., -PScript5..., -GPL Ghostscript..., -CISA-2025-06375f3b
  s = s.replace(/-Adobe PDF Library.*$/i, "");
  s = s.replace(/-Microsoft® Word for Microsoft.*$/i, "");
  s = s.replace(/-PScript5\.dll Version.*$/i, "");
  s = s.replace(/-GPL Ghostscript.*$/i, "");
  s = s.replace(/-CISA-\d{4}-[a-f0-9]+$/i, "");
  s = s.replace(/-[a-f0-9]{8,}$/i, ""); // trailing hex hash
  return s.replace(/\s*-\s*$/, "").trim() || name.replace(/\.pdf$/i, "").trim();
}

/** Sanitize for filesystem: no / \ : * ? " < > | */
function sanitizeFileName(title: string): string {
  let s = title
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > MAX_FILENAME_LENGTH) {
    s = s.slice(0, MAX_FILENAME_LENGTH).trim();
  }
  return s || "Untitled";
}

async function getTitleFromCorpus(corpusPool: import("pg").Pool, sha256: string): Promise<string | null> {
  const r = await corpusPool.query<{ inferred_title: string | null }>(
    "SELECT inferred_title FROM public.corpus_documents WHERE file_hash = $1",
    [sha256]
  );
  const title = r.rows[0]?.inferred_title;
  return title && title.trim() ? title.trim() : null;
}

async function main() {
  const dir = fs.existsSync(PENDING_DIR)
    ? PENDING_DIR
    : fs.existsSync(PENDING_DIR_LEGACY)
      ? PENDING_DIR_LEGACY
      : null;
  if (!dir) {
    console.error(`[ERROR] Neither directory found: ${PENDING_DIR} or ${PENDING_DIR_LEGACY}`);
    process.exit(1);
  }

  const runtimePool = await ensureRuntimePoolConnected();
  let corpusPool: import("pg").Pool | null = null;
  try {
    corpusPool = getCorpusPool();
  } catch (e) {
    console.warn("[WARN] CORPUS_DATABASE_URL not set or CORPUS unavailable; using filename fallback only.");
  }

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
  console.log(`[INFO] Found ${files.length} PDF(s) in ${dir}`);
  if (DRY_RUN) console.log("[DRY-RUN] No files or DB will be modified.\n");

  const relDir = path.relative(MODULE_SOURCES_ROOT, dir).replace(/\\/g, "/");
  // Case-insensitive set of names we've assigned this run; also check disk to avoid overwriting
  const usedNames = new Set<string>();
  const norm = (s: string) => s.toLowerCase();

  for (const file of files) {
    const absPath = path.join(dir, file);
    if (!fs.statSync(absPath).isFile()) continue;

    let sha256: string;
    try {
      sha256 = await sha256File(absPath);
    } catch (e) {
      console.warn(`[WARN] Skip ${file}: could not hash`, e);
      continue;
    }

    let title: string | null = null;
    if (corpusPool) {
      try {
        title = await getTitleFromCorpus(corpusPool, sha256);
      } catch (_) {
        // ignore
      }
    }
    if (!title) {
      title = cleanFilenameStem(file);
    }

    const baseName = sanitizeFileName(title) + ".pdf";
    let newName = baseName;
    let n = 1;
    const newAbsPathFor = (name: string) => path.join(dir, name);
    while (usedNames.has(norm(newName)) || (fs.existsSync(newAbsPathFor(newName)) && newAbsPathFor(newName) !== absPath)) {
      const ext = path.extname(baseName);
      const stem = path.basename(baseName, ext);
      newName = `${stem} (${++n})${ext}`;
    }
    usedNames.add(norm(newName));

    const newAbsPath = newAbsPathFor(newName);
    const newRelPath = `${relDir}/${newName}`;
    const oldRelPath = `${relDir}/${file}`;

    if (path.resolve(newAbsPath) === path.resolve(absPath)) {
      console.log(`[SKIP] ${file} (already named)`);
      continue;
    }

    console.log(`${file} -> ${newName}${title ? ` (title from DB)` : " (from filename)"}`);

    if (!DRY_RUN) {
      if (fs.existsSync(newAbsPath) && newAbsPath !== absPath) {
        console.warn(`[WARN] Target exists, skip rename: ${newName}`);
        continue;
      }
      fs.renameSync(absPath, newAbsPath);

      // Update RUNTIME: document_blobs.storage_relpath and module_documents.local_path
      try {
        await runtimePool.query(
          "UPDATE public.document_blobs SET storage_relpath = $1 WHERE sha256 = $2",
          [newRelPath, sha256]
        );
        await runtimePool.query(
          "UPDATE public.module_documents SET local_path = $1 WHERE sha256 = $2 AND (local_path = $3 OR local_path IS NULL)",
          [newRelPath, sha256, oldRelPath]
        );
      } catch (e) {
        console.warn(`[WARN] DB update failed for ${sha256.slice(0, 8)}...`, e);
      }
    }
  }

  if (corpusPool) {
    try {
      await corpusPool.end();
    } catch (_) {}
  }
  try {
    await runtimePool.end();
  } catch (_) {}
  console.log("\n[OK] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
