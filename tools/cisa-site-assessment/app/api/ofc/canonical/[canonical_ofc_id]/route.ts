import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/ofc/canonical/{canonical_ofc_id}
 * Get a single canonical OFC with citations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonical_ofc_id: string }> }
) {
  try {
    const { canonical_ofc_id } = await params;
    const canonicalOfcId = canonical_ofc_id;

    const pool = getRuntimePool();

    // Get canonical OFC
    const ofcResult = await pool.query(
      `SELECT 
        o.*,
        d.name as discipline_name,
        d.code as discipline_code,
        ds.name as subtype_name,
        ds.code as subtype_code
      FROM public.canonical_ofcs o
      LEFT JOIN disciplines d ON o.discipline_id = d.id
      LEFT JOIN discipline_subtypes ds ON o.discipline_subtype_id = ds.id
      WHERE o.canonical_ofc_id = $1`,
      [canonicalOfcId]
    );

    if (ofcResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Canonical OFC not found' },
        { status: 404 }
      );
    }

    const ofc = ofcResult.rows[0];

    // Get citations
    const citationsResult = await pool.query(
      `SELECT * FROM public.canonical_ofc_citations
       WHERE canonical_ofc_id = $1
       ORDER BY created_at`,
      [canonicalOfcId]
    );

    return NextResponse.json({
      success: true,
      canonical_ofc: {
        ...ofc,
        citations: citationsResult.rows,
        citation_count: citationsResult.rows.length
      }
    });

  } catch (error) {
    console.error('[API /api/ofc/canonical/[canonical_ofc_id] GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch canonical OFC',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

