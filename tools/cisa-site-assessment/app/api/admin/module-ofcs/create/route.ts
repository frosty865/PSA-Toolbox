import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/module-ofcs/create
 * 
 * Create a new MODULE OFC in ofc_candidate_queue.
 * 
 * Body:
 * - ofc_text: string (required)
 * - title: string (optional)
 * - discipline_subtype_id: UUID (required)
 * - discipline_id: UUID (optional, inferred from subtype if not provided)
 * - status: 'PENDING' | 'REVIEWED' | 'PROMOTED' | 'REJECTED' (default: 'PENDING')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.ofc_text || typeof body.ofc_text !== 'string' || body.ofc_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'ofc_text is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    if (!body.discipline_subtype_id) {
      return NextResponse.json(
        { error: 'discipline_subtype_id is required' },
        { status: 400 }
      );
    }
    
    const pool = getCorpusPool();
    
    // If discipline_id not provided, infer from subtype
    let disciplineId = body.discipline_id;
    if (!disciplineId) {
      const subtypeResult = await pool.query(`
        SELECT discipline_id 
        FROM public.discipline_subtypes 
        WHERE id = $1
      `, [body.discipline_subtype_id]);
      
      if (subtypeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid discipline_subtype_id' },
          { status: 400 }
        );
      }
      
      disciplineId = subtypeResult.rows[0].discipline_id;
    }
    
    // Get a default source_id for MODULE OFCs (or create one)
    // For MODULE OFCs, we might not have a canonical source
    // Use a placeholder source or create one
    let sourceId: string;
    const defaultSourceResult = await pool.query(`
      SELECT source_id FROM public.canonical_sources
      WHERE title = 'MODULE RESEARCH' AND publisher = 'MODULE'
      LIMIT 1
    `);
    
    if (defaultSourceResult.rows.length > 0) {
      sourceId = defaultSourceResult.rows[0].source_id;
    } else {
      // Create default source for MODULE OFCs
      const createSourceResult = await pool.query(`
        INSERT INTO public.canonical_sources 
        (title, publisher, source_type, citation_text)
        VALUES ('MODULE RESEARCH', 'MODULE', 'OTHER', 'MODULE RESEARCH, MODULE')
        RETURNING source_id
      `);
      sourceId = createSourceResult.rows[0].source_id;
    }
    
    const status = body.status || 'PENDING';
    
    // Validate ofc_class if provided
    const ofcClass = body.ofc_class || 'FOUNDATIONAL';
    if (!['FOUNDATIONAL', 'OPERATIONAL', 'PHYSICAL'].includes(ofcClass)) {
      return NextResponse.json(
        { error: 'ofc_class must be FOUNDATIONAL, OPERATIONAL, or PHYSICAL' },
        { status: 400 }
      );
    }

    // CRITICAL: Force ofc_origin='MODULE' regardless of client input
    // Ignore any incoming ofc_origin value - this endpoint ONLY creates MODULE OFCs
    // ofc_origin is now REQUIRED (NOT NULL + CHECK constraint) - always set to 'MODULE'
    if (body.ofc_origin && body.ofc_origin !== 'MODULE') {
      console.warn(`[API /api/admin/module-ofcs/create] Client attempted to set ofc_origin='${body.ofc_origin}'. Ignoring and forcing 'MODULE'.`);
    }

    try {
      const result = await pool.query(`
        INSERT INTO public.ofc_candidate_queue
        (source_id, snippet_text, title, status, ofc_origin, discipline_subtype_id, discipline_id, ofc_class)
        VALUES ($1, $2, $3, $4, 'MODULE', $5, $6, $7)
        RETURNING 
          candidate_id::text as id,
          snippet_text as ofc_text,
          title,
          status,
          discipline_subtype_id,
          discipline_id,
          ofc_class,
          created_at
      `, [
        sourceId,
        body.ofc_text.trim(),
        body.title?.trim() || null,
        status,
        body.discipline_subtype_id,
        disciplineId,
        ofcClass
      ]);
      
      return NextResponse.json({
        success: true,
        ofc: result.rows[0]
      }, { status: 201 });
    } catch (dbError: unknown) {
      const err = dbError as { code?: string; message?: string };
      if (err.code === '23514' || (err.message?.includes('chk_ofc_candidate_queue_ofc_origin') ?? false)) {
        console.error('[API /api/admin/module-ofcs/create POST] CHECK constraint violation:', dbError);
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid ofc_origin value. Must be CORPUS or MODULE.',
            message: 'Database constraint violation: ofc_origin must be CORPUS or MODULE'
          },
          { status: 400 }
        );
      }
      // Re-throw for generic error handling
      throw dbError;
    }
    
  } catch (error: unknown) {
    console.error('[API /api/admin/module-ofcs/create POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create MODULE OFC',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

