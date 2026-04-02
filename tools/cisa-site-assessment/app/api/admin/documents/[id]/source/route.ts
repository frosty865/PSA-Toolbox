import { NextRequest, NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/documents/[id]/source
 * Returns source provenance (publisher, title, source_key, authority_tier, status) for a document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getCorpusPool();

    // Determine document header table (corpus_documents is authoritative)
    let docTable = 'corpus_documents';
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='corpus_documents'
      )
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      // Fallback to documents table
      const documentsCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='documents'
        )
      `);
      if (documentsCheck.rows[0]?.exists) {
        docTable = 'documents';
      } else {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "Document table not found" },
          { status: 404 }
        );
      }
    }

    // Fetch document with source_registry_id
    const docResult = await pool.query(
      `SELECT id, source_registry_id FROM public.${docTable} WHERE id = $1`,
      [id]
    );

    if (docResult.rows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Document not found" },
        { status: 404 }
      );
    }

    const doc = docResult.rows[0];

    if (!doc.source_registry_id) {
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Document missing source_registry_id" },
        { status: 500 }
      );
    }

    // Fetch source registry entry
    const srcResult = await pool.query(
      `SELECT publisher, title, source_key, tier as authority_tier, status
       FROM public.source_registry 
       WHERE id = $1`,
      [doc.source_registry_id]
    );

    if (srcResult.rows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Source not found" },
        { status: 404 }
      );
    }

    const src = srcResult.rows[0];

    return NextResponse.json(
      { 
        ok: true, 
        data: {
          publisher: src.publisher,
          title: src.title,
          source_key: src.source_key,
          authority_tier: src.authority_tier,
          status: src.status || 'ACTIVE' // Default to ACTIVE if status column doesn't exist
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /api/admin/documents/[id]/source] Error:', error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
