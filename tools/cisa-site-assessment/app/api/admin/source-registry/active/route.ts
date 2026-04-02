import { NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/source-registry/active
 * List all CORPUS sources for dropdown selection (for attaching to modules)
 * 
 * NOTE: Changed to show ALL sources, not just "ACTIVE" ones, because:
 * - Users should be able to attach any evidence from CORPUS
 * - Status filtering was too restrictive (only 2 of 95 sources were showing)
 * - For module attachment, all CORPUS sources are valid read-only references
 */
export async function GET() {
  try {
    const pool = getCorpusPool();

    // Fetch only sources that have been ingested (have corpus_documents with chunks)
    // A source is "ingested" if it has corpus_documents with actual chunks in document_chunks table
    // We require: corpus_documents exists AND document_chunks exists (INNER JOIN ensures chunks exist)
    // Also require processing_status = 'PROCESSED' to ensure ingestion completed successfully
    const query = `
      SELECT DISTINCT
        sr.id,
        sr.source_key,
        sr.publisher,
        sr.title,
        sr.tier,
        sr.notes
      FROM public.source_registry sr
      INNER JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
      INNER JOIN public.document_chunks dc ON dc.document_id = cd.id
      WHERE cd.processing_status = 'PROCESSED'
        AND cd.chunk_count > 0
      ORDER BY sr.publisher ASC, sr.title ASC
    `;

    const result = await pool.query(query);

    // Return only sources with chunks (ingested)
    const ingestedSources = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      source_key: row.source_key,
      publisher: row.publisher,
      title: row.title,
      tier: row.tier,
    }));

    return NextResponse.json({ 
      ok: true, 
      data: ingestedSources 
    }, { status: 200 });
  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/active GET] Error:', error);
    return NextResponse.json(
      { 
        error: "INTERNAL_ERROR", 
        message: "Failed to load sources",
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

