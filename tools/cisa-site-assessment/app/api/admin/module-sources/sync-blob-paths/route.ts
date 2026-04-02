/**
 * POST /api/admin/module-sources/sync-blob-paths
 *
 * Syncs storage paths from document_blobs to module_sources and module_documents
 * so that when files have been moved to raw/_blobs/, the DB points to the
 * canonical path. Run after consolidation or when "View document" 404s.
 *
 * - module_sources.storage_relpath <- document_blobs.storage_relpath (by sha256)
 * - module_documents.local_path <- document_blobs.storage_relpath (relative;
 *   by document_blob_id or sha256 when document_blob_id is set). Rows without
 *   a blob are unchanged.
 */

import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const pool = getRuntimePool();

    const msResult = await pool.query(
      `UPDATE public.module_sources ms
       SET storage_relpath = db.storage_relpath
       FROM public.document_blobs db
       WHERE db.sha256 = ms.sha256
         AND ms.source_type = 'MODULE_UPLOAD'
         AND (ms.storage_relpath IS DISTINCT FROM db.storage_relpath)
       RETURNING ms.id`
    );
    const msUpdated = msResult.rowCount ?? 0;

    const mdByBlob = await pool.query(
      `UPDATE public.module_documents md
       SET local_path = db.storage_relpath
       FROM public.document_blobs db
       WHERE md.document_blob_id = db.id
         AND (md.local_path IS DISTINCT FROM db.storage_relpath)
       RETURNING md.id`
    );
    const mdBySha = await pool.query(
      `UPDATE public.module_documents md
       SET local_path = db.storage_relpath, document_blob_id = db.id
       FROM public.document_blobs db
       WHERE md.sha256 = db.sha256
         AND md.document_blob_id IS NULL
         AND (md.local_path IS DISTINCT FROM db.storage_relpath OR md.document_blob_id IS DISTINCT FROM db.id)
       RETURNING md.id`
    );
    const mdUpdated = (mdByBlob.rowCount ?? 0) + (mdBySha.rowCount ?? 0);

    return NextResponse.json({
      ok: true,
      module_sources_updated: msUpdated,
      module_documents_updated: mdUpdated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-blob-paths]", e);
    return NextResponse.json(
      { error: "Sync failed", message: msg },
      { status: 500 }
    );
  }
}
