/**
 * Module Ingestion Watcher (RUNTIME Only)
 * 
 * Watches storage/module_sources/incoming/ for PDFs; ingests to RUNTIME and copies to storage/module_sources/raw/ (flat).
 * Module uploads NEVER go into CORPUS - they belong in RUNTIME.module_documents and module_chunks only.
 * 
 * Separation: This watcher ONLY handles module-scoped documents in RUNTIME.
 * Requires module_code to be determined from directory structure or filename.
 */

import { resolve } from "path";
import type { Pool } from "pg";
import * as fs from "fs";
import { getRuntimePool } from "../../app/lib/db/runtime_client";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import * as path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

loadEnvLocal(process.cwd());

// Default to storage locations (can be overridden via env vars)
const MODULE_STORAGE_ROOT = process.env.MODULE_SOURCES_ROOT || path.resolve(process.cwd(), "storage", "module_sources");
const MODULE_INCOMING_DIR = process.env.CORPUS_MODULE_INCOMING || path.join(MODULE_STORAGE_ROOT, "incoming");
const POLL_INTERVAL_MS = Number(process.env.CORPUS_WATCHER_POLL_MS || 10000);

const incomingRoot = MODULE_INCOMING_DIR;
// Incoming → _processed (staging) → ingest copies to raw/<sha256>.pdf; on success remove from _processed. Failed → failed/.
const processedRoot = path.join(MODULE_STORAGE_ROOT, "_processed");
const failedRoot = path.join(MODULE_STORAGE_ROOT, "failed");

const RESERVED_DIRS = new Set(["_processed", "_failed"]);
/** Directories to never descend into (VCS, etc.). */
const SKIP_DIRS = new Set([".git"]);
/** Module code for ingested-but-unassigned docs (library). Nothing is "pending"; once ingested they are in raw and unassigned until assigned in UI. */
const UNASSIGNED_MODULE_CODE = process.env.MODULE_UNASSIGNED_CODE || "MODULE_UNASSIGNED";
const DEBUG = process.env.CORPUS_WATCHER_DEBUG === "1";

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function ts(): string {
  return new Date().toISOString();
}

/** Strict check: directory name is a module code. Only used when migrating old layout. */
function isModuleDirName(name: string): boolean {
  return name.startsWith("MODULE_");
}

/** Old top-level dirs that were treated as unassigned queue (migration only; we no longer scan these). */
function isUnassignedDirName(name: string): boolean {
  return name === "pending" || name === "_PENDING" || name === "MODULE_PENDING" || name === "MODULE_UNASSIGNED";
}

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function existsDir(p: string): Promise<boolean> {
  try {
    const st = await fs.promises.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function isEmptyDir(p: string): Promise<boolean> {
  try {
    const items = await fs.promises.readdir(p);
    return items.length === 0;
  } catch (err: any) {
    console.warn(`[WARN] ${ts()} unable to read dir for emptiness check: ${p} (${err?.message ?? err})`);
    return false;
  }
}

/**
 * Recursively remove empty directories under rootDir (bottom-up).
 * Only removes dirs that are empty. Never touches files or symlinks.
 * Returns number of dirs removed. Logs [WARN] on removal failure.
 */
async function pruneEmptyDirs(rootDir: string): Promise<number> {
  if (!(await existsDir(rootDir))) return 0;
  let removed = 0;
  const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isSymbolicLink() || !e.isDirectory()) continue;
    const full = path.join(rootDir, e.name);
    removed += await pruneEmptyDirs(full);
  }
  if (await isEmptyDir(rootDir)) {
    try {
      await fs.promises.rmdir(rootDir);
      removed += 1;
    } catch (err: any) {
      console.warn(`[WARN] ${ts()} pruneEmptyDirs could not remove ${rootDir}: ${err?.message ?? err}`);
    }
  }
  return removed;
}

const RETRYABLE_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RETRY_DELAYS_MS = [200, 400, 800];
const MAX_SAFEMOVE_RETRIES = 3;
const MAX_COLLISION_ATTEMPTS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Move file via rename; on cross-device or permission error, fallback to copy+unlink.
 * Returns destination path.
 */
async function safeMove(srcPath: string, destPath: string): Promise<string> {
  try {
    await fs.promises.rename(srcPath, destPath);
    return destPath;
  } catch (err: any) {
    if (err?.code === "EXDEV" || err?.code === "EPERM" || err?.code === "EACCES") {
      await fs.promises.copyFile(srcPath, destPath);
      await fs.promises.unlink(srcPath);
      return destPath;
    }
    throw err;
  }
}

/**
 * safeMove with bounded retry for Windows transient errors (EPERM, EBUSY, EACCES).
 */
async function safeMoveWithRetry(srcPath: string, destPath: string): Promise<string> {
  let lastErr: Error | null = null;
  for (let i = 0; i < MAX_SAFEMOVE_RETRIES; i++) {
    try {
      return await safeMove(srcPath, destPath);
    } catch (err: any) {
      lastErr = err;
      if (i < MAX_SAFEMOVE_RETRIES - 1 && RETRYABLE_CODES.has(err?.code)) {
        await delay(RETRY_DELAYS_MS[i]);
      } else {
        throw err;
      }
    }
  }
  throw lastErr ?? new Error("safeMoveWithRetry failed");
}

/**
 * Move a file into queue folder (processed or failed) so incoming behaves like a queue.
 * Single library: destination is folderRoot/<basename> with collision handling (stem-1.pdf, etc).
 * Returns destination path for logging.
 */
async function moveTo(folderRoot: string, filePath: string): Promise<string> {
  await ensureDir(folderRoot);
  const base = path.basename(filePath);
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  let destPath = path.join(folderRoot, base);
  let attempt = 0;
  while (true) {
    try {
      await fs.promises.access(destPath);
      attempt += 1;
      if (attempt >= MAX_COLLISION_ATTEMPTS) {
        throw new Error(`collision-resolution exceeded maxAttempts for ${base} in ${folderRoot}`);
      }
      destPath = path.join(folderRoot, `${stem}-${attempt}${ext}`);
    } catch {
      break;
    }
  }
  return safeMoveWithRetry(filePath, destPath);
}

export interface MigrateSinkResult {
  filesMoved: number;
  filesFailed: number;
}

/**
 * Migrate contents of a per-module sink (incoming/<module_code>/_processed or _failed)
 * into the flat canonical failed/ folder. Keeps folder count minimal; no separate processed/.
 * Only moves immediate files (non-recursive). Prunes empty subdirs when nonfiles > 0;
 * removes stray sink dir when it becomes empty.
 * Exported for tools/dev/test_sink_migration.ts.
 */
export async function migrateModuleSubfolderSink(
  moduleCode: string,
  moduleDirPath: string,
  subfolderName: "_processed" | "_failed",
  destRoot: string
): Promise<MigrateSinkResult> {
  const srcDir = path.join(moduleDirPath, subfolderName);
  if (!(await existsDir(srcDir))) return { filesMoved: 0, filesFailed: 0 };

  await ensureDir(destRoot);

  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile());
  const nonFileEntries = entries.filter((e) => !e.isFile());

  console.log(`[SCAN] ${ts()} migrate stray ${moduleCode}/${subfolderName} -> ${destRoot} (${files.length} file(s))`);

  let filesMoved = 0;
  let filesFailed = 0;

  for (const f of files) {
    const srcPath = path.join(srcDir, f.name);
    const ext = path.extname(f.name);
    const stem = path.basename(f.name, ext);

    let attempt = 0;
    let destPath = path.join(destRoot, f.name);
    while (true) {
      try {
        await fs.promises.access(destPath);
        attempt += 1;
        if (attempt >= MAX_COLLISION_ATTEMPTS) {
          console.error(`[ERROR] ${ts()} collision-resolution exceeded maxAttempts for ${f.name} in ${destRoot}`);
          filesFailed += 1;
          destPath = ""; // skip move
          break;
        }
        destPath = path.join(destRoot, `${stem}-${attempt}${ext}`);
      } catch {
        break;
      }
    }

    if (destPath) {
      try {
        const moved = await safeMoveWithRetry(srcPath, destPath);
        console.log(`[INFO] moved ${srcPath} -> ${moved}`);
        filesMoved += 1;
      } catch (err: any) {
        console.error(`[ERROR] ${ts()} failed to migrate ${srcPath}: ${err.message}`);
        filesFailed += 1;
      }
    }
  }

  const nonfiles = nonFileEntries.length;
  console.log(`[SCAN] ${ts()} migration summary ${moduleCode}/${subfolderName}: moved=${filesMoved} failed=${filesFailed} nonfiles=${nonfiles}`);

  if (nonfiles > 0) {
    console.warn(`[WARN] ${ts()} non-file entries remain in ${srcDir}; pruning empty subdirs`);
    const pruned = await pruneEmptyDirs(srcDir);
    if (pruned > 0) {
      console.log(`[INFO] ${ts()} pruned ${pruned} empty dir(s) under ${srcDir}`);
    }
  }

  if ((await existsDir(srcDir)) && (await isEmptyDir(srcDir))) {
    try {
      await fs.promises.rmdir(srcDir);
      console.log(`[INFO] ${ts()} removed stray sink dir: ${srcDir}`);
    } catch (err: any) {
      console.error(`[ERROR] ${ts()} failed to remove stray folder ${srcDir}: ${err.message}`);
    }
  }

  return { filesMoved, filesFailed };
}

/** True if module_code exists in assessment_modules (required for module_sources FK). */
async function isModuleRegistered(runtimePool: Pool, moduleCode: string): Promise<boolean> {
  const r = await runtimePool.query(
    "SELECT 1 FROM public.assessment_modules WHERE module_code = $1 LIMIT 1",
    [moduleCode]
  );
  return (r.rowCount ?? 0) > 0;
}

interface ProcessedFile {
  path: string;
  sha256: string;
  moduleCode: string;
  processedAt: Date;
}

const processedFiles = new Map<string, ProcessedFile>();

const EXTRACT_PDF_SCRIPT = "extract_pdf_metadata.py";

/** True if s looks like a raw sha256 (long hex) — do not use as display label. */
function looksLikeSha256(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  return /^[a-f0-9]{32,64}$/i.test(t);
}

/** Prefer document title; never use raw sha256 as label. */
function humanFriendlyLabel(label: string, filename: string): string {
  const trimmed = (label || "").trim();
  if (trimmed && !looksLikeSha256(trimmed)) return trimmed;
  const stem = path.basename(filename, path.extname(filename)).replace(/_/g, " ").replace(/-/g, " ");
  if (stem && !looksLikeSha256(stem)) return stem;
  return "PDF document";
}

/**
 * Extract document title from a PDF file (metadata or first pages).
 * Returns inferred_title or pdf_meta_title, or null on failure.
 */
function extractPdfTitleFromPath(pdfPath: string): Promise<string | null> {
  const pythonExe = process.env.PYTHON_EXECUTABLE || process.env.PYTHON || "python";
  const scriptPath = resolve(process.cwd(), "tools", EXTRACT_PDF_SCRIPT);
  if (!fs.existsSync(scriptPath)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const proc = spawn(pythonExe, [scriptPath, pdfPath], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env },
      shell: false,
    });
    let stdout = "";
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", () => {});
    proc.on("close", (code: number) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        const t = result.inferred_title || result.pdf_meta_title;
        resolve(t && typeof t === "string" ? t.trim() : null);
      } catch {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

function sha256File(filePath: string): string {
  const crypto = require("crypto");
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

function waitForStableSize(filePath: string, maxWaitMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let lastSize = fs.statSync(filePath).size;
    let stableCount = 0;
    const checkInterval = 500;
    let maxChecks = maxWaitMs / checkInterval;

    const check = setInterval(() => {
      try {
        const currentSize = fs.statSync(filePath).size;
        if (currentSize === lastSize) {
          stableCount++;
          if (stableCount >= 3) {
            clearInterval(check);
            resolve(true);
          }
        } else {
          lastSize = currentSize;
          stableCount = 0;
        }
      } catch {
        clearInterval(check);
        resolve(false);
      }

      maxChecks--;
      if (maxChecks <= 0) {
        clearInterval(check);
        resolve(false);
      }
    }, checkInterval);
  });
}

/**
 * Extract module_code from file path.
 * Looks for MODULE_* pattern in directory structure or filename.
 */
function extractModuleCode(filePath: string): string | null {
  const parts = filePath.split(path.sep);
  
  // Check directory names for MODULE_* pattern
  for (const part of parts) {
    const match = part.match(/^(MODULE_[A-Z0-9_]+)$/);
    if (match) {
      return match[1];
    }
  }
  
  // Check filename for MODULE_* pattern
  const filename = path.basename(filePath);
  const filenameMatch = filename.match(/^(MODULE_[A-Z0-9_]+)/);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  
  return null;
}

async function ingestModuleDocument(
  pdfPath: string,
  moduleCode: string,
  runtimePool: Pool
): Promise<void> {
  const filename = path.basename(pdfPath);
  const sha256 = sha256File(pdfPath);
  const key = `${sha256}:${moduleCode}`;

  // Check if already processed for this module
  if (processedFiles.has(key)) {
    console.log(`[SKIP] ${filename} already processed for ${moduleCode}`);
    return;
  }

  // Check if already in module_documents
  const existing = await runtimePool.query(
    `SELECT id, status FROM public.module_documents 
     WHERE module_code = $1 AND sha256 = $2
     LIMIT 1`,
    [moduleCode, sha256]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === 'INGESTED') {
    console.log(`[SKIP] ${filename} already ingested in module_documents for ${moduleCode}`);
    // Ensure module_sources has a row so it appears in sources UI (backfill for previously ingested docs)
    // Guard: no inserts when module not registered (prevents module_sources_module_code_fkey violations)
    if (!(await isModuleRegistered(runtimePool, moduleCode))) {
      console.warn(`[WARN] ${moduleCode} ${filename} (${pdfPath}): SKIP module_sources insert (module not registered)`);
    } else {
      try {
        const hasSource = await runtimePool.query(
          `SELECT id FROM public.module_sources
           WHERE module_code = $1 AND sha256 = $2 AND source_type = 'MODULE_UPLOAD' LIMIT 1`,
          [moduleCode, sha256]
        );
        if (hasSource.rows.length === 0) {
          const labelMatch = filename.match(/^\d{4}-\d{2}-\d{2}__(.+?)__[a-f0-9]+\.pdf$/);
          const rawLabel = labelMatch
            ? labelMatch[1].replace(/_/g, " ").replace(/-/g, " ")
            : path.basename(pdfPath, path.extname(pdfPath)).replace(/_/g, " ").replace(/-/g, " ");
          const label = humanFriendlyLabel(rawLabel, filename);
          const blobRow = await runtimePool.query(
            `SELECT storage_relpath FROM public.document_blobs WHERE sha256 = $1 LIMIT 1`,
            [sha256]
          );
          const storageRelpath = blobRow.rows[0]?.storage_relpath ?? null;
          await runtimePool.query(
            `INSERT INTO public.module_sources (module_code, source_type, source_label, sha256, storage_relpath, fetch_status, fetched_at)
             VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, 'DOWNLOADED', $5)`,
            [moduleCode, label, sha256, storageRelpath, new Date()]
          );
          console.log(`[SOURCE] Backfilled module_sources for ${filename}`);
        }
      } catch (e: any) {
        console.warn(`[WARN] Could not backfill module_sources:`, e.message);
      }
    }
    processedFiles.set(key, { path: pdfPath, sha256, moduleCode, processedAt: new Date() });
    return;
  }

  // Python copies incoming file to raw/<sha256>.pdf and registers document_blobs
  const extractedTitle = await extractPdfTitleFromPath(pdfPath);
  const nameBase = filename.replace(/\.[^/.]+$/, "");
  const labelMatch = filename.match(/^\d{4}-\d{2}-\d{2}__(.+?)__[a-f0-9]+\.pdf$/);
  const rawLabel = extractedTitle
    || (labelMatch ? labelMatch[1].replace(/_/g, " ").replace(/-/g, " ") : nameBase.replace(/_/g, " ").replace(/-/g, " "));
  const label = humanFriendlyLabel(rawLabel, filename);

  console.log(`[INGEST] ${filename} -> RUNTIME (single library raw/_blobs/)`);

  const pythonScript = resolve(process.cwd(), "tools", "corpus", "ingest_module_pdf_to_runtime.py");
  const pythonExe = process.env.PYTHON_EXECUTABLE || "python";

  return new Promise(async (resolve, reject) => {
    const proc = spawn(pythonExe, [
      pythonScript,
      "--pdf-path", pdfPath,
      "--module-code", moduleCode,
      "--label", label,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      if (code === 0) {
        // Verify chunks exist
        try {
          const docResult = await runtimePool.query(
            `SELECT id FROM public.module_documents 
             WHERE module_code = $1 AND sha256 = $2
             ORDER BY created_at DESC 
             LIMIT 1`,
            [moduleCode, sha256]
          );

          if (docResult.rows.length > 0) {
            const documentId = docResult.rows[0].id;
            const chunkResult = await runtimePool.query(
              `SELECT COUNT(*) as count FROM public.module_chunks 
               WHERE module_document_id = $1`,
              [documentId]
            );
            const chunkCount = parseInt(chunkResult.rows[0].count, 10);

            if (chunkCount > 0) {
              console.log(`[VERIFY] ${filename} has ${chunkCount} chunks in RUNTIME`);
            } else {
              console.warn(`[WARN] ${filename} ingested but has no chunks`);
            }

            // Ensure module_sources has a row; storage_relpath from document_blobs (Python wrote to raw/)
            if (!(await isModuleRegistered(runtimePool, moduleCode))) {
              console.warn(`[WARN] ${moduleCode} ${filename}: SKIP module_sources insert (module not registered)`);
            } else {
              const blobRow = await runtimePool.query(
                `SELECT storage_relpath FROM public.document_blobs WHERE sha256 = $1 LIMIT 1`,
                [sha256]
              );
              const storageRelpath = blobRow.rows[0]?.storage_relpath ?? null;
              try {
                const existingSource = await runtimePool.query(
                  `SELECT id FROM public.module_sources
                   WHERE module_code = $1 AND sha256 = $2 AND source_type = 'MODULE_UPLOAD'
                   LIMIT 1`,
                  [moduleCode, sha256]
                );
                if (existingSource.rows.length === 0) {
                  await runtimePool.query(
                    `INSERT INTO public.module_sources (module_code, source_type, source_label, storage_relpath, sha256, fetch_status, fetched_at)
                     VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, 'DOWNLOADED', $5)`,
                    [moduleCode, label, storageRelpath, sha256, new Date()]
                  );
                  console.log(`[SOURCE] Registered in module_sources: ${label}`);
                }
              } catch (sourceErr: any) {
                console.warn(`[WARN] Could not register module_sources row:`, sourceErr.message);
              }
            }
          } else {
            console.warn(`[WARN] ${filename} ingested but document not found in module_documents`);
          }
        } catch (verifyError: any) {
          console.error(`[ERROR] Failed to verify chunks for ${filename}:`, verifyError.message);
        }

        processedFiles.set(key, { path: pdfPath, sha256, moduleCode, processedAt: new Date() });
        console.log(`[OK] ${filename} ingested successfully into RUNTIME for ${moduleCode}`);
        // Remove from _processed (staging); canonical copy is in raw/
        fs.promises.unlink(pdfPath).catch((err) => {
          console.warn(`[WARN] Could not remove from _processed: ${pdfPath}`, err?.message ?? err);
        });
        resolve();
      } else {
        console.error(`[ERROR] ${filename} ingestion failed:`, stderr);
        try {
          const failedPath = pdfPath + ".failed";
          fs.writeFileSync(failedPath, (stderr || `Ingestion failed with code ${code}`).trim(), "utf-8");
        } catch (writeErr) {
          // Ignore
        }
        reject(new Error(`Ingestion failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/** List PDF paths in dir only (no subfolders). Skips reserved and git dirs. Only .pdf files are considered. */
function listPdfsInDir(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (DEBUG && (RESERVED_DIRS.has(e.name) || SKIP_DIRS.has(e.name))) {
        console.log(`[SCAN] ${ts()} listPdfsInDir skip dir: ${e.name}`);
      }
      continue; // do not recurse into subfolders
    }
    if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      out.push(path.join(dir, e.name));
    }
  }
  return out.sort();
}

const QUIET_SCAN_INTERVAL = 6; // log full scan summary at most every 6th scan when no work

export interface ScanSummary {
  entries: number;
  pdfsFound: number;
  rootPdfMoved: number;
  migratedMoved: number;
  migratedFailed: number;
}

async function scanModuleDirectories(
  baseDir: string,
  options?: { quiet?: boolean }
): Promise<{ files: Array<{ path: string; moduleCode: string }>; summary: ScanSummary }> {
  const results: Array<{ path: string; moduleCode: string }> = [];
  const isTopLevel = baseDir === incomingRoot;
  const quiet = options?.quiet ?? false;

  const summary: ScanSummary = {
    entries: 0,
    pdfsFound: 0,
    rootPdfMoved: 0,
    migratedMoved: 0,
    migratedFailed: 0,
  };

  if (!fs.existsSync(baseDir)) {
    if (!quiet) console.log(`[SCAN] ${ts()} Directory does not exist: ${baseDir}`);
    return { files: results, summary };
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  summary.entries = entries.length;
  if (!quiet) {
    console.log(`[SCAN] ${ts()} scanning ${baseDir}: found ${entries.length} entries`);
  }

  for (const entry of entries) {
    const name = entry.name;
    const fullPath = path.join(baseDir, name);

    if (entry.isDirectory()) {
      if (RESERVED_DIRS.has(name) || SKIP_DIRS.has(name)) {
        if (!quiet) console.log(`[SCAN] ${ts()} skip dir: ${name}`);
        continue;
      }
      // At top level: only migrate old _processed/_failed from module/pending subdirs into failed/ (single sink); do not scan subdirs for PDFs
      if (isTopLevel) {
        if (isModuleDirName(name) || isUnassignedDirName(name)) {
          const r1 = await migrateModuleSubfolderSink(
            isUnassignedDirName(name) ? UNASSIGNED_MODULE_CODE : name,
            fullPath,
            "_processed",
            failedRoot
          );
          const r2 = await migrateModuleSubfolderSink(
            isUnassignedDirName(name) ? UNASSIGNED_MODULE_CODE : name,
            fullPath,
            "_failed",
            failedRoot
          );
          summary.migratedMoved += r1.filesMoved + r2.filesMoved;
          summary.migratedFailed += r1.filesFailed + r2.filesFailed;
        }
        if (!quiet) console.log(`[SCAN] ${ts()} skip dir (incoming is flat only): ${name}`);
        continue;
      }
      const moduleCode = extractModuleCode(fullPath);
      if (moduleCode) {
        const pdfPaths = listPdfsInDir(fullPath);
        if (!quiet) console.log(`[SCAN] ${ts()} module dir ${name}: ${pdfPaths.length} pdf(s)`);
        summary.pdfsFound += pdfPaths.length;
        if (pdfPaths.length > 0) {
          for (const pdfPath of pdfPaths) {
            results.push({ path: pdfPath, moduleCode });
          }
        }
      } else {
        const sub = await scanModuleDirectories(fullPath, options);
        results.push(...sub.files);
        summary.pdfsFound += sub.summary.pdfsFound;
      }
      continue;
    }

    if (entry.isFile()) {
      // Only direct PDFs in incoming root: move to _processed then ingest to raw/; unassigned until assigned in UI
      if (isTopLevel && isPdf(name)) {
        if (!quiet) console.log(`[SCAN] ${ts()} incoming PDF: ${name} -> will move to _processed then ingest`);
        results.push({ path: fullPath, moduleCode: UNASSIGNED_MODULE_CODE });
        summary.pdfsFound += 1;
        continue;
      }
      if (!isTopLevel && isPdf(name)) {
        const moduleCode = extractModuleCode(fullPath);
        if (moduleCode) {
          results.push({ path: fullPath, moduleCode });
          summary.pdfsFound += 1;
        } else {
          console.warn(`[WARN] ${name} in module directory but no module_code found`);
        }
      } else if (isTopLevel && !quiet) {
        console.log(`[SCAN] ${ts()} skip file (not pdf): ${name}`);
      }
      continue;
    }

    if (!quiet) console.log(`[SCAN] ${ts()} skip unknown entry type: ${name}`);
  }

  return { files: results, summary };
}

async function main() {
  console.log(
    `[WATCHER] PG_TLS_INSECURE=${process.env.PG_TLS_INSECURE === "1" ? "1 (rejectUnauthorized=false)" : "0 (normal verify)"}`
  );

  const runtimePool = getRuntimePool();

  console.log(`[WATCHER] Module Ingestion Watcher (RUNTIME Only)`);
  console.log(`[WATCHER] Watching: ${incomingRoot}`);
  console.log(`[WATCHER] Staging: ${processedRoot} (incoming → _processed → ingest → raw/)`);
  console.log(`[WATCHER] Failed: ${failedRoot}`);
  console.log(`[WATCHER] Ingested: ${MODULE_STORAGE_ROOT}/raw/ (canonical, flat)`);
  console.log(`[WATCHER] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[WATCHER] NOTE: Incoming → _processed → ingest to raw/<sha256>.pdf. Unassigned until assigned in UI.`);

  // Ensure incoming and failed exist
  if (!fs.existsSync(incomingRoot)) {
    fs.mkdirSync(incomingRoot, { recursive: true });
    console.log(`[WATCHER] Created incoming directory: ${incomingRoot}`);
  }
  await ensureDir(failedRoot);

  let scanCount = 0;
  let lastHadNoWork = false;

  // Main loop
  while (true) {
    try {
      scanCount += 1;
      const quiet =
        !DEBUG && lastHadNoWork && scanCount % QUIET_SCAN_INTERVAL !== 0;
      const { files, summary } = await scanModuleDirectories(incomingRoot, {
        quiet,
      });

      const didWork =
        files.length > 0 ||
        (summary.rootPdfMoved ?? 0) > 0 ||
        (summary.migratedMoved ?? 0) > 0;
      lastHadNoWork = !didWork;

      if (files.length > 0) {
        console.log(`[SCAN] Found ${files.length} PDF file(s) to process`);
      }

      for (const { path: filePath, moduleCode: ingestModuleCode } of files) {
        try {
          const stable = await waitForStableSize(filePath);
          if (!stable) {
            console.log(`[SKIP] ${path.basename(filePath)} not stable yet`);
            continue;
          }

          // Move incoming → _processed (staging); then ingest from _processed (Python copies to raw/)
          await ensureDir(processedRoot);
          const processedPath = await moveTo(processedRoot, filePath);
          console.log(`[INFO] Moved to _processed: ${path.basename(processedPath)}`);

          await ingestModuleDocument(processedPath, ingestModuleCode, runtimePool);
          // On success ingestModuleDocument removes the file from _processed; canonical copy is in raw/
          console.log(`[INFO] Ingested; canonical copy in raw/`);
        } catch (error: any) {
          console.error(`[ERROR] Failed to process ${filePath}:`, error.message);
          try {
            // File may be in incoming or _processed; move to failed from wherever it is
            const pathToMove = fs.existsSync(filePath) ? filePath : path.join(processedRoot, path.basename(filePath));
            if (fs.existsSync(pathToMove)) {
              const failedDestPath = await moveTo(failedRoot, pathToMove);
              console.log(`[INFO] Moved to failed: ${path.basename(failedDestPath)}`);
            }
          } catch (moveErr: any) {
            console.error(`[ERROR] Could not move to failed: ${moveErr.message}`);
            // Don't crash the watcher loop
          }
        }
      }
    } catch (error: any) {
      console.error(`[ERROR] Watcher error:`, error.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
