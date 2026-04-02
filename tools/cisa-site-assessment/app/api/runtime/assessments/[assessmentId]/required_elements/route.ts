import { NextRequest, NextResponse } from 'next/server';
import { loadBaseline } from '@/app/lib/baselineLoader';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import type { BaselineSpine, AssessmentResponseRow, YesNoNa } from '@/app/lib/types/baseline';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * Coalesce question key from response row (canon_id wins, legacy fallback)
 */
function coalesceQuestionKey(r: AssessmentResponseRow): string | null {
  // Canon wins; legacy fallback only if it already equals the canon_id string
  if (r.question_canon_id) return r.question_canon_id;
  if (r.question_template_id) return r.question_template_id;
  return null;
}

/**
 * GET /api/runtime/assessments/[assessmentId]/required_elements
 * 
 * Returns baseline spines with current responses keyed by canon_id.
 * 
 * IMPORTANT: This endpoint name is legacy. Payload is now canon-centric (spines, not required_elements).
 * UI must update to consume spines array instead of required_elements array.
 * 
 * NOW USES: baseline_spines_runtime (DB) via Next.js API route (consolidated)
 * NO LEGACY FALLBACKS: Hard fails if database unavailable
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

    // Load baseline spines from Next.js API route (consolidated)
    const spines: BaselineSpine[] = await loadBaseline(true); // active only

    // Get assessment instance IDs
    const pool = getRuntimePool();
    const instanceResult = await pool.query(`
      SELECT id FROM public.assessment_instances
      WHERE facility_id = $1 OR id = $1
      LIMIT 1
    `, [assessmentId]);
    
    const instanceId = instanceResult.rows.length > 0 
      ? instanceResult.rows[0].id 
      : assessmentId;

    // Get responses (canon_id or legacy question_template_id)
    const responsesResult = await pool.query(`
      SELECT 
        question_canon_id,
        question_template_id,
        response
      FROM public.assessment_responses
      WHERE assessment_instance_id = $1
    `, [instanceId]);

    // Build response map (canon_id as primary key)
    const responseMap = new Map<string, YesNoNa | 'N/A'>();
    for (const row of responsesResult.rows as AssessmentResponseRow[]) {
      const key = coalesceQuestionKey(row);
      if (!key) continue;
      const response = row.response === 'N_A' ? 'N/A' : (row.response as YesNoNa | 'N/A');
      if (response) {
        responseMap.set(key, response);
      }
    }

    // Return spines with current responses keyed by canon_id
    const spinesWithResponses = spines.map((spine) => ({
      ...spine,
      current_response: responseMap.get(spine.canon_id) || null,
    }));

    // IMPORTANT: This endpoint name is legacy. Payload is now canon-centric.
    return NextResponse.json(
      { spines: spinesWithResponses },
      { status: 200 }
    );

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/required_elements GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch required elements',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
