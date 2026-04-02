/**
 * Module Corpus Ingestion Watcher
 * 
 * Watches storage/module_sources/incoming/ for PDFs and ingests them into module corpus.
 * Also watches storage/corpus_sources/incoming/ for module-scoped documents.
 * Tags sources with ingestion_stream: "MODULE" and module_code in tags.
 * 
 * Separation: This watcher ONLY handles module-scoped corpus documents.
 * Requires module_code to be determined from directory structure or filename.
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { ensureNodePgTls } from "../../app/lib/db/ensure_ssl";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import { applyNodeTls } from "../../app/lib/db/pg_tls";

loadEnvLocal();

// Default to storage locations (can be overridden via env vars)
const MODULE_STORAGE_ROOT = process.env.MODULE_SOURCES_ROOT || path.resolve(process.cwd(), "storage", "module_sources");
const CORPUS_STORAGE_ROOT = process.env.CORPUS_SOURCES_ROOT || path.resolve(process.cwd(), "storage", "corpus_sources");

// Watch both module_sources/incoming and corpus_sources/incoming
const MODULE_INCOMING_DIR = process.env.CORPUS_MODULE_INCOMING || path.join(MODULE_STORAGE_ROOT, "incoming");
const CORPUS_INCOMING_DIR = process.env.CORPUS_GENERAL_INCOMING || path.join(CORPUS_STORAGE_ROOT, "incoming");
const POLL_INTERVAL_MS = Number(process.env.CORPUS_WATCHER_POLL_MS || 10000);
const TEMP_MODULE_STORAGE = path.join(CORPUS_STORAGE_ROOT, "module"); // Temporary location during ingestion

/** Directories to never descend into (VCS, queue sinks). */
const SKIP_DIRS = new Set([".git", "_processed", "_failed"]);

interface ProcessedFile {
  path: string;
  sha256: string;
  moduleCode: string;
  processedAt: Date;
}

const processedFiles = new Map<string, ProcessedFile>();

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

async function ingestModuleCorpus(
  pdfPath: string,
  moduleCode: string,
  dbPool: Pool
): Promise<void> {
  const filename = path.basename(pdfPath);
  const sha256 = sha256File(pdfPath);
  const key = `${sha256}:${moduleCode}`;

  // Check if already processed for this module
  if (processedFiles.has(key)) {
    console.log(`[SKIP] ${filename} already processed for ${moduleCode}`);
    return;
  }

  // Check if already in source_registry with this module_code
  const existing = await dbPool.query(
    `SELECT id FROM public.source_registry 
     WHERE doc_sha256 = $1 
     AND scope_tags->'tags'->>'module_code' = $2
     LIMIT 1`,
    [sha256, moduleCode]
  );

  if (existing.rows.length > 0) {
    console.log(`[SKIP] ${filename} already in source_registry for ${moduleCode}`);
    processedFiles.set(key, { path: pdfPath, sha256, moduleCode, processedAt: new Date() });
    return;
  }

  // Ensure temporary storage directory exists (for ingestion)
  const tempStorageDir = path.join(TEMP_MODULE_STORAGE, moduleCode);
  if (!fs.existsSync(tempStorageDir)) {
    fs.mkdirSync(tempStorageDir, { recursive: true });
  }

  // Copy to temporary storage for ingestion
  const tempDestPath = path.join(tempStorageDir, filename);
  fs.copyFileSync(pdfPath, tempDestPath);

  // Register in source_registry with proper scope_tags
  let sourceRegistryId: string | null = null;
  const existingCheck = await dbPool.query(
    `SELECT id, scope_tags FROM public.source_registry 
     WHERE doc_sha256 = $1 
     AND scope_tags->'tags'->>'module_code' = $2
     LIMIT 1`,
    [sha256, moduleCode]
  );

  if (existingCheck.rows.length > 0) {
    sourceRegistryId = existingCheck.rows[0].id;
    // Update scope_tags if needed
    const currentScopeTags = existingCheck.rows[0].scope_tags || {};
    const newScopeTags = {
      ...currentScopeTags,
      tags: { module_code: moduleCode },
      ingestion_stream: "MODULE"
    };
    await dbPool.query(
      `UPDATE public.source_registry SET scope_tags = $1::jsonb WHERE id = $2`,
      [JSON.stringify(newScopeTags), sourceRegistryId]
    );
    console.log(`[UPDATE] Updated scope_tags for existing source_registry entry`);
  } else {
    // Create new source_registry entry
    const sourceKey = `MOD_${moduleCode}_${sha256.slice(0, 12)}`;
    const scopeTags = {
      tags: { module_code: moduleCode },
      ingestion_stream: "MODULE"
    };
    const result = await dbPool.query(
      `INSERT INTO public.source_registry 
       (source_key, publisher, tier, title, source_type, local_path, doc_sha256, scope_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id`,
      [
        sourceKey,
        `Module: ${moduleCode}`,
        3,
        filename.replace(/\.[^/.]+$/, ""),
        "pdf",
        tempDestPath, // Temporary path during ingestion
        sha256,
        JSON.stringify(scopeTags)
      ]
    );
    sourceRegistryId = result.rows[0].id;
    console.log(`[REGISTER] Created source_registry entry: ${sourceRegistryId}`);
  }

  console.log(`[INGEST] ${filename} -> Module Corpus (${moduleCode}, source_registry_id: ${sourceRegistryId})`);

  // Call Python ingestion script with source_registry_id, ingestion_stream=MODULE and module_code
  const pythonScript = resolve(process.cwd(), "tools", "corpus_ingest_pdf.py");
  const pythonExe = process.env.PYTHON_EXECUTABLE || "python";

  return new Promise(async (resolve, reject) => {
    const proc = spawn(pythonExe, [
      pythonScript,
      "--pdf-path", tempDestPath,
      "--source-registry-id", sourceRegistryId!,
      "--ingestion-stream", "MODULE",
      "--module-code", moduleCode,
      "--source-name", `Module: ${moduleCode}`,
      "--title", filename.replace(/\.[^/.]+$/, ""),
      "--authority-scope", "BASELINE_AUTHORITY",
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
        // Verify chunks exist for the ingested document
        try {
          const docResult = await dbPool.query(
            `SELECT id FROM public.corpus_documents 
             WHERE source_registry_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [sourceRegistryId]
          );

          if (docResult.rows.length > 0) {
            const documentId = docResult.rows[0].id;
            const chunkResult = await dbPool.query(
              `SELECT COUNT(*) as count FROM public.document_chunks 
               WHERE document_id = $1`,
              [documentId]
            );
            const chunkCount = parseInt(chunkResult.rows[0].count, 10);

            if (chunkCount > 0) {
              console.log(`[VERIFY] ${filename} has ${chunkCount} chunks - moving to module storage`);
              
              // Move to proper module storage location
              const moduleStorageDir = path.join(MODULE_STORAGE_ROOT, "raw", moduleCode);
              if (!fs.existsSync(moduleStorageDir)) {
                fs.mkdirSync(moduleStorageDir, { recursive: true });
              }
              
              // Generate unique filename to avoid conflicts
              const safeCode = moduleCode.replace(/[^a-zA-Z0-9_-]/g, "_");
              const nameBase = filename.replace(/\.[^/.]+$/, "");
              const ext = path.extname(filename);
              const uniqueName = `${sha256.slice(0, 12)}_${nameBase.replace(/[^a-zA-Z0-9._-]/g, "_")}${ext}`;
              const finalDestPath = path.join(moduleStorageDir, uniqueName);
              
              // Move file from temp location to final location
              fs.renameSync(tempDestPath, finalDestPath);
              
              // Update source_registry with final path
              await dbPool.query(
                `UPDATE public.source_registry 
                 SET local_path = $1 
                 WHERE id = $2`,
                [finalDestPath, sourceRegistryId]
              );
              
              console.log(`[MOVE] ${filename} moved to ${finalDestPath}`);
            } else {
              console.warn(`[WARN] ${filename} ingested but has no chunks - keeping in temp location`);
            }
          } else {
            console.warn(`[WARN] ${filename} ingested but document not found in corpus_documents`);
          }
        } catch (verifyError: any) {
          console.error(`[ERROR] Failed to verify chunks for ${filename}:`, verifyError.message);
          // Don't fail the ingestion, but log the error
        }

        processedFiles.set(key, { path: pdfPath, sha256, moduleCode, processedAt: new Date() });
        console.log(`[OK] ${filename} ingested successfully for ${moduleCode}`);
        resolve();
      } else {
        console.error(`[ERROR] ${filename} ingestion failed:`, stderr);
        // Clean up temp file on failure
        try {
          if (fs.existsSync(tempDestPath)) {
            fs.unlinkSync(tempDestPath);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        reject(new Error(`Ingestion failed with code ${code}`));
      }
    });
  });
}

async function scanModuleDirectories(baseDir: string): Promise<Array<{ path: string; moduleCode: string }>> {
  const results: Array<{ path: string; moduleCode: string }> = [];

  if (!fs.existsSync(baseDir)) {
    console.log(`[SCAN] Directory does not exist: ${baseDir}`);
    return results;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  console.log(`[SCAN] Scanning ${baseDir}: found ${entries.length} entries`);

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      // Check if directory name is a module_code
      const moduleCode = extractModuleCode(fullPath);
      if (moduleCode) {
        // Only .pdf files in this directory (no subfolders, no git)
        const subEntries = fs.existsSync(fullPath)
          ? fs.readdirSync(fullPath, { withFileTypes: true })
          : [];
        const pdfs = subEntries
          .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
          .map((e) => ({ path: path.join(fullPath, e.name), moduleCode }));
        results.push(...pdfs);
      } else {
        // Recursively scan subdirectories (still skip .git etc. on next iteration)
        const subResults = await scanModuleDirectories(fullPath);
        results.push(...subResults);
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      // Check if filename contains module_code
      const moduleCode = extractModuleCode(fullPath);
      if (moduleCode) {
        results.push({ path: fullPath, moduleCode });
      } else {
        console.warn(`[WARN] ${entry.name} in module directory but no module_code found`);
      }
    }
  }

  return results;
}

/**
 * Scan multiple incoming directories for module PDFs
 */
async function scanAllModuleDirectories(directories: string[]): Promise<Array<{ path: string; moduleCode: string }>> {
  const allResults: Array<{ path: string; moduleCode: string }> = [];
  
  for (const dir of directories) {
    const results = await scanModuleDirectories(dir);
    allResults.push(...results);
  }
  
  return allResults;
}

async function main() {
  const dbUrl = process.env.CORPUS_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("CORPUS_DATABASE_URL is required");
  }

  const connectionString = ensureNodePgTls(dbUrl) ?? dbUrl;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );

  console.log(`[WATCHER] Module Corpus Ingestion Watcher`);
  console.log(`[WATCHER] Watching: ${MODULE_INCOMING_DIR}`);
  console.log(`[WATCHER] Also watching: ${CORPUS_INCOMING_DIR}`);
  console.log(`[WATCHER] Temp Storage: ${TEMP_MODULE_STORAGE}`);
  console.log(`[WATCHER] Final Storage: ${MODULE_STORAGE_ROOT}/raw/_blobs/ (single library)`);
  console.log(`[WATCHER] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Ensure incoming directories exist
  const watchDirs = [MODULE_INCOMING_DIR, CORPUS_INCOMING_DIR];
  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[WATCHER] Created incoming directory: ${dir}`);
    }
  }

  // Main loop
  while (true) {
    try {
      const files = await scanAllModuleDirectories(watchDirs);
      
      if (files.length > 0) {
        console.log(`[SCAN] Found ${files.length} PDF file(s) to process`);
      }

      for (const { path: filePath, moduleCode } of files) {
        try {
          const stable = await waitForStableSize(filePath);
          if (!stable) {
            console.log(`[SKIP] ${path.basename(filePath)} not stable yet`);
            continue;
          }

          await ingestModuleCorpus(filePath, moduleCode, pool);

          // Move to processed subdirectory
          const processedDir = path.join(path.dirname(filePath), "_processed");
          if (!fs.existsSync(processedDir)) {
            fs.mkdirSync(processedDir, { recursive: true });
          }
          const processedPath = path.join(processedDir, path.basename(filePath));
          fs.renameSync(filePath, processedPath);
        } catch (error: any) {
          console.error(`[ERROR] Failed to process ${filePath}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`[ERROR] Watcher error:`, error.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
