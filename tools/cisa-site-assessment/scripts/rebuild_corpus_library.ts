#!/usr/bin/env npx tsx
/**
 * Wipe all corpus document/chunk data and re-ingest every source in source_registry
 * that has a local file (storage_relpath or local_path).
 *
 * 1. Wipe (CORPUS): rag_chunks, document_chunks, corpus_reprocess_queue,
 *    module_source_documents, corpus_documents (in FK order).
 * 2. Re-ingest: for each source_registry row with a resolvable file path,
 *    run corpus_ingest_pdf.py to create corpus_documents and chunks.
 *
 * Env: CORPUS_DATABASE_URL (required). CORPUS_SOURCES_ROOT (optional).
 *      Python: PSA_PYTHON_PROCESSOR_EXE or processor venv (see app/lib/python/venv).
 *
 * Usage:
 *   npx tsx scripts/rebuild_corpus_library.ts [--dry-run] [--wipe-only]
 *
 *   --dry-run   Log wipe and list sources that would be re-ingested; do not execute.
 *   --wipe-only Wipe corpus docs/chunks only; do not re-ingest.
 */

import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

loadEnvLocal(psaRebuildRoot);

function getCorpusSourcesRoot(): string {
  const raw = process.env.CORPUS_SOURCES_ROOT ?? "storage/corpus_sources";
  return path.isAbsolute(raw) ? raw : path.resolve(psaRebuildRoot, raw);
}

function resolveCorpusPath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").trim();
  return path.resolve(getCorpusSourcesRoot(), normalized);
}

function findPython(): string {
  const envExe = process.env.PSA_PYTHON_PROCESSOR_EXE;
  if (envExe && existsSync(envExe)) return envExe;
  try {
    const { findPythonExecutable } = require("../app/lib/python/venv") as {
      findPythonExecutable: (name: string) => string | null;
    };
    const exe = findPythonExecutable("processor");
    if (exe && existsSync(exe)) return exe;
  } catch {
    // ignore
  }
  return "python";
}

async function runIngest(
  pythonExe: string,
  scriptPath: string,
  args: {
    pdfPath: string;
    sourceRegistryId: string;
    sourceName: string;
    title: string;
    publishedAt?: string | null;
    authorityScope: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const cmdArgs = [
    scriptPath,
    "--pdf_path",
    args.pdfPath,
    "--source_registry_id",
    args.sourceRegistryId,
    "--source_name",
    args.sourceName,
    "--title",
    args.title,
    "--authority_scope",
    args.authorityScope,
  ];
  if (args.publishedAt) {
    cmdArgs.push("--published_at", args.publishedAt);
  }

  return new Promise((resolve) => {
    const proc = spawn(pythonExe, cmdArgs, {
      cwd: psaRebuildRoot,
      stdio: "pipe",
      env: { ...process.env },
      shell: false,
    });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr || `exit ${code}` });
    });
    proc.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const wipeOnly = process.argv.includes("--wipe-only");

  if (dryRun) console.log("[DRY RUN] No changes will be made.\n");

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  const scriptPath = path.join(psaRebuildRoot, "tools", "corpus_ingest_pdf.py");
  if (!existsSync(scriptPath)) {
    console.error(`Ingestion script not found: ${scriptPath}`);
    process.exit(1);
  }

  try {
    // ---------- Wipe ----------
    const wipeOrder = [
      { label: "rag_chunks", sql: "DELETE FROM public.rag_chunks" },
      { label: "document_chunks", sql: "DELETE FROM public.document_chunks" },
      { label: "corpus_reprocess_queue", sql: "DELETE FROM public.corpus_reprocess_queue" },
      { label: "module_source_documents", sql: "DELETE FROM public.module_source_documents" },
      { label: "corpus_documents", sql: "DELETE FROM public.corpus_documents" },
    ] as const;

    if (dryRun) {
      console.log("[DRY RUN] Would wipe:");
      for (const { label, sql } of wipeOrder) {
        const table = sql.replace(/DELETE FROM public\.(\w+).*/, "$1");
        const r = await pool.query(`SELECT COUNT(*) AS n FROM public.${table}`).catch(() => ({ rows: [{ n: "?" }] }));
        console.log(`  ${label}: ${r.rows[0]?.n ?? "?"} rows`);
      }
    } else {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const { label, sql } of wipeOrder) {
          const r = await client.query(sql).catch((e) => {
            if (e?.message?.includes("does not exist")) return { rowCount: 0 };
            throw e;
          });
          console.log(`  ${label}: ${r.rowCount ?? 0} rows`);
        }
        await client.query("COMMIT");
        console.log("Corpus document/chunk data wiped.\n");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    if (wipeOnly) {
      console.log("--wipe-only: skipping re-ingest.");
      return;
    }

    // ---------- Re-ingest: sources with a local file ----------
    const tierToScope: Record<number, string> = {
      1: "BASELINE_AUTHORITY",
      2: "SECTOR_AUTHORITY",
      3: "SUBSECTOR_AUTHORITY",
    };

    const sources = await pool.query<{
      id: string;
      source_key: string;
      title: string | null;
      publisher: string | null;
      publication_date: string | null;
      tier: number;
      storage_relpath: string | null;
      local_path: string | null;
    }>(
      `SELECT id, source_key, title, publisher, publication_date, tier, storage_relpath, local_path
       FROM public.source_registry
       WHERE (storage_relpath IS NOT NULL AND storage_relpath <> '')
          OR (local_path IS NOT NULL AND local_path <> '' AND local_path NOT LIKE '/%' AND local_path NOT LIKE '%:%')`
    );

    const toIngest: { id: string; absPath: string; sourceName: string; title: string; publishedAt: string | null; authorityScope: string }[] = [];
    for (const row of sources.rows) {
      const rel = (row.storage_relpath ?? row.local_path ?? "").replace(/\\/g, "/").trim();
      if (!rel) continue;
      try {
        const absPath = resolveCorpusPath(rel);
        if (!existsSync(absPath)) continue;
        const sourceName = (row.publisher ?? row.source_key ?? "Unknown").trim() || "Unknown";
        const title = (row.title ?? row.source_key ?? "Untitled").trim() || "Untitled";
        let publishedAt: string | null = null;
        if (row.publication_date) {
          const d = new Date(row.publication_date);
          if (!isNaN(d.getTime())) publishedAt = d.toISOString().split("T")[0];
          else if (typeof row.publication_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.publication_date))
            publishedAt = row.publication_date;
        }
        const authorityScope = tierToScope[row.tier] ?? "BASELINE_AUTHORITY";
        toIngest.push({ id: row.id, absPath, sourceName, title, publishedAt, authorityScope });
      } catch {
        // skip
      }
    }

    console.log(`Sources with local file: ${toIngest.length} (of ${sources.rows.length} with path).`);

    if (dryRun) {
      toIngest.forEach((s, i) => console.log(`  ${i + 1}. ${s.absPath}`));
      return;
    }

    if (toIngest.length === 0) {
      console.log("No sources to re-ingest.");
      return;
    }

    const pythonExe = findPython();
    console.log(`Using Python: ${pythonExe}\nRe-ingesting ${toIngest.length} sources...`);

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < toIngest.length; i++) {
      const s = toIngest[i];
      const result = await runIngest(pythonExe, scriptPath, {
        pdfPath: s.absPath,
        sourceRegistryId: s.id,
        sourceName: s.sourceName,
        title: s.title,
        publishedAt: s.publishedAt,
        authorityScope: s.authorityScope,
      });
      if (result.ok) {
        ok++;
        console.log(`  [${i + 1}/${toIngest.length}] OK: ${path.basename(s.absPath)}`);
      } else {
        fail++;
        console.error(`  [${i + 1}/${toIngest.length}] FAIL: ${path.basename(s.absPath)} - ${result.error?.slice(0, 120)}`);
      }
    }

    console.log(`\nDone. Ingested: ${ok}, failed: ${fail}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
