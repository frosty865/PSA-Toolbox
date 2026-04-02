import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/ofc-candidates
 * 
 * Returns OFC candidates with their question target matches.
 * 
 * Query params:
 * - status: 'PENDING' | 'REVIEWED' | 'PROMOTED' | 'REJECTED'
 * - target_type: 'BASE_PRIMARY' | 'EXPANSION_QUESTION'
 * - target_key: string (filter by specific question)
 * - match_mode: 'UNIVERSAL' | 'CONTEXT'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const targetType = searchParams.get('target_type');
    const targetKey = searchParams.get('target_key');
    const matchMode = searchParams.get('match_mode');
    const originFilter = searchParams.get('origin'); // CORPUS | MODULE | ALL (admin only)

    const pool = getCorpusPool();

    let query = `
      SELECT 
        ocq.candidate_id,
        ocq.source_id,
        ocq.snippet_text,
        ocq.page_locator,
        ocq.excerpt,
        ocq.sector,
        ocq.subsector,
        ocq.status,
        ocq.best_universal_target,
        ocq.best_context_target,
        ocq.created_at,
        cs.title as source_title,
        cs.citation_text,
        cs.source_type,
        -- Aggregate target matches
        COALESCE(
          json_agg(
            json_build_object(
              'target_type', oct.target_type,
              'target_key', oct.target_key,
              'match_mode', oct.match_mode,
              'match_score', oct.match_score
            ) ORDER BY oct.match_score DESC
          ) FILTER (WHERE oct.candidate_id IS NOT NULL),
          '[]'::json
        ) as target_matches
      FROM public.ofc_candidate_queue ocq
      JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      LEFT JOIN public.ofc_candidate_targets oct ON ocq.candidate_id = oct.candidate_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;
    
    // Filter by origin: default CORPUS, allow MODULE or ALL via query param (admin only)
    if (originFilter === 'MODULE') {
      query += ` AND ocq.ofc_origin = $${paramIndex}`;
      params.push('MODULE');
      paramIndex++;
    } else if (originFilter === 'ALL') {
      // Show all origins (admin debug mode)
      // No additional filter
    } else {
      // Default: CORPUS only
      query += ` AND ocq.ofc_origin = $${paramIndex}`;
      params.push('CORPUS');
      paramIndex++;
    }

    if (status) {
      query += ` AND ocq.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (targetType && targetKey) {
      query += ` AND EXISTS (
        SELECT 1 FROM public.ofc_candidate_targets oct2
        WHERE oct2.candidate_id = ocq.candidate_id
        AND oct2.target_type = $${paramIndex}
        AND oct2.target_key = $${paramIndex + 1}
      )`;
      params.push(targetType, targetKey);
      paramIndex += 2;
    }

    if (matchMode) {
      query += ` AND EXISTS (
        SELECT 1 FROM public.ofc_candidate_targets oct3
        WHERE oct3.candidate_id = ocq.candidate_id
        AND oct3.match_mode = $${paramIndex}
      )`;
      params.push(matchMode);
      paramIndex++;
    }

    query += `
      GROUP BY ocq.candidate_id, cs.source_id, cs.title, cs.citation_text, cs.source_type
      ORDER BY ocq.created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/runtime/ofc-candidates GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch OFC candidates',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


