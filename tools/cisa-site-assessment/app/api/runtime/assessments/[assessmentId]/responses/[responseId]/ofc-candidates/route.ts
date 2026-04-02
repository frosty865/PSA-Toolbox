import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { assertTablesOnOwnerPools } from '@/app/lib/db/pool_guard';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/responses/[responseId]/ofc-candidates
 * 
 * Returns OFC candidates from CORPUS that match the question for this assessment response.
 * 
 * Requirements:
 * - assessment_response must exist and belong to assessmentId
 * - assessment_response.answer must be "NO" (else returns 400)
 * - Returns candidates linked to the response's question_canon_id via ofc_candidate_targets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string; responseId: string }> }
) {
  try {
    // Hard guard: Assert tables are on correct pools
    await assertTablesOnOwnerPools([
      "public.assessments",
      "public.assessment_responses",
      "public.ofc_candidate_queue",
      "public.ofc_candidate_targets"
    ]);

    const { assessmentId, responseId } = await params;

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // 1. Validate assessment exists
    const assessmentCheck = await runtimePool.query(
      'SELECT id FROM public.assessments WHERE id::text = $1',
      [assessmentId]
    );

    if (assessmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found', error_code: 'ASSESSMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 2. Validate assessment_response exists, belongs to assessment, and answer == "NO"
    const responseCheck = await runtimePool.query(
      `
      SELECT id, assessment_id, question_canon_id, answer
      FROM public.assessment_responses
      WHERE id::text = $1 AND assessment_id::text = $2
      `,
      [responseId, assessmentId]
    );

    if (responseCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment response not found or does not belong to assessment', error_code: 'RESPONSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const assessmentResponse = responseCheck.rows[0];

    if (assessmentResponse.answer !== 'NO') {
      return NextResponse.json(
        { 
          error: 'Assessment response answer must be NO to view candidates', 
          error_code: 'REQUIRES_NO_VULNERABILITY',
          answer: assessmentResponse.answer
        },
        { status: 400 }
      );
    }

    const questionCanonId = assessmentResponse.question_canon_id;

    // 3. Fetch candidates from CORPUS that match this question
    // Strategy: Use ofc_candidate_targets to find candidates linked to this question_canon_id
    // Filter to only show PENDING or REVIEWED candidates (not already PROMOTED)
    const candidatesResult = await corpusPool.query(
      `
      SELECT DISTINCT
        ocq.candidate_id::text as id,
        ocq.title,
        ocq.snippet_text as recommendation_text,
        ocq.discipline_subtype_id,
        ocq.ofc_class as capability_dimension,
        ocq.ofc_origin as source_type,
        ocq.status,
        ocq.approved,
        COALESCE(MAX(oct.match_score), 0) as match_score
      FROM public.ofc_candidate_queue ocq
      INNER JOIN public.ofc_candidate_targets oct 
        ON ocq.candidate_id = oct.candidate_id
      WHERE oct.target_type = 'BASE_PRIMARY'
        AND oct.target_key = $1
        AND ocq.status IN ('PENDING', 'REVIEWED')
        AND ocq.approved = false
      GROUP BY ocq.candidate_id, ocq.title, ocq.snippet_text, ocq.discipline_subtype_id, 
               ocq.ofc_class, ocq.ofc_origin, ocq.status, ocq.approved
      ORDER BY match_score DESC, ocq.created_at DESC
      LIMIT 50
      `,
      [questionCanonId]
    );

    // Transform to minimal DTO shape
    const candidates = candidatesResult.rows.map((row) => ({
      id: row.id,
      title: row.title || 'Untitled Candidate',
      recommendation_text: row.recommendation_text || '',
      discipline_subtype_id: row.discipline_subtype_id,
      capability_dimension: row.capability_dimension || 'FOUNDATIONAL',
      source_type: row.source_type || 'CORPUS',
      match_score: parseFloat(row.match_score) || 0
    }));

    return NextResponse.json({
      ok: true,
      candidates
    });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/responses/[responseId]/ofc-candidates GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch OFC candidates',
        error_code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
