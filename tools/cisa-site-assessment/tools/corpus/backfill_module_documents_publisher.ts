#!/usr/bin/env npx tsx
/**
 * Backfill publisher on RUNTIME.module_documents by scraping each document's PDF.
 * Resolves path from document_blobs.storage_relpath or module_documents.local_path (under MODULE_SOURCES_ROOT).
 *
 * Usage:
 *   npx tsx tools/corpus/backfill_module_documents_publisher.ts
 *   npx tsx tools/corpus/backfill_module_documents_publisher.ts --dry-run
 *   npx tsx tools/corpus/backfill_module_documents_publisher.ts --verbose   # log path resolution
 *
 * Requires: RUNTIME_DATABASE_URL (or DATABASE_URL), MODULE_SOURCES_ROOT (or default storage/module_sources).
 * Optional: MODULE_BLOBS_DIR — directory where PDFs live (raw/, not pending), e.g. .../storage/module_sources/raw
 * Run migration first: npm run migrate:runtime:module-documents-publisher
 */

import * as path from "path";
import { existsSync, readdirSync, readFileSync } from "fs";
import { createHash } from "crypto";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getRuntimePool } from "../../app/lib/db/runtime_client";
import { extractPdfMetadataFromPath } from "../../app/lib/pdfExtractTitle";
import { normalizePublisherName, isUnacceptablePublisher } from "../../app/lib/sourceRegistry/publisherNormalizer";

const DEFAULT_MODULE = "storage/module_sources";
/** Flat raw/ (no _blobs). Legacy paths raw/_blobs/... still resolved for existing rows. */
const RAW_DIR = "raw";

function getModuleSourcesRoot(): string {
  const raw = (process.env.MODULE_SOURCES_ROOT ?? DEFAULT_MODULE).trim().replace(/^["']|["']$/g, "");
  const resolved = raw ? (path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)) : path.resolve(process.cwd(), DEFAULT_MODULE);
  const base = path.basename(resolved);
  return base === "storage" ? path.join(resolved, "module_sources") : resolved;
}

/** Optional: directory where PDFs live (raw/, not pending). e.g. .../storage/module_sources/raw */
function getBlobsDir(): string | null {
  const raw = (process.env.MODULE_BLOBS_DIR ?? "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

/** Try multiple ways to resolve a PDF path; return first that exists. */
function resolvePath(row: { blob_relpath: string | null; local_path: string | null }): string | null {
  const root = getModuleSourcesRoot();
  const blobsDir = getBlobsDir();
  const candidates: string[] = [];

  const blob = (row.blob_relpath ?? "").trim().replace(/\\/g, "/");
  if (blob && !path.isAbsolute(blob)) {
    // Files live in raw/, not pending. Try raw/ first.
    candidates.push(path.resolve(root, RAW_DIR, path.basename(blob)));
    if (blobsDir) candidates.push(path.join(blobsDir, path.basename(blob)));
  }
  if (blob) {
    candidates.push(path.resolve(root, blob));
    if (!path.isAbsolute(blob)) {
      candidates.push(path.resolve(process.cwd(), blob));
      if (blobsDir) {
        candidates.push(path.join(blobsDir, blob.replace(/^raw[/\\]_blobs[/\\]?/i, "")));
      }
    }
  }

  const local = (row.local_path ?? "").trim().replace(/\\/g, "/");
  if (local) {
    if (path.isAbsolute(local)) {
      candidates.push(local);
    } else {
      // Files in raw/, not pending
      candidates.push(path.resolve(root, RAW_DIR, path.basename(local)));
      if (blobsDir) candidates.push(path.join(blobsDir, path.basename(local)));
      candidates.push(path.resolve(root, local));
      candidates.push(path.resolve(process.cwd(), local));
      candidates.push(path.resolve(process.cwd(), "storage", "module_sources", local));
    }
  }

  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

/** Fallback: find PDF by sha256. Files in raw/ (e.g. raw/<sha256>.pdf or raw/prefix/<sha256>.pdf); legacy raw/_blobs/... */
function resolvePathBySha256(sha256: string | null): string | null {
  if (!sha256 || sha256.length < 12) return null;
  const root = getModuleSourcesRoot();
  const blobsDir = getBlobsDir();
  const prefix = sha256.slice(0, 2);
  const candidates: string[] = [
    path.join(root, RAW_DIR, `${sha256}.pdf`),
    path.join(root, "raw/_blobs", prefix, `${sha256}.pdf`),
    path.join(root, "raw/_blobs", `${sha256}.pdf`),
  ];
  if (blobsDir) {
    candidates.push(path.join(blobsDir, `${sha256}.pdf`));
    candidates.push(path.join(blobsDir, prefix, `${sha256}.pdf`));
  }
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

/** Collect all PDF paths under dir (one level or recursive). */
function listPdfsUnderDir(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
        out.push(full);
      } else if (recursive && e.isDirectory() && !e.name.startsWith(".")) {
        out.push(...listPdfsUnderDir(full, true));
      }
    }
  } catch {
    // ignore
  }
  return out;
}

/** Compute SHA256 of file (hex). */
function sha256File(filePath: string): string | null {
  try {
    const buf = readFileSync(filePath);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

/** Build a map of sha256 (hex) -> absolute path for all PDFs under raw/. Expensive; cache and reuse. */
function buildSha256ToPathCache(): Map<string, string> {
  const root = getModuleSourcesRoot();
  const blobsDir = getBlobsDir();
  const rawDir = blobsDir ?? path.join(root, RAW_DIR);
  const cache = new Map<string, string>();
  const pdfs = listPdfsUnderDir(rawDir, true);
  for (const pdfPath of pdfs) {
    const hash = sha256File(pdfPath);
    if (hash) cache.set(hash, pdfPath);
  }
  return cache;
}

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");

async function main(): Promise<void> {
  const pool = getRuntimePool();
  if (DRY_RUN) console.log("Dry run: no DB updates.");

  const rows = await pool.query<{
    id: string;
    local_path: string | null;
    blob_relpath: string | null;
    sha256: string | null;
  }>(
    `SELECT md.id, md.local_path, db.storage_relpath AS blob_relpath, md.sha256
     FROM public.module_documents md
     LEFT JOIN public.document_blobs db ON db.id = md.document_blob_id`
  );

  if (rows.rows.length === 0) {
    console.log("No module_documents found.");
    return;
  }

  console.log(`Found ${rows.rows.length} module document(s).`);

  const root = getModuleSourcesRoot();
  const blobsDir = getBlobsDir();
  if (VERBOSE) {
    console.log(`Module root: ${root}`);
    if (blobsDir) console.log(`Blobs dir:   ${blobsDir}`);
    console.log("");
  }

  // When DB paths point to old staging (e.g. incoming/_processed/_PENDING/...) files live in raw/ with different names. Build sha256->path map by scanning raw/.
  let sha256Cache: Map<string, string> | null = null;
  const getSha256Cache = (): Map<string, string> => {
    if (sha256Cache) return sha256Cache;
    console.log("Scanning raw/ for PDFs (by sha256)…");
    sha256Cache = buildSha256ToPathCache();
    console.log(`  Indexed ${sha256Cache.size} PDF(s).`);
    return sha256Cache;
  };

  let updated = 0;
  let skippedNoPath = 0;
  let skippedNoPublisher = 0;
  let skippedError = 0;

  for (const row of rows.rows) {
    let absPath = resolvePath(row);
    if (!absPath && row.sha256) {
      absPath = resolvePathBySha256(row.sha256);
    }
    if (!absPath && row.sha256) {
      const cache = getSha256Cache();
      absPath = cache.get(row.sha256) ?? null;
    }
    if (!absPath) {
      skippedNoPath++;
      if (VERBOSE) {
        console.warn(`  [no file] id=${row.id.slice(0, 8)}… blob_relpath=${row.blob_relpath ?? "(null)"} local_path=${row.local_path ?? "(null)"} sha256=${row.sha256?.slice(0, 12) ?? "(null)"}`);
      }
      continue;
    }
    try {
      const meta = await extractPdfMetadataFromPath(absPath);
      const raw = (meta.publisher ?? "").trim();
      const publisher =
        raw && !isUnacceptablePublisher(raw) ? (normalizePublisherName(raw) ?? raw) : null;
      if (!publisher) {
        skippedNoPublisher++;
        continue;
      }
      if (!DRY_RUN) {
        await pool.query(
          `UPDATE public.module_documents SET publisher = $1, updated_at = now() WHERE id = $2::uuid`,
          [publisher, row.id]
        );
      }
      updated++;
      if (!DRY_RUN || updated <= 5) {
        console.log(`  ${row.id.slice(0, 8)}… publisher=${publisher}`);
      }
    } catch (e) {
      skippedError++;
      console.warn(`  ${row.id.slice(0, 8)}… error:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. Updated: ${updated}, no file: ${skippedNoPath}, no publisher: ${skippedNoPublisher}, error: ${skippedError}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
