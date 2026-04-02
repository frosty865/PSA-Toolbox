import { NextRequest, NextResponse } from 'next/server';
import { loadBaseline } from '@/app/lib/baselineLoader';
import { loadOverlays } from '@/app/lib/overlayLoader';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { getChecklist, getDepth2Tags } from '@/app/lib/checklistLoader';
import { assertNoLegacyIntent } from '@/app/lib/invariants/noLegacyIntent';
import { getDisciplineName } from '@/app/lib/taxonomy/subtype_guidance';
import * as fs from 'fs';
import * as path from 'path';
import type { BaselineSpine, AssessmentResponseRow, YesNoNa, AuthorityScope } from '@/app/lib/types/baseline';
import type { OverlaySpine } from '@/app/lib/overlayLoader';
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// Force module evaluation
if (typeof window === 'undefined') {
  console.log('[ROUTE MODULE LOADED] /api/runtime/assessments/[assessmentId]/questions/route.ts');
}

/**
 * Coalesce question key from response row (canon_id wins, legacy fallback)
 */
function coalesceQuestionKey(r: AssessmentResponseRow): string | null {
  // Canon wins; legacy fallback only if it already equals the canon_id string
  if (r.question_canon_id) return r.question_canon_id;
  if (r.question_template_id) return r.question_template_id;
  return null;
}

interface ExpansionQuestion {
  question_code: string;
  question_text: string;
  scope_type: string;
  scope_code: string;
  expansion_version: string;
  response_enum: ["YES", "NO", "N_A"];
}

type SubtypeGuidanceLike = {
  overview?: string;
  psa_notes?: string;
  mitigation_guidance?: string[];
};

type ApiQuestion = {
  canon_id: string;
  question_text: string;
  discipline_code?: string;
  subtype_code?: string | null;
  discipline_subtype_id?: string | null;
  response_enum?: ["YES", "NO", "N_A"];
  current_response: YesNoNa | 'N/A' | null;
  question_type: 'BASELINE' | 'OVERLAY' | 'EXPANSION';
  authority_scope: AuthorityScope | 'EXPANSION';
  layer?: 'SECTOR' | 'SUBSECTOR';
  sector_id?: string | null;
  subsector_id?: string | null;
  order_index?: number;
  subtype_name?: string | null;
  discipline_name?: string | null;
  context?: string | null;
  explanation?: string | null;
  checklist?: unknown;
  question_code?: string;
  scope_type?: string;
  scope_code?: string;
  expansion_version?: string;
  canon_version?: string;
  canon_hash?: string;
  response_type?: 'YES_NO_NA' | 'CHECKLIST';
  allows_multiple?: boolean;
  response_options?: unknown;
  depth?: number;
  parent_spine_canon_id?: string | null;
  depth2_tags?: unknown;
};

type LooseObject = { [key: string]: unknown };

function getGuidance(value: unknown): SubtypeGuidanceLike | null {
  if (!value || typeof value !== 'object') return null;
  return value as SubtypeGuidanceLike;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter((item): item is string => typeof item === 'string');
  return out.length > 0 ? out : null;
}

/**
 * GET /api/runtime/assessments/[assessmentId]/questions
 * 
 * ASSESSMENT-SCOPED QUESTIONS ENDPOINT
 * 
 * Returns baseline + overlay + expansion questions for THIS assessment, with responses.
 * 
 * 1. Loads assessment to get sector_code/subsector_code from assessment_definitions
 * 2. Loads baseline spines (baseline_spines_runtime WHERE active=true) - ALWAYS included
 * 3. Loads overlay spines (overlay_spines_runtime WHERE active=true):
 *    - If sector_code present: loads SECTOR layer overlays for that sector
 *    - If subsector_code present: loads SUBSECTOR layer overlays for that subsector
 * 4. Loads applicable expansion questions from CORPUS:
 *    - scope_type='SECTOR' AND scope_code = assessment.sector_code OR
 *    - scope_type='SUBSECTOR' AND scope_code = assessment.subsector_code OR
 *    - scope_type IS NULL (universal expansions)
 * 5. Merges with assessment responses keyed by canon_id/question_code
 * 
 * Response: Array of questions (baseline + overlays + expansions) with current_response field
 * Each question includes authority_scope: "BASELINE" | "SECTOR" | "SUBSECTOR"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  console.log('[API /api/runtime/assessments/[assessmentId]/questions GET] Route hit');
  try {
    const { assessmentId } = await params;
    console.log('[API /api/runtime/assessments/[assessmentId]/questions GET] assessmentId:', assessmentId);

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();

    // 1. Load assessment and assessment_definitions to get sector_code/subsector_code
    // Cast both sides to text to handle UUID and TEXT id types robustly
    console.log('[API /api/runtime/assessments/[assessmentId]/questions GET] Querying for assessment:', assessmentId);
    const assessmentResult = await runtimePool.query(`
      SELECT 
        a.id,
        ad.sector_code,
        ad.subsector_code
      FROM public.assessments a
      LEFT JOIN public.assessment_definitions ad ON a.id::text = ad.assessment_id::text
      WHERE a.id::text = $1
      LIMIT 1
    `, [assessmentId]);

    console.log('[API /api/runtime/assessments/[assessmentId]/questions GET] Assessment query result:', {
      found: assessmentResult.rows.length > 0,
      assessmentId: assessmentResult.rows[0]?.id || 'none'
    });

    if (assessmentResult.rows.length === 0) {
      console.error('[API /api/runtime/assessments/[assessmentId]/questions GET] Assessment not found in database:', assessmentId);
      return NextResponse.json(
        { error: 'Assessment not found', assessmentId },
        { status: 404 }
      );
    }

    type AssessmentRow = { id: string; sector_code: string | null; subsector_code: string | null };
    const assessment = assessmentResult.rows[0] as AssessmentRow;
    const sectorCode = assessment.sector_code ?? null;
    const subsectorCode = assessment.subsector_code ?? null;

    // Resolve sector_id and subsector_id from codes (for overlay queries)
    // sector_code and subsector_code are TEXT codes that match sectors.id and subsectors.id
    const sectorId = sectorCode || null;
    const subsectorId = subsectorCode || null;

    // 2. Load baseline spines (active only)
    const baselineSpines: BaselineSpine[] = await loadBaseline(true);

    // 2b. Load overlay spines (if sector/subsector assigned)
    const overlaySpines = await loadOverlays(sectorId, subsectorId, true);
    console.log(`[API] Loaded ${overlaySpines.length} overlay spines (sector: ${sectorId}, subsector: ${subsectorId})`);

    // 3. Load applicable expansion questions from CORPUS database
    const corpusPool = getCorpusPool();
    let expansionQuery = `
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
    `;
    const expansionParams: (string | null)[] = [];
    let paramIndex = 1;

    if (sectorCode) {
      expansionQuery += ` OR (scope_type = 'SECTOR' AND scope_code = $${paramIndex})`;
      expansionParams.push(sectorCode);
      paramIndex++;
    }

    if (subsectorCode) {
      expansionQuery += ` OR (scope_type = 'SUBSECTOR' AND scope_code = $${paramIndex})`;
      expansionParams.push(subsectorCode);
      paramIndex++;
    }

    expansionQuery += `) ORDER BY scope_type, scope_code, question_code`;

    const expansionResult = await corpusPool.query(expansionQuery, expansionParams);
    type ExpansionRow = { question_code: string; question_text: string; scope_type: string; scope_code: string; expansion_version: string; response_enum: unknown };
    const expansionQuestions: ExpansionQuestion[] = (expansionResult.rows as ExpansionRow[]).map((row) => {
      // response_enum is stored as jsonb; pg returns it as array or string
      let responseEnum = row.response_enum;
      if (typeof responseEnum === 'string') {
        try {
          responseEnum = JSON.parse(responseEnum);
        } catch {
          responseEnum = ["YES", "NO", "N_A"];
        }
      }
      if (!Array.isArray(responseEnum) || responseEnum.length !== 3) {
        responseEnum = ["YES", "NO", "N_A"];
      }

      return {
        question_code: row.question_code,
        question_text: row.question_text,
        scope_type: row.scope_type,
        scope_code: row.scope_code,
        expansion_version: row.expansion_version,
        response_enum: responseEnum as ["YES", "NO", "N_A"]
      };
    });

    // 4. Get assessment instance IDs for response lookup
    // assessment_instances.facility_id references assessments.id
    let instanceIds: string[] = [];
    try {
      // Find instances linked to this assessment via facility_id (cast both sides to text)
      const instanceResult = await runtimePool.query(`
        SELECT id FROM public.assessment_instances 
        WHERE facility_id::text = $1
      `, [assessmentId]);
      instanceIds = (instanceResult.rows as { id: string }[]).map((r) => r.id);
      
      // Also check if assessmentId itself is an instance ID (for backward compatibility)
      const instanceByIdResult = await runtimePool.query(`
        SELECT id FROM public.assessment_instances WHERE id::text = $1
      `, [assessmentId]);
      const directInstanceIds = (instanceByIdResult.rows as { id: string }[]).map((r) => r.id);
      instanceIds = [...new Set([...instanceIds, ...directInstanceIds])]; // dedupe
    } catch (error) {
      console.warn('[API] Assessment instances query failed:', error instanceof Error ? error.message : String(error));
      // Continue with empty instanceIds - will only look up by assessmentId
    }
    
    // If no instances found, use assessmentId as fallback (for legacy compatibility)
    const allIds = instanceIds.length > 0 ? instanceIds : [assessmentId];

    // Get responses (canon_id for baseline, question_code for expansions)
    // Handle both UUID and TEXT types for assessment_instance_id
    let responsesResult;
    if (allIds.length === 0) {
      responsesResult = { rows: [] };
    } else {
      try {
        // Use ANY with text array to handle mixed UUID/TEXT types
        const idStrings = allIds.map(id => String(id));
        responsesResult = await runtimePool.query(`
          SELECT 
            question_canon_id,
            question_template_id,
            response
          FROM public.assessment_responses
          WHERE assessment_instance_id::text = ANY($1::text[])
        `, [idStrings]);
      } catch (queryError) {
        console.warn('[API] Response query failed:', queryError instanceof Error ? queryError.message : String(queryError));
        // If query fails, return empty result set (non-blocking)
        responsesResult = { rows: [] };
      }
    }

    // Build response map (canon_id/question_code as key)
    const responseMap = new Map<string, YesNoNa | 'N/A'>();
    for (const row of responsesResult.rows as AssessmentResponseRow[]) {
      const key = coalesceQuestionKey(row);
      if (!key) continue;
      const response = row.response === 'N_A' ? 'N/A' : (row.response as YesNoNa | 'N/A');
      if (response) {
        responseMap.set(key, response);
      }
    }

    // Combine baseline + overlay + expansion questions with responses
    // Baseline questions
    const baselineQuestions: ApiQuestion[] = await Promise.all(baselineSpines.map(async (spine) => {
      // TEMP DEBUG: Log discipline_subtype_id for Rekeying Procedures question
      if (spine.canon_id === 'BASE-KEY-KEY_REKEYING_PROCEDURES') {
        console.log('[API /questions] Rekeying Procedures spine:', {
          canon_id: spine.canon_id,
          discipline_subtype_id: spine.discipline_subtype_id,
          subtype_code: spine.subtype_code,
        });
      }

      // Map subtype_guidance to context and explanation for QuestionHelp component
      // Only include context/explanation if actual guidance exists (not fallbacks)
      const context = spine.subtype_guidance?.overview || null;
      const explanation = spine.subtype_guidance?.psa_notes || 
                         (spine.subtype_guidance?.mitigation_guidance && 
                          spine.subtype_guidance.mitigation_guidance.length > 0
                          ? spine.subtype_guidance.mitigation_guidance.join('\n\n')
                          : null) || null;
      
      const question: ApiQuestion = {
        ...spine,
        discipline_subtype_id: spine.discipline_subtype_id ?? null,
        current_response: responseMap.get(spine.canon_id) || null,
        question_type: 'BASELINE' as const,
        authority_scope: 'BASELINE' as AuthorityScope,
        context: context,
        explanation: explanation,
      };

      // Attach checklist for depth-1 questions with subtype_code
      if (spine.subtype_code) {
        question.checklist = getChecklist(spine.subtype_code);
      }
      
      return question;
    }));

    // Overlay questions (SECTOR and SUBSECTOR layers)
    const overlayQuestions = await Promise.all((overlaySpines as OverlaySpine[]).map(async (spine) => {
      const guidance = getGuidance(spine.subtype_guidance);
      const context = guidance?.overview ?? null;
      const explanation = guidance?.psa_notes ??
        (guidance?.mitigation_guidance && guidance.mitigation_guidance.length > 0
          ? guidance.mitigation_guidance.join('\n\n')
          : null);

      const question: ApiQuestion = {
        canon_id: spine.canon_id,
        question_text: spine.question_text,
        discipline_code: spine.discipline_code,
        subtype_code: spine.subtype_code || undefined,
        discipline_subtype_id: spine.discipline_subtype_id || null,
        response_enum: spine.response_enum,
        current_response: responseMap.get(spine.canon_id) || null,
        question_type: 'OVERLAY' as const,
        authority_scope: spine.layer as AuthorityScope,
        layer: spine.layer,
        sector_id: spine.sector_id,
        subsector_id: spine.subsector_id,
        order_index: spine.order_index,
        subtype_name: spine.subtype_name,
        discipline_name: spine.discipline_name,
        context: context,
        explanation: explanation,
      };

      // Attach checklist for depth-1 questions with subtype_code
      if (spine.subtype_code) {
        question.checklist = getChecklist(spine.subtype_code);
      }
      
      return question;
    }));

    const expansionQuestionsWithResponses = await Promise.all(expansionQuestions.map(async (eq) => {
      const question: ApiQuestion = {
        canon_id: eq.question_code,
        question_code: eq.question_code,
        question_text: eq.question_text,
        scope_type: eq.scope_type,
        scope_code: eq.scope_code,
        expansion_version: eq.expansion_version,
        response_enum: eq.response_enum,
        current_response: responseMap.get(eq.question_code) || null,
        question_type: 'EXPANSION' as const,
        authority_scope: (eq.scope_type === 'SECTOR' ? 'SECTOR' : eq.scope_type === 'SUBSECTOR' ? 'SUBSECTOR' : 'BASELINE') as AuthorityScope,
        discipline_code: undefined,
        subtype_code: undefined,
        canon_version: undefined,
        canon_hash: undefined
      };
      return question;
    }));

    // Load depth-2 questions from JSON file
    const DEPTH2_QUESTIONS_FILE = path.join(process.cwd(), 'tools', 'outputs', 'baseline_depth2_questions.json');
    type Depth2Question = ApiQuestion;
    let depth2Questions: Depth2Question[] = [];
    
    if (fs.existsSync(DEPTH2_QUESTIONS_FILE)) {
      try {
        const depth2Content = fs.readFileSync(DEPTH2_QUESTIONS_FILE, 'utf-8');
        const depth2Data = JSON.parse(depth2Content) as { questions?: unknown[] };
        const depth2QuestionsRaw = depth2Data.questions || [];

        depth2Questions = await Promise.all(depth2QuestionsRaw.map(async (dq: unknown) => {
          const row: LooseObject = (dq && typeof dq === 'object') ? (dq as LooseObject) : {};
          const canonId = toStringOrNull(row.question_code) ?? toStringOrNull(row.canon_id) ?? '';
          const disciplineCode = toStringOrNull(row.discipline_code) ?? '';
          const disciplineName = getDisciplineName(disciplineCode);

          const responseEnum = toStringArray(row.response_enum);
          const responseOptions = row.response_options ?? null;
          const question: Depth2Question = {
            canon_id: canonId,
            question_code: canonId,
            question_text: toStringOrNull(row.question_text) ?? '',
            discipline_code: disciplineCode,
            discipline_name: disciplineName || null,
            subtype_code: toStringOrNull(row.subtype_code),
            response_enum: (responseEnum && responseEnum.length === 3 ? responseEnum : ["YES", "NO", "N_A"]) as ["YES", "NO", "N_A"],
            response_type: (toStringOrNull(row.response_type) === 'CHECKLIST' ? 'CHECKLIST' : 'YES_NO_NA'),
            allows_multiple: row.allows_multiple === true,
            response_options: responseOptions,
            current_response: responseMap.get(canonId) || null,
            question_type: 'BASELINE' as const,
            authority_scope: 'BASELINE' as AuthorityScope,
            depth: 2,
            parent_spine_canon_id: toStringOrNull(row.parent_spine_canon_id),
          };
          question.depth2_tags = getDepth2Tags(canonId);

          return question;
        }));
      } catch (error) {
        console.warn('[API] Failed to load depth-2 questions:', error instanceof Error ? error.message : String(error));
      }
    }

    // Sort all questions: baseline first, then overlays (SECTOR before SUBSECTOR), then expansions
    // Within each group, sort by discipline_code, then by order_index/authority_scope
    const allQuestions = [
      ...baselineQuestions,
      ...overlayQuestions,
      ...depth2Questions,
      ...expansionQuestionsWithResponses
    ].sort((a, b) => {
      // First: sort by discipline_code
      const aDiscipline = a.discipline_code ?? '';
      const bDiscipline = b.discipline_code ?? '';
      if (aDiscipline !== bDiscipline) {
        return aDiscipline.localeCompare(bDiscipline);
      }
      
      // Second: sort by authority_scope (BASELINE < SECTOR < SUBSECTOR < EXPANSION)
      const scopeOrder: Record<string, number> = {
        'BASELINE': 0,
        'SECTOR': 1,
        'SUBSECTOR': 2,
        'EXPANSION': 3
      };
      const aScope = a.authority_scope;
      const bScope = b.authority_scope;
      const scopeDiff = (scopeOrder[aScope] || 99) - (scopeOrder[bScope] || 99);
      if (scopeDiff !== 0) return scopeDiff;
      
      // Third: sort by order_index (for overlays) or canon_id (for baseline/expansions)
      const aOrder = a.order_index !== undefined ? a.order_index : (a.canon_id || '').localeCompare(b.canon_id || '');
      const bOrder = b.order_index !== undefined ? b.order_index : (b.canon_id || '').localeCompare(a.canon_id || '');
      if (typeof aOrder === 'number' && typeof bOrder === 'number') {
        return aOrder - bOrder;
      }
      
      // Fallback: lexicographic by canon_id
      return (a.canon_id || '').localeCompare(b.canon_id || '');
    });

    // Count depth-1 questions with non-null checklists (for debug header)
    const checklistCount = [...baselineQuestions, ...overlayQuestions].filter((q: { checklist?: unknown }) => 
      q.checklist !== null && q.checklist !== undefined
    ).length;

    const body = {
      questions: allQuestions,
      total: allQuestions.length,
      metadata: {
        baseline_count: baselineQuestions.length,
        overlay_count: overlayQuestions.length,
        overlay_sector_count: overlayQuestions.filter((q: { authority_scope?: string }) => q.authority_scope === 'SECTOR').length,
        overlay_subsector_count: overlayQuestions.filter((q: { authority_scope?: string }) => q.authority_scope === 'SUBSECTOR').length,
        depth2_count: depth2Questions.length,
        expansion_count: expansionQuestionsWithResponses.length,
        sector_code: sectorCode,
        subsector_code: subsectorCode,
        baseline_version: baselineSpines[0]?.canon_version || 'unknown',
        source: 'baseline_spines_runtime + overlay_spines_runtime + depth2_questions + expansion_questions (assessment-scoped)'
      }
    };
    assertNoLegacyIntent(body, 'GET /api/runtime/assessments/[assessmentId]/questions');
    return NextResponse.json(body, { 
      status: 200,
      headers: {
        'X-Checklist-Count': String(checklistCount)
      }
    });

  } catch (error: unknown) {
    const e = error as { code?: string; detail?: string; constraint?: string; table?: string; column?: string };
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      code: e?.code,
      detail: e?.detail,
      constraint: e?.constraint,
      table: e?.table,
      column: e?.column
    };
    console.error('[API /api/runtime/assessments/[assessmentId]/questions GET] Error:', errorDetails);
    return NextResponse.json(
      {
        error: 'Failed to fetch questions',
        message: errorDetails.message,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
