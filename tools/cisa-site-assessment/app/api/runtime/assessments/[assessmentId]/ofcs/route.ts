import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { OFC_DOCTRINE } from '@/app/lib/doctrine/ofc_doctrine';

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

    if (assessmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Get all questions with NO responses and their discipline_subtype_id
    const questionsResult = await runtimePool.query(
      `
      SELECT DISTINCT
        q.canon_id,
        q.discipline_subtype_id,
        q.discipline_id
      FROM public.baseline_spines_runtime q
      INNER JOIN public.assessment_responses r
        ON q.canon_id = r.canon_id
      WHERE r.assessment_id::text = $1
        AND r.response = 'NO'
        AND q.active = true
      `,
      [assessmentId]
    );

    const questions = questionsResult.rows;
    const allOfcs: Record<string, unknown>[] = [];
    const maxPerVuln = OFC_DOCTRINE.MAX_OFCS_PER_VULN;

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
