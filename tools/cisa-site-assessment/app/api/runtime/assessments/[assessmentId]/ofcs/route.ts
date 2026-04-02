import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { loadBaseline } from '@/app/lib/baselineLoader';
import { OFC_DOCTRINE } from '@/app/lib/doctrine/ofc_doctrine';
import { columnExists } from '@/app/lib/db/table_exists';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/ofcs
 *
 * Returns canonical OFCs from runtime ofc_library only (no module OFCs, no corpus).
 * Subtype gating: question.discipline_subtype_id === ofc.discipline_subtype_id.
 * If question has no subtype → zero OFCs for that question.
 * Hard cap: max 4 OFCs per question (OFC_DOCTRINE.MAX_OFCS_PER_VULN).
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

    const assessmentCheck = await runtimePool.query(
      'SELECT id FROM public.assessments WHERE id::text = $1',
      [assessmentId]
    );
    const maxPerVuln = OFC_DOCTRINE.MAX_OFCS_PER_VULN;

    if (assessmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Load baseline questions from the canonical loader, then filter by NO responses.
    const baselineQuestions = await loadBaseline(true);

    const hasQuestionCanonId = await columnExists(runtimePool, 'public', 'assessment_responses', 'question_canon_id');
    const hasQuestionTemplateId = await columnExists(runtimePool, 'public', 'assessment_responses', 'question_template_id');
    const hasQuestionCode = await columnExists(runtimePool, 'public', 'assessment_responses', 'question_code');
    const hasResponse = await columnExists(runtimePool, 'public', 'assessment_responses', 'response');
    const hasAnswer = await columnExists(runtimePool, 'public', 'assessment_responses', 'answer');
    const responseKeyColumns = [
      hasQuestionCanonId ? 'question_canon_id' : null,
      hasQuestionTemplateId ? 'question_template_id' : null,
      hasQuestionCode ? 'question_code' : null,
    ].filter((col): col is string => Boolean(col));
    const responseValueColumn = hasResponse ? 'response' : (hasAnswer ? 'answer' : null);

    if (!responseValueColumn || responseKeyColumns.length === 0) {
      return NextResponse.json({
        assessment_id: assessmentId,
        ofcs: [],
        max_per_vuln: maxPerVuln,
      });
    }

    const responseRows = await runtimePool.query(
      `
      SELECT
        ${responseKeyColumns.join(', ')},
        ${responseValueColumn}
      FROM public.assessment_responses
      WHERE assessment_id::text = $1
        AND ${responseValueColumn} = 'NO'
      `,
      [assessmentId]
    );

    const noResponseQuestionIds = new Set<string>();
    for (const row of responseRows.rows as Array<Record<string, string | null | undefined>>) {
      const key = row.question_canon_id || row.question_template_id || row.question_code;
      if (key) {
        noResponseQuestionIds.add(String(key));
      }
    }

    const questions = baselineQuestions
      .filter((q) => noResponseQuestionIds.has(q.canon_id))
      .map((q) => ({
        canon_id: q.canon_id,
        discipline_subtype_id: q.discipline_subtype_id ?? null,
        discipline_id: q.discipline_code,
      }));
    const allOfcs: Record<string, unknown>[] = [];

    // Check if ofc_library has discipline_subtype_id (migration may not be applied)
    let hasSubtypeColumn = false;
    try {
      const colCheck = await runtimePool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'ofc_library' AND column_name = 'discipline_subtype_id'`
      );
      hasSubtypeColumn = (colCheck.rows.length ?? 0) > 0;
    } catch {
      // assume no column
    }

    for (const q of questions) {
      const canonId = q.canon_id;
      const questionSubtypeId = q.discipline_subtype_id;

      // Subtype gating: no subtype → zero OFCs
      if (!questionSubtypeId || !hasSubtypeColumn) {
        continue;
      }

      // Fetch canonical OFCs from runtime ofc_library with subtype equality
      const ofcsResult = await runtimePool.query(
        `
        SELECT
          ol.ofc_id,
          ol.ofc_text,
          ol.scope,
          ol.sector,
          ol.subsector,
          ol.link_type,
          ol.link_key,
          ol.discipline_subtype_id
        FROM public.ofc_library ol
        LEFT JOIN public.ofc_library_citations olc ON ol.ofc_id = olc.ofc_id
        WHERE ol.status = 'ACTIVE'
          AND ol.discipline_subtype_id = $1
        GROUP BY ol.ofc_id
        HAVING COUNT(olc.source_id) >= 1
        ORDER BY ol.scope DESC NULLS LAST, ol.ofc_id
        LIMIT $2
        `,
        [questionSubtypeId, maxPerVuln]
      );

      const rows = ofcsResult.rows || [];
      for (const row of rows) {
        allOfcs.push({
          ofc_id: row.ofc_id,
          ofc_code: row.ofc_id,
          ofc_text: row.ofc_text,
          required_element_canon_id: canonId,
          required_element_code: canonId,
          required_element_id: canonId,
          discipline_subtype_id: row.discipline_subtype_id,
          discipline_id: q.discipline_id,
        });
      }
    }

    return NextResponse.json({
      assessment_id: assessmentId,
      ofcs: allOfcs,
      max_per_vuln: maxPerVuln,
    });
  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/ofcs GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch OFCs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
