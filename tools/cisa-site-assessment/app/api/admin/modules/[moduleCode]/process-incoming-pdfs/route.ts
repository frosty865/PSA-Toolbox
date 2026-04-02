import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getComprehensionModel } from "@/app/lib/ollama/model_router";
import { extractPdfMetadataFromBuffer } from "@/app/lib/pdfExtractTitle";
import { ingestModulePdfBufferToRuntime } from "@/app/lib/corpus/modulePdfIngest";
import { replicateModuleDocsToSourceRegistry } from "@/app/lib/corpus/replicate_module_docs_to_source_registry";
import { ensureModuleComprehension } from "@/app/lib/modules/comprehension/run_module_comprehension";
import { libraryModuleIncomingDir } from "@/app/lib/storage/config";

const DEFAULT_TIMEOUT_MS = 120_000;
const RESERVED_DIRS = new Set(["_processed", "_failed"]);

type Body = {
  dryRun?: boolean;
  limit?: number | null;
  pdfDir?: string | null;
  /** Kept for backward compatibility; this Node path no longer shells out to the legacy CORPUS mirror. */
  skipCorpusIngest?: boolean;
  /** Skip comprehension pass after ingest. Default false. */
  skipComprehension?: boolean;
};

type ProcessedFile = {
  file: string;
  status: "ingested" | "already_processed" | "would_process" | "skipped";
  module_document_id?: string | null;
  chunks?: number;
  error?: string | null;
};

async function findPdfs(directory: string, recursive = true): Promise<string[]> {
  if (!existsSync(directory)) return [];
  const result: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (RESERVED_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) await walk(abs);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        result.push(abs);
      }
    }
  }

  await walk(directory);
  return result.sort((a, b) => a.localeCompare(b));
}

function normalizeSourceLabel(title: string | null, fileName: string): string {
  const stem = (title && title.trim()) || fileName.replace(/\.[^.]+$/, "");
  if (stem && /^[a-f0-9]{32,64}$/i.test(stem.trim())) {
    return "Document";
  }
  return stem || "Document";
}

function formatCommand(moduleCode: string, pdfDir: string, dryRun: boolean, limit: number | null): string {
  const parts = ["process-incoming-pdfs", `--module-code ${moduleCode}`];
  if (dryRun) parts.push("--dry-run");
  if (limit != null) parts.push(`--limit ${limit}`);
  if (pdfDir) parts.push(`--pdf-dir ${pdfDir}`);
  return parts.join(" ");
}

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
    if (!normalizedModuleCode) {
      return NextResponse.json({ error: "moduleCode is required" }, { status: 400 });
    }

    let body: Body = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text) as Body;
    } catch {
      // optional body; use defaults
    }

    const dryRun = body.dryRun !== false;
    const limit = body.limit != null && typeof body.limit === "number" ? body.limit : null;
    const pdfDir = typeof body.pdfDir === "string" && body.pdfDir.trim() ? path.resolve(body.pdfDir.trim()) : libraryModuleIncomingDir();
    const skipComprehension = body.skipComprehension === true;

    let runtimePool;
    try {
      runtimePool = getRuntimePool();
    } catch (dbError) {
      console.error("[process-incoming-pdfs] Failed to get runtime pool:", dbError);
      return NextResponse.json(
        {
          error: "Database connection failed",
          message: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 }
      );
    }

    const moduleCheck = await runtimePool.query(
      "SELECT 1 FROM public.assessment_modules WHERE module_code = $1",
      [normalizedModuleCode]
    );
    if (!moduleCheck.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (!existsSync(pdfDir)) {
      return NextResponse.json(
        {
          error: "PDF_DIR_NOT_FOUND",
          message: `PDF directory not found: ${pdfDir}`,
        },
        { status: 400 }
      );
    }

    const files = await findPdfs(pdfDir, true);
    const selected = limit != null ? files.slice(0, Math.max(0, limit)) : files;
    const command = formatCommand(normalizedModuleCode, pdfDir, dryRun, limit);

    if (dryRun) {
      const preview = selected.map((file) => `would process: ${file}`);
      return NextResponse.json({
        ok: true,
        exitCode: 0,
        stdout: preview.join("\n"),
        stderr: "",
        command,
        dryRun: true,
        corpusIngest: { exitCode: 0, skipped: true },
        comprehension: { exitCode: 0, skipped: true },
      });
    }

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const processed: ProcessedFile[] = [];
    let replicated = 0;

    for (const filePath of selected) {
      const fileName = path.basename(filePath);
      try {
        const buffer = await readFile(filePath);
        const sha256 = sha256Buffer(buffer);
        const shaCheck = await runtimePool.query(
          `SELECT 1 FROM public.module_sources
           WHERE module_code = $1 AND sha256 = $2 AND source_type = 'MODULE_UPLOAD'
           LIMIT 1`,
          [normalizedModuleCode, sha256]
        );
        if (shaCheck.rowCount) {
          processed.push({ file: filePath, status: "already_processed" });
          stdoutLines.push(`already processed: ${fileName}`);
          continue;
        }

        const meta = await extractPdfMetadataFromBuffer(buffer);
        const sourceLabel = normalizeSourceLabel(meta.title, fileName);
        const ingest = await ingestModulePdfBufferToRuntime({
          buffer,
          moduleCode: normalizedModuleCode,
          label: sourceLabel,
          pool: runtimePool,
        });

        const publisher = meta.publisher && meta.publisher.trim() ? meta.publisher.trim() : null;
        try {
          await runtimePool.query(
            `INSERT INTO public.module_sources (
              module_code, source_type, source_url, source_label, publisher, sha256, storage_relpath,
              content_type, fetch_status, fetched_at
            ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, $6, 'application/pdf', 'DOWNLOADED', now())`,
            [normalizedModuleCode, filePath, sourceLabel, publisher, ingest.sha256, ingest.storageRelpath]
          );
        } catch (insertErr: unknown) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr ?? "");
          if (msg.includes("publisher") && (msg.includes("does not exist") || msg.includes("column"))) {
            await runtimePool.query(
              `INSERT INTO public.module_sources (
                module_code, source_type, source_url, source_label, sha256, storage_relpath,
                content_type, fetch_status, fetched_at
              ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, 'application/pdf', 'DOWNLOADED', now())`,
              [normalizedModuleCode, filePath, sourceLabel, ingest.sha256, ingest.storageRelpath]
            );
          } else {
            throw insertErr;
          }
        }

        processed.push({
          file: filePath,
          status: "ingested",
          module_document_id: ingest.moduleDocumentId,
          chunks: ingest.chunksCount,
        });
        stdoutLines.push(`ingested: ${fileName} (${ingest.chunksCount} chunks)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        processed.push({ file: filePath, status: "skipped", error: message });
        stderrLines.push(`${fileName}: ${message}`);
      }
    }

    if (processed.some((row) => row.status === "skipped")) {
      return NextResponse.json(
        {
          ok: false,
          exitCode: 1,
          stdout: stdoutLines.join("\n"),
          stderr: stderrLines.join("\n"),
          command,
          dryRun: false,
          processed,
          corpusIngest: { exitCode: 0, skipped: true },
          comprehension: { exitCode: 0, skipped: true },
        },
        { status: 400 }
      );
    }

    if (processed.some((row) => row.status === "ingested")) {
      try {
        const rep = await replicateModuleDocsToSourceRegistry(normalizedModuleCode);
        replicated = rep.replicated;
      } catch (replicationError) {
        const message = replicationError instanceof Error ? replicationError.message : String(replicationError);
        stderrLines.push(`replication: ${message}`);
      }
    }

    let comprehension: { exitCode: number; skipped?: boolean; model?: string } | undefined;
    if (!skipComprehension) {
      const model = getComprehensionModel();
      await ensureModuleComprehension({
        moduleCode: normalizedModuleCode,
        model,
        runtimeDb: runtimePool,
      });
      comprehension = { exitCode: 0, skipped: false, model };
    } else {
      comprehension = { exitCode: 0, skipped: true };
    }

    return NextResponse.json({
      ok: true,
      exitCode: 0,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
      command,
      replicated,
      dryRun: false,
      processed,
      corpusIngest: { exitCode: 0, skipped: true },
      comprehension,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[process-incoming-pdfs]", err);
    console.error("[process-incoming-pdfs] Stack:", err.stack);
    return NextResponse.json(
      {
        error: "Request failed",
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
