/**
 * General Corpus Ingestion Watcher
 *
 * Watches storage/corpus_sources/incoming/ for PDFs and ingests them into general corpus.
 * Tags sources with ingestion_stream: "GENERAL" and no module_code or sector/subsector tags.
 *
 * Separation: This watcher ONLY handles general assessment corpus documents.
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { ensureNodePgTls } from "../../app/lib/db/ensure_ssl";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import { applyNodeTls } from "../../app/lib/db/pg_tls";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
loadEnvLocal(PROJECT_ROOT);

// Default to storage location (can be overridden via env var)
const CORPUS_STORAGE_ROOT = process.env.CORPUS_SOURCES_ROOT || path.join(PROJECT_ROOT, "storage", "corpus_sources");
const INCOMING_DIR = process.env.CORPUS_GENERAL_INCOMING || path.join(CORPUS_STORAGE_ROOT, "incoming");
const POLL_INTERVAL_MS = Number(process.env.CORPUS_WATCHER_POLL_MS || 10000);
const GENERAL_STORAGE = path.join(CORPUS_STORAGE_ROOT, "general");

/** Directories to never scan (VCS, queue sinks). */
const SKIP_DIRS = new Set([".git", "_processed", "_failed"]);

interface ProcessedFile {
  path: string;
  sha256: string;
  processedAt: Date;
}

const processedFiles = new Map<string, ProcessedFile>();

function sha256File(filePath: string): string {
  // Use Node.js crypto for SHA256
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

      if (--maxChecks <= 0) {
        clearInterval(check);
        resolve(false);
      }
    }, checkInterval);
  });
}

async function ingestGeneralCorpus(pdfPath: string, dbPool: Pool): Promise<void> {
  const filename = path.basename(pdfPath);
  const sha256 = sha256File(pdfPath);

  // Check if already processed
  if (processedFiles.has(sha256)) {
    console.log(`[SKIP] ${filename} already processed (SHA256: ${sha256.slice(0, 8)})`);
    return;
  }

  // Ensure storage directory exists
  if (!fs.existsSync(GENERAL_STORAGE)) {
    fs.mkdirSync(GENERAL_STORAGE, { recursive: true });
  }

  // Copy to storage (use absolute path so Python script resolves correctly)
  const destPath = path.resolve(GENERAL_STORAGE, filename);
  if (!fs.existsSync(path.dirname(destPath))) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
  }
  fs.copyFileSync(pdfPath, destPath);

  // Register in source_registry with proper scope_tags
  let sourceRegistryId: string | null = null;
  const existing = await dbPool.query(
    `SELECT id, scope_tags FROM public.source_registry WHERE doc_sha256 = $1 LIMIT 1`,
    [sha256]
  );

  if (existing.rows.length > 0) {
    sourceRegistryId = existing.rows[0].id;
    // Update scope_tags if needed
    const currentScopeTags = existing.rows[0].scope_tags || {};
    const newScopeTags = {
      ...currentScopeTags,
      tags: {},
      ingestion_stream: "GENERAL"
    };
    await dbPool.query(
      `UPDATE public.source_registry SET scope_tags = $1::jsonb WHERE id = $2`,
      [JSON.stringify(newScopeTags), sourceRegistryId]
    );
    console.log(`[UPDATE] Updated scope_tags for existing source_registry entry`);
  } else {
    // Create new source_registry entry
    const sourceKey = `GEN_${sha256.slice(0, 12)}`;
    const scopeTags = {
      tags: {},
      ingestion_stream: "GENERAL"
    };
    const result = await dbPool.query(
      `INSERT INTO public.source_registry 
       (source_key, publisher, tier, title, source_type, local_path, doc_sha256, scope_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id`,
      [
        sourceKey,
        null,  // publisher: leave null; run extract_pdf_metadata --type corpus --update-db to backfill from PDF
        3,
        filename.replace(/\.[^/.]+$/, ""),
        "pdf",
        destPath,
        sha256,
        JSON.stringify(scopeTags)
      ]
    );
    sourceRegistryId = result.rows[0].id;
    console.log(`[REGISTER] Created source_registry entry: ${sourceRegistryId}`);
  }

  console.log(`[INGEST] ${filename} -> General Corpus (source_registry_id: ${sourceRegistryId})`);

  // Call Python ingestion script (args must match corpus_ingest_pdf.py: underscores, not hyphens)
  const pythonScript = path.resolve(PROJECT_ROOT, "tools", "corpus_ingest_pdf.py");
  const pythonExe = process.env.PYTHON_EXECUTABLE || "python";
  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python ingestion script not found: ${pythonScript}`);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonExe, [
      pythonScript,
      "--pdf_path", destPath,
      "--source_registry_id", sourceRegistryId!,
      "--ingestion-stream", "GENERAL",
      "--source_name", "",  // publisher from PDF content; do not use placeholder
      "--title", filename.replace(/\.[^/.]+$/, ""),
      "--authority_scope", "BASELINE_AUTHORITY",
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        processedFiles.set(sha256, { path: pdfPath, sha256, processedAt: new Date() });
        console.log(`[OK] ${filename} ingested successfully`);
        resolve();
      } else {
        console.error(`[ERROR] ${filename} ingestion failed:`, stderr);
        reject(new Error(`Ingestion failed with code ${code}`));
      }
    });
  });
}

async function main() {
  const dbUrl = process.env.CORPUS_DATABASE_URL;
  if (!dbUrl || !String(dbUrl).trim()) {
    const msg = "CORPUS_DATABASE_URL is required. Set it in psa_rebuild/.env.local (or pass it when starting the watcher).";
    console.error(`[WATCHER] ${msg}`);
    throw new Error(msg);
  }

  const connectionString = ensureNodePgTls(dbUrl) ?? dbUrl;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    await pool.query("SELECT 1");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[WATCHER] Database connection failed:", msg);
    throw new Error(`Cannot connect to CORPUS database: ${msg}`);
  }

  console.log(`[WATCHER] General Corpus Ingestion Watcher`);
  console.log(`[WATCHER] Watching: ${INCOMING_DIR}`);
  console.log(`[WATCHER] Storage: ${GENERAL_STORAGE}`);
  console.log(`[WATCHER] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Ensure incoming directory exists
  if (!fs.existsSync(INCOMING_DIR)) {
    fs.mkdirSync(INCOMING_DIR, { recursive: true });
    console.log(`[WATCHER] Created incoming directory: ${INCOMING_DIR}`);
  }

  // Main loop: only .pdf files in incoming root; ignore all subfolders and non-PDFs
  while (true) {
    try {
      const entries = fs.existsSync(INCOMING_DIR)
        ? fs.readdirSync(INCOMING_DIR, { withFileTypes: true })
        : [];
      const files = entries
        .filter((e) => !e.isDirectory()) // ignore all folders in incoming; only consider files in root
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
        .filter((e) => !SKIP_DIRS.has(e.name))
        .map((e) => path.join(INCOMING_DIR, e.name));

      for (const filePath of files) {
        try {
          const stable = await waitForStableSize(filePath);
          if (!stable) {
            console.log(`[SKIP] ${path.basename(filePath)} not stable yet`);
            continue;
          }

          await ingestGeneralCorpus(filePath, pool);

          // Move to processed subdirectory
          const processedDir = path.join(INCOMING_DIR, "_processed");
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
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[WATCHER] Fatal:", msg);
  if (e instanceof Error && e.stack) {
    console.error(e.stack);
  }
  process.exit(1);
});
