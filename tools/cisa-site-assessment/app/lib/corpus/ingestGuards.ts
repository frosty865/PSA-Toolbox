import { NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

/**
 * Guard: Verify document has source_registry_id and source is ACTIVE before ingestion
 * Aborts BEFORE parsing/chunking to prevent wasted work
 */
export async function guardDocumentSourceBeforeIngest(args: {
  documentTable: string;
  documentId: string;
}): Promise<NextResponse | null> {
  const { documentTable, documentId } = args;
  const pool = getCorpusPool();

  try {
    // Fetch document header row
    const docResult = await pool.query(
      `SELECT id, source_registry_id FROM ${documentTable} WHERE id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Document not found for ingestion" },
        { status: 500 }
      );
    }

    const doc = docResult.rows[0];

    if (!doc.source_registry_id) {
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Document missing source_registry_id; ingestion aborted" },
        { status: 500 }
      );
    }

    // Check if status column exists
    const statusColumnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema='public' 
      AND table_name='source_registry' 
      AND column_name='status'
    `);

    let sourceQuery: string;
    if (statusColumnCheck.rows.length > 0) {
      // Use status column if it exists
      sourceQuery = `SELECT id, status FROM public.source_registry WHERE id = $1`;
    } else {
      // Fallback: use source_type='web' as proxy for ACTIVE
      sourceQuery = `SELECT id, source_type as status FROM public.source_registry WHERE id = $1`;
    }

    const srcResult = await pool.query(sourceQuery, [doc.source_registry_id]);

    if (srcResult.rows.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Document references unknown source_registry_id" },
        { status: 400 }
      );
    }

    const src = srcResult.rows[0];
    const isActive = statusColumnCheck.rows.length > 0
      ? src.status === 'ACTIVE'
      : ['web', 'pdf', 'doc'].includes(String(src.status ?? ''));

    if (!isActive) {
      return NextResponse.json(
        { error: "CONFLICT", message: "Document references an inactive source; ingestion aborted" },
        { status: 409 }
      );
    }

    return null; // Guard passed
  } catch (error) {
    console.error('[Guard] Error checking document source:', error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: `Guard check failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
