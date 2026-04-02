/**
 * POST /api/admin/modules/[moduleCode]/sources/upload
 *
 * Module-scoped upload. Ingests the uploaded PDF directly into RUNTIME.module_documents
 * and RUNTIME.module_chunks, then registers the module source row.
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";
import { extractPdfMetadataFromBuffer } from "@/app/lib/pdfExtractTitle";
import { ingestModulePdfBufferToRuntime } from "@/app/lib/corpus/modulePdfIngest";

export const dynamic = "force-dynamic";

const DEBUG = Boolean(process.env.DEBUG === "1" || process.env.DEBUG?.includes("upload"));
function log(msg: string, data?: object) {
  if (DEBUG) console.log("[upload]", msg, data ?? "");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
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

    const { title: titleStem, publisher: scrapedPublisher } = await extractPdfMetadataFromBuffer(buf);
    let sourceLabel = (label && label.trim()) || titleStem || name.replace(/\.[^.]+$/, "");
    if (sourceLabel && /^[a-f0-9]{32,64}$/i.test(sourceLabel.trim())) {
      sourceLabel = "Document";
    }
    const ingest = await ingestModulePdfBufferToRuntime({
      buffer: buf,
      moduleCode: normalized,
      label: sourceLabel,
      pool,
    });

    log("ingest ok", { moduleDocumentId: ingest.moduleDocumentId, chunksCount: ingest.chunksCount, storageRelpath: ingest.storageRelpath });

    const publisher = scrapedPublisher && scrapedPublisher.trim() ? scrapedPublisher.trim() : null;
    try {
      await pool.query(
        `INSERT INTO public.module_sources (
          module_code, source_type, source_label, publisher, sha256, storage_relpath,
          content_type, fetch_status, fetched_at
        ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, $6, 'DOWNLOADED', now())`,
        [normalized, sourceLabel, publisher, ingest.sha256, ingest.storageRelpath, file.type || null]
      );
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (msg.includes("publisher") && (msg.includes("does not exist") || msg.includes("column"))) {
        await pool.query(
          `INSERT INTO public.module_sources (
            module_code, source_type, source_label, sha256, storage_relpath,
            content_type, fetch_status, fetched_at
          ) VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, 'DOWNLOADED', now())`,
          [normalized, sourceLabel, ingest.sha256, ingest.storageRelpath, file.type || null]
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
      [normalized, ingest.sha256]
    );

    log("upload complete", { storage_relpath: ingest.storageRelpath });
    return NextResponse.json({
      ok: true,
      source: row.rows[0],
      storage_relpath: ingest.storageRelpath,
    });
  } catch (e: unknown) {
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
