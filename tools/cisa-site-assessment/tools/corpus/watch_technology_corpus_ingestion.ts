/**
 * Technology Library Corpus Ingestion Watcher
 *
 * Watches storage/corpus_sources/incoming/technology/ for PDFs and ingests them
 * into CORPUS as Technology Library (document_role = TECHNOLOGY_LIBRARY, RAG tag library: technology).
 * Only .pdf files in the directory; no subfolders, no .git.
 *
 * Separation: This watcher ONLY handles Technology Library corpus documents.
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { ensureNodePgTls } from "../../app/lib/db/ensure_ssl";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";
import { applyNodeTls } from "../../app/lib/db/pg_tls";

loadEnvLocal();

const CORPUS_STORAGE_ROOT = process.env.CORPUS_SOURCES_ROOT || path.resolve(process.cwd(), "storage", "corpus_sources");
const INCOMING_DIR = process.env.CORPUS_TECHNOLOGY_INCOMING || path.join(CORPUS_STORAGE_ROOT, "incoming", "technology");
const POLL_INTERVAL_MS = Number(process.env.CORPUS_WATCHER_POLL_MS || 10000);
const STORAGE_ROOT = process.env.CORPUS_SOURCES_ROOT || "storage/corpus_sources";
const TECHNOLOGY_STORAGE = path.join(STORAGE_ROOT, "technology");

/** Directories to never scan (VCS, queue sinks). */
const SKIP_DIRS = new Set([".git", "_processed", "_failed"]);

interface ProcessedFile {
  path: string;
  sha256: string;
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
    const maxChecks = maxWaitMs / checkInterval;

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

async function ingestTechnologyCorpus(pdfPath: string, dbPool: Pool): Promise<void> {
  const filename = path.basename(pdfPath);
  const sha256 = sha256File(pdfPath);

  if (processedFiles.has(sha256)) {
    console.log(`[SKIP] ${filename} already processed (SHA256: ${sha256.slice(0, 8)})`);
    return;
  }

  if (!fs.existsSync(TECHNOLOGY_STORAGE)) {
    fs.mkdirSync(TECHNOLOGY_STORAGE, { recursive: true });
  }

  const destPath = path.join(TECHNOLOGY_STORAGE, filename);
  fs.copyFileSync(pdfPath, destPath);

  const scopeTags = {
    tags: { library: "technology" },
    ingestion_stream: "GENERAL",
  };

  let sourceRegistryId: string | null = null;
  const existing = await dbPool.query(
    `SELECT id, scope_tags FROM public.source_registry WHERE doc_sha256 = $1 LIMIT 1`,
    [sha256]
  );

  if (existing.rows.length > 0) {
    sourceRegistryId = existing.rows[0].id;
    await dbPool.query(
      `UPDATE public.source_registry SET scope_tags = $1::jsonb WHERE id = $2`,
      [JSON.stringify(scopeTags), sourceRegistryId]
    );
    console.log(`[UPDATE] Updated scope_tags for existing source_registry entry (Technology Library)`);
  } else {
    const sourceKey = `TECH_${sha256.slice(0, 12)}`;
    const result = await dbPool.query(
      `INSERT INTO public.source_registry 
       (source_key, publisher, tier, title, source_type, local_path, doc_sha256, scope_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id`,
      [
        sourceKey,
        "Technology Library",
        3,
        filename.replace(/\.[^/.]+$/, ""),
        "pdf",
        destPath,
        sha256,
        JSON.stringify(scopeTags),
      ]
    );
    sourceRegistryId = result.rows[0].id;
    console.log(`[REGISTER] Created source_registry entry: ${sourceRegistryId} (Technology Library)`);
  }

  console.log(`[INGEST] ${filename} -> Technology Library (source_registry_id: ${sourceRegistryId})`);

  const pythonScript = path.resolve(process.cwd(), "tools", "corpus_ingest_pdf.py");
  const pythonExe = process.env.PYTHON_EXECUTABLE || "python";

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonExe, [
      pythonScript,
      "--pdf_path",
      destPath,
      "--source_registry_id",
      sourceRegistryId!,
      "--ingestion-stream",
      "GENERAL",
      "--source_name",
      "Technology Library",
      "--title",
      filename.replace(/\.[^/.]+$/, ""),
      "--authority_scope",
      "BASELINE_AUTHORITY",
    ]);

    let stderr = "";

    proc.stdout?.on("data", (data) => {
      // optional log
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

  console.log(`[WATCHER] Technology Library Corpus Ingestion Watcher`);
  console.log(`[WATCHER] Watching: ${INCOMING_DIR}`);
  console.log(`[WATCHER] Storage: ${TECHNOLOGY_STORAGE}`);
  console.log(`[WATCHER] Poll interval: ${POLL_INTERVAL_MS}ms`);

  if (!fs.existsSync(INCOMING_DIR)) {
    fs.mkdirSync(INCOMING_DIR, { recursive: true });
    console.log(`[WATCHER] Created incoming directory: ${INCOMING_DIR}`);
  }

  while (true) {
    try {
      const entries = fs.existsSync(INCOMING_DIR)
        ? fs.readdirSync(INCOMING_DIR, { withFileTypes: true })
        : [];
      const files = entries
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

          await ingestTechnologyCorpus(filePath, pool);

          const processedDir = path.join(INCOMING_DIR, "_processed");
          if (!fs.existsSync(processedDir)) {
            fs.mkdirSync(processedDir, { recursive: true });
          }
          const processedPath = path.join(processedDir, path.basename(filePath));
          fs.renameSync(filePath, processedPath);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[ERROR] Failed to process ${filePath}:`, msg);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] Watcher error:`, msg);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
