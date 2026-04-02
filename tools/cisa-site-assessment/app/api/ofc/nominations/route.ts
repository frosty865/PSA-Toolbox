import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { logAuditEvent } from '@/app/lib/ofc-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ofc/nominations
 * Submit a new OFC nomination
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const {
      discipline_id,
      discipline_subtype_id,
      proposed_title,
      evidence_excerpt,
      evidence_page,
      submitted_by,
      submitted_role,
      attestation,
      assessment_id,
      finding_id,
      document_id,
      page
    } = body;
    
    let proposed_ofc_text = body.proposed_ofc_text;

    if (!proposed_title || !proposed_ofc_text || !evidence_excerpt) {
      return NextResponse.json(
        { error: 'Missing required fields: proposed_title, proposed_ofc_text, evidence_excerpt' },
        { status: 400 }
      );
    }

    if (!submitted_by || !submitted_role) {
      return NextResponse.json(
        { error: 'Missing required fields: submitted_by, submitted_role' },
        { status: 400 }
      );
    }

    if (!attestation) {
      return NextResponse.json(
        { error: 'Attestation required' },
        { status: 400 }
      );
    }

    if (!['FIELD', 'ENGINEER', 'GOVERNANCE'].includes(submitted_role)) {
      return NextResponse.json(
        { error: 'Invalid submitted_role. Must be FIELD, ENGINEER, or GOVERNANCE' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // HARD GUARD: Enforce no generated text
    // If ofc_id is provided, text must come from library
    // If ofc_id is null, this is a MISSING_LIBRARY_OFC stub (no text allowed)
    const ofc_id = body.ofc_id || null;
    const link_type = body.link_type || null;
    const link_key = body.link_key || null;
    const scope = body.scope || null;
    const ofc_text_snapshot = body.ofc_text_snapshot || null;
    
    if (ofc_id) {
      // Verify OFC exists in library and get text
      const ofcCheck = await pool.query(`
        SELECT ofc_text FROM public.ofc_library
        WHERE ofc_id = $1 AND status = 'ACTIVE'
      `, [ofc_id]);
      
      if (ofcCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'OFC not found in library or not ACTIVE' },
          { status: 404 }
        );
      }
      
      // Use library text, not provided text
      const library_text = ofcCheck.rows[0].ofc_text;
      if (proposed_ofc_text && proposed_ofc_text !== library_text) {
        return NextResponse.json(
          { error: 'OFC text must match library text. Use ofc_text_snapshot from library.' },
          { status: 400 }
        );
      }
      // Use library text
      proposed_ofc_text = library_text;
    } else {
      // MISSING_LIBRARY_OFC stub - no text allowed
      if (proposed_ofc_text && proposed_ofc_text.trim()) {
        return NextResponse.json(
          { error: 'Cannot provide ofc_text when ofc_id is null. Missing library OFCs must have null text.' },
          { status: 400 }
        );
      }
      proposed_ofc_text = ''; // Required field, but empty for stubs
    }

    // Insert nomination
    const result = await pool.query(
      `INSERT INTO public.ofc_nominations (
        assessment_id, finding_id, document_id, page,
        discipline_id, discipline_subtype_id,
        ofc_id, link_type, link_key, scope,
        proposed_title, proposed_ofc_text, ofc_text_snapshot,
        evidence_excerpt, evidence_page,
        submitted_by, submitted_role, status, status_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING nomination_id, status, submitted_at`,
      [
        assessment_id || null,
        finding_id || null,
        document_id || null,
        page || null,
        discipline_id || null,
        discipline_subtype_id || null,
        ofc_id,
        link_type,
        link_key,
        scope,
        proposed_title,
        proposed_ofc_text,
        ofc_text_snapshot,
        evidence_excerpt,
        evidence_page || null,
        submitted_by,
        submitted_role,
        'SUBMITTED',
        ofc_id ? null : 'MISSING_LIBRARY_OFC'
      ]
    );

    const nomination = result.rows[0];

    // Log audit event
    await logAuditEvent(
      pool,
      'OFC_NOMINATION_SUBMITTED',
      {
        nomination_id: nomination.nomination_id,
        submitted_by,
        submitted_role,
        discipline_id,
        discipline_subtype_id,
        proposed_title
      },
      submitted_by
    );

    return NextResponse.json({
      success: true,
      nomination_id: nomination.nomination_id,
      status: nomination.status,
      submitted_at: nomination.submitted_at
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API /api/ofc/nominations POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit nomination',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ofc/nominations
 * List nominations with optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const pool = getRuntimePool();

    let query = `
      SELECT 
        n.*,
        d.name as discipline_name,
        d.code as discipline_code,
        ds.name as subtype_name,
        ds.code as subtype_code
      FROM public.ofc_nominations n
      LEFT JOIN disciplines d ON n.discipline_id = d.id
      LEFT JOIN discipline_subtypes ds ON n.discipline_subtype_id = ds.id
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND n.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY n.submitted_at DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      nominations: result.rows
    });

  } catch (error: unknown) {
    console.error('[API /api/ofc/nominations GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch nominations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


