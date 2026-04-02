/**
 * GET /api/admin/modules/[moduleCode]/sources/[moduleSourceId]/file
 *
 * Serves the raw document for a MODULE_UPLOAD source.
 * Returns 404 if source is not MODULE_UPLOAD or file is missing.
 */

import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { resolveModulePath, getModuleSourcesRoot } from "@/app/lib/storage/config";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string; moduleSourceId: string }> }
) {
  try {
    const { moduleCode, moduleSourceId } = await ctx.params;
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
    const sourceId = decodeURIComponent(moduleSourceId).trim();
    if (!sourceId) {
      return NextResponse.json({ error: "Missing source id" }, { status: 400 });
    }

    const pool = getRuntimePool();
    let storageRelpath: string | null = null;
    let sourceLabel: string | null = null;

    const msRow = await pool.query(
      `SELECT id, module_code, source_type, storage_relpath, source_label
       FROM public.module_sources
       WHERE id = $1 AND module_code = $2`,
      [sourceId, normalizedModuleCode]
    );
    if (msRow.rows.length) {
      const ms = msRow.rows[0] as { source_type: string; storage_relpath: string | null; source_label: string | null };
      if (ms.source_type === "MODULE_UPLOAD" && ms.storage_relpath) {
        storageRelpath = ms.storage_relpath;
        sourceLabel = ms.source_label;
      }
    }

    // Fallback: synthetic row from module_documents (no module_sources) — resolve from document_blob or local_path
    if (!storageRelpath) {
      const docRow = await pool.query<{
        label: string | null;
        document_blob_id: string | null;
        local_path: string | null;
      }>(
        `SELECT md.label, md.document_blob_id, md.local_path
         FROM public.module_documents md
         WHERE md.id = $1 AND md.module_code = $2 AND md.status IN ('INGESTED', 'DOWNLOADED')`,
        [sourceId, normalizedModuleCode]
      );
      if (docRow.rows.length) {
        const doc = docRow.rows[0];
        sourceLabel = doc.label;
        if (doc.document_blob_id) {
          const blobRow = await pool.query<{ storage_relpath: string }>(
            `SELECT storage_relpath FROM public.document_blobs WHERE id = $1`,
            [doc.document_blob_id]
          );
          if (blobRow.rows.length) {
            storageRelpath = blobRow.rows[0].storage_relpath;
          }
        }
        if (!storageRelpath && doc.local_path) {
          const local = doc.local_path.replace(/\\/g, "/");
          if (path.isAbsolute(local)) {
            const root = getModuleSourcesRoot();
            const rel = path.relative(root, local);
            if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
              storageRelpath = rel;
            }
          } else {
            storageRelpath = local;
          }
        }
      }
    }

    if (!storageRelpath) {
      return NextResponse.json(
        { error: "Source not found or has no raw file" },
        { status: 404 }
      );
    }

    let absPath = resolveModulePath(storageRelpath);
    if (!existsSync(absPath)) {
      // Fallback: files still in raw/_blobs/ (e.g. raw/_blobs/<sha256>.pdf) after DB normalized to raw/<sha256>.pdf
      const normalized = storageRelpath.replace(/\\/g, "/").trim();
      if (normalized.startsWith("raw/") && !normalized.includes("_blobs/")) {
        const blobRelpath = normalized.replace(/^raw\//, "raw/_blobs/");
        const blobPath = resolveModulePath(blobRelpath);
        if (existsSync(blobPath)) {
          absPath = blobPath;
        }
      }
    }
    if (!existsSync(absPath)) {
      // Fallback: older uploads wrote to cwd-relative storage/module_sources (upload route used to hardcode that)
      const defaultRoot = path.resolve("storage", "module_sources");
      const fallbackPath = path.resolve(defaultRoot, storageRelpath);
      const rel = path.relative(defaultRoot, fallbackPath);
      const underDefault =
        (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)));
      if (underDefault && existsSync(fallbackPath)) {
        absPath = fallbackPath;
      } else {
        return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
      }
    }

    const buf = await readFile(absPath);
    const ext = storageRelpath.split(".").pop()?.toLowerCase() || "";
    const contentType =
      ext === "pdf"
        ? "application/pdf"
        : "application/octet-stream";
    const filename =
      (sourceLabel || "document").replace(/[^a-zA-Z0-9._-]/g, "_") +
      (ext ? `.${ext}` : "");

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    console.error("[API GET module source file]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to serve file" },
      { status: 500 }
    );
  }
}
