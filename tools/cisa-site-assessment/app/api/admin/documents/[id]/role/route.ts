import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

/**
 * GET /api/admin/documents/[id]/role
 * Get document_role for a document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getCorpusPool();

    // Check if corpus_documents table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='corpus_documents'
      )
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "corpus_documents table not found" },
        { status: 404 }
      );
    }

    // Check if document_role column exists
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' 
        AND table_name='corpus_documents'
        AND column_name='document_role'
      )
    `);

    if (!columnCheck.rows[0]?.exists) {
      return NextResponse.json(
        { error: "NOT_IMPLEMENTED", message: "document_role column not found. Run migration first." },
        { status: 501 }
      );
    }

    // Fetch document_role
    const result = await pool.query(
      `SELECT id, document_role FROM public.corpus_documents WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      document_id: result.rows[0].id,
      document_role: result.rows[0].document_role,
    });
  } catch (error) {
    console.error('[API /api/admin/documents/[id]/role GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch document role',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/documents/[id]/role
 * Update document_role for a document
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { document_role } = body;

    if (!document_role) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'document_role is required' },
        { status: 400 }
      );
    }

    const allowedRoles = ['OFC_SOURCE', 'AUTHORITY_SOURCE', 'TECHNOLOGY_LIBRARY'];
    if (!allowedRoles.includes(document_role)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: `document_role must be one of: ${allowedRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const pool = getCorpusPool();

    // Check if corpus_documents table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='corpus_documents'
      )
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "corpus_documents table not found" },
        { status: 404 }
      );
    }

    // Check if document_role column exists
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' 
        AND table_name='corpus_documents'
        AND column_name='document_role'
      )
    `);

    if (!columnCheck.rows[0]?.exists) {
      return NextResponse.json(
        { error: "NOT_IMPLEMENTED", message: "document_role column not found. Run migration first." },
        { status: 501 }
      );
    }

    // Update document_role
    const result = await pool.query(
      `UPDATE public.corpus_documents 
       SET document_role = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, document_role`,
      [document_role, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document_id: result.rows[0].id,
      document_role: result.rows[0].document_role,
    });
  } catch (error) {
    console.error('[API /api/admin/documents/[id]/role PATCH] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update document role',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
