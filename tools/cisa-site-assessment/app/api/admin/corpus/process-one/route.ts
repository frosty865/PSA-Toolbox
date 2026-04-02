import { NextRequest, NextResponse } from "next/server";
import { getCorpusPoolForAdmin } from "@/app/lib/db/corpus_client";
import { ingestDocumentFromFile } from "@/app/lib/sourceRegistry/ingestion";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/corpus/process-one
 * Body: { source_registry_id: string }
 * Runs the corpus ingestion path for this one source (creates corpus_document + chunks).
 */
export async function POST(request: NextRequest) {
  try {
    let body: { source_registry_id?: string } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      // optional body
    }
    const source_registry_id = body.source_registry_id;
    if (!source_registry_id || typeof source_registry_id !== "string") {
      return NextResponse.json(
        { error: "source_registry_id is required" },
        { status: 400 }
      );
    }

    const pool = getCorpusPoolForAdmin();
    const sr = await pool.query(
      `SELECT id, local_path, title, source_key FROM public.source_registry WHERE id = $1`,
      [source_registry_id]
    );
    if (sr.rows.length === 0) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    const row = sr.rows[0];
    const pdfPath = row.local_path;
    if (!pdfPath) {
      return NextResponse.json(
        { error: "Source has no local_path (file not downloaded)" },
        { status: 400 }
      );
    }
    const ingestionResult = await ingestDocumentFromFile(
      pdfPath,
      row.publisher || "",
      (row.title || row.source_key || "document").slice(0, 200),
      null,
      "BASELINE_AUTHORITY",
      source_registry_id
    );

    if (!ingestionResult.success) {
      return NextResponse.json(
        {
          error: "Ingestion failed",
          message: ingestionResult.error || "Unknown error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Processed",
      ingestion: {
        documentId: ingestionResult.documentId,
        docSha256: ingestionResult.docSha256,
        chunksCount: ingestionResult.chunksCount,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "process-one failed", message: msg }, { status: 500 });
  }
}
