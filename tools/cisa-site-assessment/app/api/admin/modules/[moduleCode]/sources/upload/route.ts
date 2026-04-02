/**
 * POST /api/admin/modules/[moduleCode]/sources/upload
 *
 * Module-scoped upload. Writes to MODULE_SOURCES_ROOT/raw, runs ingest (chunk) first.
 * Inserts into RUNTIME.module_sources only when the document chunks successfully.
 * Documents that don't chunk are not added to the DB; the file is removed and an error is returned.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import * as path from "path";
import { existsSync } from "fs";
import {
  getModuleSourcesRoot,
  ensureStorageDirs,
  assertModulePath,
} from "@/app/lib/storage/config";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";
import { extractPdfMetadataFromBuffer } from "@/app/lib/pdfExtractTitle";

export const dynamic = "force-dynamic";

const INGEST_SCRIPT = path.join(process.cwd(), "tools", "corpus", "ingest_module_pdf_to_runtime.py");
const INGEST_TIMEOUT_MS = 120_000;
const DEBUG = Boolean(process.env.DEBUG === "1" || process.env.DEBUG?.includes("upload"));
function log(msg: string, data?: object) {
  if (DEBUG) console.log("[upload]", msg, data ?? "");
}

async function sha256Buffer(buf: Buffer): Promise<string> {
  return createHash("sha256").update(buf).digest("hex");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  let absPath: string | null = null;

  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    const pool = await ensureRuntimePoolConnected();

    const mod = await pool.query(
      `SELECT 1 FROM public.assessment_modules WHERE module_code = $1`,
      [normalized]
    );
    if (mod.rows.length === 0) {
      return NextResponse.json(
        { error: "MODULE_NOT_FOUND", message: "Module not found" },
        { status: 404 }
      );
    }

    if (!existsSync(INGEST_SCRIPT)) {
      return NextResponse.json(
        {
          error: "INGEST_SCRIPT_MISSING",
          message: "Chunking script not found. Module upload requires the ingest script.",
          details: INGEST_SCRIPT,
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Missing form field: file" },
        { status: 400 }
      );
    }

    const label = formData.get("source_label") as string | null;
    const name = file.name || "upload";
    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);
    const sha256 = await sha256Buffer(buf);

    const { title: titleStem, publisher: scrapedPublisher } = await extractPdfMetadataFromBuffer(buf);
    const ext = path.extname(name) || ".pdf";
    let sourceLabel = (label && label.trim()) || titleStem || name.replace(/\.[^.]+$/, "");
    if (sourceLabel && /^[a-f0-9]{32,64}$/i.test(sourceLabel.trim())) {
      sourceLabel = "Document";
    }

    try {
      await ensureStorageDirs();
    } catch (storageErr: unknown) {
      const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
      console.error("[upload] ensureStorageDirs failed", msg);
      return NextResponse.json(
        {
          error: "STORAGE_INIT_FAILED",
          message: "Could not create module storage directories.",
          details: msg,
        },
        { status: 503 }
      );
    }
    const root = getModuleSourcesRoot();
    const tempRelpath = `raw/_incoming/${randomUUID()}${ext}`;
    absPath = path.join(root, tempRelpath);
    assertModulePath(absPath);

    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, buf);
    log("wrote temp file", { absPath, size: buf.length });

    const runtimeUrl = process.env.RUNTIME_DATABASE_URL || process.env.RUNTIME_DB_URL || "";
    log("spawning ingest", { script: INGEST_SCRIPT, moduleCode: normalized, hasRuntimeUrl: !!runtimeUrl });
    const result = spawnSync(
      "python",
      [INGEST_SCRIPT, "--pdf-path", absPath, "--module-code", normalized, "--label", sourceLabel],
      {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: process.cwd(), RUNTIME_DATABASE_URL: runtimeUrl },
        encoding: "utf-8",
        timeout: INGEST_TIMEOUT_MS,
      }
    );

    if (result.error || result.status !== 0) {
      log("ingest failed", { status: result.status, error: result.error?.message, stderr: (result.stderr || "").slice(0, 300) });
      try {
        await unlink(absPath);
      } catch {
        /* ignore */
      }
      const stderr = (result.stderr || "").trim().slice(0, 500);
      const errMsg = result.error?.message || stderr;
      return NextResponse.json(
        {
          error: "CHUNK_FAILED",
          message: result.error
            ? "Chunking failed (timeout or error). Document has not been added to the module."
            : "Document could not be chunked (no text or no chunks). It has not been added to the module.",
          details: errMsg,
        },
        { status: 400 }
      );
    }

    log("ingest ok, resolving blob path and inserting module_sources");
    const blobRow = await pool.query<{ storage_relpath: string }>(
      `SELECT storage_relpath FROM public.document_blobs WHERE sha256 = $1 LIMIT 1`,
      [sha256]
    );
    const storageRelpath = blobRow.rows[0]?.storage_relpath ?? null;
    if (!storageRelpath) {
      try {
        await unlink(absPath);
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          error: "BLOB_NOT_FOUND",
          message: "Document was chunked but document_blobs row not found.",
        },
        { status: 500 }
      );
    }
    try {
      await unlink(absPath);
    } catch {
      /* ignore */
    }
    absPath = null;

    const publisher = scrapedPublisher && scrapedPublisher.trim() ? scrapedPublisher.trim() : null;
    try {
      await pool.query(
        `INSERT INTO public.module_sources (
          module_code, source_type, source_label, publisher, sha256, storage_relpath,
          content_type, fetch_status, fetched_at
        ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, $6, 'DOWNLOADED', now())`,
        [normalized, sourceLabel, publisher, sha256, storageRelpath, file.type || null]
      );
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (msg.includes("publisher") && (msg.includes("does not exist") || msg.includes("column"))) {
        await pool.query(
          `INSERT INTO public.module_sources (
            module_code, source_type, source_label, sha256, storage_relpath,
            content_type, fetch_status, fetched_at
          ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, 'DOWNLOADED', now())`,
          [normalized, sourceLabel, sha256, storageRelpath, file.type || null]
        );
      } else {
        console.error("[upload] INSERT module_sources failed", msg);
        return NextResponse.json(
          {
            error: "DB_INSERT_FAILED",
            message: "Document was chunked but could not be registered in the database.",
            details: msg,
          },
          { status: 500 }
        );
      }
    }

    const row = await pool.query(
      `SELECT id, source_type, source_label, sha256, storage_relpath, created_at
       FROM public.module_sources
       WHERE module_code = $1 AND sha256 = $2
       ORDER BY created_at DESC LIMIT 1`,
      [normalized, sha256]
    );

    log("upload complete", { storage_relpath: storageRelpath });
    return NextResponse.json({
      ok: true,
      source: row.rows[0],
      storage_relpath: storageRelpath,
    });
  } catch (e: unknown) {
    if (absPath) {
      try {
        await unlink(absPath);
      } catch {
        /* ignore */
      }
    }
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[upload] error", err.message, err.stack);
    return NextResponse.json(
      {
        error: "UPLOAD_FAILED",
        message: err.message,
        details: process.env.NODE_ENV === "development" ? (e as Error)?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
