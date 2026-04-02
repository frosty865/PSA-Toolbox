import { NextRequest, NextResponse } from 'next/server';
import { getIntentIndex } from '@/app/lib/intentLoader';
import { loadBaseline } from '@/app/lib/baselineLoader';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import type { IntentObject } from '@/app/lib/types/intent';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/intent-objects
 * 
 * Returns intent objects for all questions in this assessment.
 * 
 * Response:
 * {
 *   assessmentId: string;
 *   intents: Record<canon_id, IntentObject>;
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();

    // Load assessment to get sector_code/subsector_code
    const assessmentResult = await runtimePool.query(`
      SELECT 
        a.id,
        ad.sector_code,
        ad.subsector_code
      FROM public.assessments a
      LEFT JOIN public.assessment_definitions ad ON a.id = ad.assessment_id
      WHERE a.id = $1 OR a.id::text = $1
      LIMIT 1
    `, [assessmentId]);

    if (assessmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const assessment = assessmentResult.rows[0];
    const sectorCode = assessment.sector_code || null;
    const subsectorCode = assessment.subsector_code || null;

    // Load baseline spines (these are the baseline questions)
    const baselineSpines = await loadBaseline(true);

    // Load applicable expansion questions
    const corpusPool = getCorpusPool();
    const expansionQuery = `
      SELECT 
        question_code,
        question_text,
        scope_type,
        scope_code,
        expansion_version,
        response_enum
      FROM public.expansion_questions
      WHERE is_active = true AND (
        scope_type IS NULL
        OR (scope_type = 'SECTOR' AND scope_code = $1)
        OR (scope_type = 'SUBSECTOR' AND scope_code = $2)
      )
      ORDER BY question_code
    `;

    const expansionResult = await corpusPool.query(expansionQuery, [sectorCode, subsectorCode]);
    const expansionQuestions = expansionResult.rows;

    // Collect all canon_ids from baseline + expansion
    const canonIds = new Set<string>();
    
    for (const spine of baselineSpines) {
      canonIds.add(spine.canon_id);
    }
    
    for (const exp of expansionQuestions) {
      canonIds.add(exp.question_code);
    }

    // Load intent index
    const intentIndex = getIntentIndex();
    
    // Build response: only include intents for questions that exist in this assessment
    const intents: Record<string, IntentObject> = {};
    
    for (const canonId of canonIds) {
      const intent = intentIndex.get(canonId);
      if (intent) {
        intents[canonId] = intent;
      }
    }

    return NextResponse.json({
      assessmentId,
      intents
    });
  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/intent-objects] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load intent objects for assessment',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
