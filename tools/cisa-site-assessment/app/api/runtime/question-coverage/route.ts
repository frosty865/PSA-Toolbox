import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/question-coverage
 * 
 * Returns question coverage summary (candidate counts and promoted OFC counts).
 * 
 * Query params:
 * - target_type: 'BASE_PRIMARY' | 'EXPANSION_QUESTION' (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');

    const pool = getCorpusPool();

    let query = `
      SELECT 
        target_type,
        target_key,
        universal_candidate_count,
        context_candidate_count,
        best_universal_score,
        best_context_score,
        promoted_ofc_count
      FROM public.v_question_coverage
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (targetType) {
      query += ` AND target_type = $${paramIndex}`;
      params.push(targetType);
      paramIndex++;
    }

    query += ` ORDER BY target_type, target_key`;

    const result = await pool.query(query, params);
    
    // Transform result rows to ensure count fields are strings (avoid INT32 serialization)
    // The view v_question_coverage has count fields from COUNT() which can exceed INT32
    const transformedRows = result.rows.map((row: Record<string, unknown>) => {
      if (row.universal_candidate_count !== undefined) {
        row.universal_candidate_count = String(row.universal_candidate_count);
      }
      if (row.context_candidate_count !== undefined) {
        row.context_candidate_count = String(row.context_candidate_count);
      }
      if (row.promoted_ofc_count !== undefined) {
        row.promoted_ofc_count = String(row.promoted_ofc_count);
      }
      return row;
    });

    return NextResponse.json(transformedRows, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/runtime/question-coverage GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch question coverage',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


