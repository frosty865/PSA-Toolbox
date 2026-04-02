import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { loadBaseline } from '@/app/lib/baselineLoader';
import { getGateForQuestion } from '@/app/lib/gateMetadata';
import type { BaselineSpine, AssessmentResponseRow, YesNoNa } from '@/app/lib/types/baseline';

export const dynamic = 'force-dynamic';

type GateType = 'CONTROL_EXISTS' | 'CONTROL_OPERABLE' | 'CONTROL_RESILIENCE';
const GATE_ORDER: GateType[] = ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE'];

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
 * Evaluate gates for a subtype (scoring version) - uses canon_id
 */
function evaluateGatesForSubtypeScoring(
  subtypeSpines: BaselineSpine[],
  responses: Map<string, YesNoNa | 'N/A'>
): Record<GateType, 'YES' | 'NO' | 'N_A' | 'N/A' | null> {
  const GATE_ORDER: GateType[] = ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE'];
  const gateResults: Record<GateType, 'YES' | 'NO' | 'N_A' | 'N/A' | null> = {
    CONTROL_EXISTS: null,
    CONTROL_OPERABLE: null,
    CONTROL_RESILIENCE: null,
  };

  // Group spines by gate (using canon_id to get gate)
  const spinesByGate = new Map<GateType, BaselineSpine[]>();
  for (const spine of subtypeSpines) {
    const gate = getGateForQuestion(spine.canon_id) as GateType | null;
    if (gate && GATE_ORDER.includes(gate)) {
      if (!spinesByGate.has(gate)) {
        spinesByGate.set(gate, []);
      }
      spinesByGate.get(gate)!.push(spine);
    }
  }

  // Evaluate gates in order
  for (const gate of GATE_ORDER) {
    const gateSpines = spinesByGate.get(gate);
    if (!gateSpines || gateSpines.length === 0) {
      continue;
    }

    // Check if previous gate failed (skip if so)
    if (gate === 'CONTROL_OPERABLE') {
      if (gateResults.CONTROL_EXISTS === 'NO') {
        gateResults[gate] = null; // Skipped
        continue;
      }
    } else if (gate === 'CONTROL_RESILIENCE') {
      if (gateResults.CONTROL_EXISTS === 'NO' || gateResults.CONTROL_OPERABLE === 'NO') {
        gateResults[gate] = null; // Skipped
        continue;
      }
    }

    // Get response for this gate's question (using canon_id)
    const gateSpine = gateSpines[0];
    const response = responses.get(gateSpine.canon_id);
    
    if (response === 'N_A' || response === 'N/A') {
      gateResults[gate] = 'N_A';
    } else if (response === 'NO') {
      gateResults[gate] = 'NO';
    } else if (response === 'YES') {
      gateResults[gate] = 'YES';
    }
  }

  return gateResults;
}

/**
 * ⚠️ DEPRECATED: This API endpoint is deprecated and archived.
 * 
 * GET /api/assessment/scoring?documentId=[assessmentId]
 * 
 * **Status:** DEPRECATED - Use `/api/runtime/assessments/[assessmentId]/results` instead
 * **Reason:** Legacy route using documentId parameter; conflicts with assessment-scoped architecture
 * **Archive Location:** `D:\PSA_System\archive\apis\deprecated\assessment-scoring\`
 * 
 * Returns scoring results for an assessment, using canon_id-centric baseline spines.
 * 
 * Scoring rules:
 * - Excludes N_A responses from scoring (not counted in numerator or denominator)
 * - Respects gate-order skips (skipped gates are not counted as unanswered)
 * - Provides per-discipline and per-subtype metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('documentId');

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'documentId parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Check if assessment is QA (exclude from production scoring)
    const assessmentCheck = await pool.query(`
      SELECT 
        id,
        facility_name,
        qa_flag,
        test_run_id,
        CASE 
          WHEN qa_flag = true THEN true
          WHEN test_run_id IS NOT NULL THEN true
          WHEN facility_name LIKE '[QA]%' THEN true
          ELSE false
        END as is_qa
      FROM public.assessments
      WHERE id = $1
      AND (qa_flag = false OR qa_flag IS NULL)
      AND (test_run_id IS NULL)
      AND (facility_name NOT LIKE '[QA]%' OR facility_name IS NULL)
    `, [assessmentId]);

    if (assessmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const assessment = assessmentCheck.rows[0];
    if (assessment.is_qa) {
      return NextResponse.json(
        { error: 'QA assessments are excluded from production scoring' },
        { status: 403 }
      );
    }

    // Load baseline spines from Next.js API route (consolidated)
    const spines: BaselineSpine[] = await loadBaseline(true); // active only

    // Get assessment instance IDs
    // Handle cases where template_id might reference non-existent template
    let instanceIds: string[] = [];
    try {
      // First try to find instances by ID (most common case)
      const instanceByIdResult = await pool.query(`
        SELECT id FROM public.assessment_instances WHERE id = $1
      `, [assessmentId]);
      instanceIds = instanceByIdResult.rows.map((r: Record<string, unknown>) => r.id as string);
      
      // Also try to find instances by template_id, but only if template exists
      // This avoids foreign key constraint violations
      const instanceByTemplateResult = await pool.query(`
        SELECT ai.id 
        FROM public.assessment_instances ai
        INNER JOIN public.assessment_templates at ON ai.template_id = at.id
        WHERE ai.template_id = $1 AND ai.id != $1
      `, [assessmentId]);
      const templateInstanceIds = instanceByTemplateResult.rows.map((r: Record<string, unknown>) => r.id as string);
      instanceIds = [...new Set([...instanceIds, ...templateInstanceIds])]; // dedupe
    } catch (error: unknown) {
      // If query fails, try simpler query without template join
      console.warn('[API] Assessment instances query failed, trying fallback:', error instanceof Error ? error.message : String(error));
      try {
        const instanceResult = await pool.query(`
          SELECT id FROM public.assessment_instances WHERE id = $1
        `, [assessmentId]);
        instanceIds = instanceResult.rows.map((r: Record<string, unknown>) => r.id as string);
      } catch (fallbackError) {
        console.warn('[API] Fallback query also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        // Continue with empty instanceIds - will only look up by assessmentId
      }
    }
    const allIds = [assessmentId, ...instanceIds];

    // Get responses (canon_id or legacy question_template_id)
    const responsesResult = await pool.query(`
      SELECT 
        question_canon_id,
        question_template_id,
        response
      FROM public.assessment_responses
      WHERE assessment_instance_id = ANY($1::uuid[])
    `, [allIds]);

    // Build response map (canon_id as primary key)
    const responses = new Map<string, YesNoNa | 'N/A'>();
    for (const row of responsesResult.rows as AssessmentResponseRow[]) {
      const key = coalesceQuestionKey(row);
      if (!key) continue;
      const response = row.response === 'N_A' ? 'N/A' : (row.response as YesNoNa | 'N/A');
      if (response) {
        responses.set(key, response);
      }
    }

    // Group spines by discipline and subtype
    const byDiscipline = new Map<string, BaselineSpine[]>();
    const bySubtype = new Map<string, BaselineSpine[]>();

    for (const spine of spines) {
      const disciplineCode = spine.discipline_code;
      const subtypeCode = spine.subtype_code || '';

      if (disciplineCode) {
        if (!byDiscipline.has(disciplineCode)) {
          byDiscipline.set(disciplineCode, []);
        }
        byDiscipline.get(disciplineCode)!.push(spine);
      }

      if (subtypeCode) {
        if (!bySubtype.has(subtypeCode)) {
          bySubtype.set(subtypeCode, []);
        }
        bySubtype.get(subtypeCode)!.push(spine);
      }
    }

    // Calculate scores per discipline
    type DisciplineScore = {
      discipline_code: string;
      discipline_name: string;
      numerator: number;
      denominator: number;
      percent: number | null;
      status: 'PASS' | 'FAIL' | 'N/A';
      total_applicable: number;
      yes_count: number;
      no_count: number;
      na_count: number;
    };
    const disciplineResults: DisciplineScore[] = [];
    for (const [disciplineCode, disciplineSpines] of byDiscipline.entries()) {
      // Group by subtype for gate evaluation
      const bySubtypeInDiscipline = new Map<string, BaselineSpine[]>();
      for (const spine of disciplineSpines) {
        const subtypeCode = spine.subtype_code || "";
        if (!bySubtypeInDiscipline.has(subtypeCode)) {
          bySubtypeInDiscipline.set(subtypeCode, []);
        }
        bySubtypeInDiscipline.get(subtypeCode)!.push(spine);
      }

      let yesCount = 0;
      let noCount = 0;
      let naCount = 0;
      let totalApplicable = 0;

      // Evaluate each subtype
      for (const [, subtypeSpines] of bySubtypeInDiscipline.entries()) {
        // Get responses for this subtype (keyed by canon_id)
        const subtypeResponses = new Map<string, YesNoNa | 'N/A'>();
        for (const spine of subtypeSpines) {
          const response = responses.get(spine.canon_id);
          if (response) {
            subtypeResponses.set(spine.canon_id, response);
          }
        }

        // Evaluate gates (respects gate ordering and skips)
        const gateResults = evaluateGatesForSubtypeScoring(subtypeSpines, subtypeResponses);

        // Count responses (exclude N_A and skipped gates)
        for (const gate of GATE_ORDER) {
          const result = gateResults[gate];
          if (result === null) {
            // Gate was skipped - don't count as unanswered
            continue;
          } else if (result === 'N_A' || result === 'N/A') {
            naCount++;
            // N_A is excluded from scoring
          } else if (result === 'YES') {
            yesCount++;
            totalApplicable++;
          } else if (result === 'NO') {
            noCount++;
            totalApplicable++;
          }
        }
      }

      const denominator = yesCount + noCount; // N_A excluded
      const percent = denominator > 0 ? (yesCount / denominator) * 100 : null;
      const status = percent === null ? 'N/A' : (percent >= 70 ? 'PASS' : 'FAIL');

      disciplineResults.push({
        discipline_code: disciplineCode,
        discipline_name: disciplineCode, // TODO: Lookup from taxonomy if needed
        numerator: yesCount,
        denominator: denominator,
        percent: percent,
        status: status,
        total_applicable: totalApplicable,
        yes_count: yesCount,
        no_count: noCount,
        na_count: naCount,
      });
    }

    // Calculate summary
    const totalYes = disciplineResults.reduce((sum, d) => sum + d.yes_count, 0);
    const totalNo = disciplineResults.reduce((sum, d) => sum + d.no_count, 0);
    const totalNA = disciplineResults.reduce((sum, d) => sum + d.na_count, 0);
    const totalDenominator = totalYes + totalNo;
    const totalPercent = totalDenominator > 0 ? (totalYes / totalDenominator) * 100 : null;

    return NextResponse.json({
      baseline: {
        disciplines: disciplineResults,
        summary: {
          numerator: totalYes,
          denominator: totalDenominator,
          percent: totalPercent,
          total_applicable: totalYes + totalNo,
          yes_count: totalYes,
          no_count: totalNo,
          na_count: totalNA,
        },
        canon_hash: spines[0]?.canon_hash || null,
        canon_version: spines[0]?.canon_version || null,
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/assessment/scoring GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate scoring',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

