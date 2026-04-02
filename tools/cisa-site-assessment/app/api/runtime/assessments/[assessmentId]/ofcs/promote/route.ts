import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { assertTablesOnOwnerPools } from '@/app/lib/db/pool_guard';
import { assertOfcWriteAllowed } from '@/app/lib/ofc_write_guard';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * POST /api/runtime/assessments/[assessmentId]/ofcs/promote
 * 
 * Two-phase promotion:
 * A) CORPUS: marks candidate as approved/promoted
 * B) RUNTIME: creates OFC in ofc_library and links it to assessment NO response
 * 
 * Body:
 * {
 *   "candidate_id": "<uuid>",
 *   "assessment_response_id": "<uuid>"
 * }
 * 
 * Requirements:
 * - assessment_response must exist and belong to assessmentId
 * - assessment_response.answer must be "NO"
 * - candidate must exist in CORPUS
 * - candidate.discipline_subtype_id must be valid in RUNTIME taxonomy
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    // Hard guard: Assert tables are on correct pools
    await assertTablesOnOwnerPools([
      "public.assessments",
      "public.assessment_responses",
      "public.ofc_candidate_queue",
      "public.ofc_library",
      "public.ofc_nominations",
      "public.promote_audit_log"
    ]);

    const { assessmentId } = await params;
    const body = await request.json();

    if (!body.candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id is required', error_code: 'MISSING_CANDIDATE_ID' },
        { status: 400 }
      );
    }

    if (!body.assessment_response_id) {
      return NextResponse.json(
        { error: 'assessment_response_id is required', error_code: 'MISSING_ASSESSMENT_RESPONSE_ID' },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // 1. Validate assessment exists
    const assessmentCheck = await runtimePool.query(
      'SELECT id, sector_name, subsector_name FROM public.assessments WHERE id::text = $1',
      [assessmentId]
    );

    if (assessmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found', error_code: 'ASSESSMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const assessment = assessmentCheck.rows[0];

    // 2. Validate assessment_response exists, belongs to assessment, and answer == "NO"
    const responseCheck = await runtimePool.query(
      `
      SELECT id, assessment_id, question_canon_id, answer
      FROM public.assessment_responses
      WHERE id::text = $1 AND assessment_id::text = $2
      `,
      [body.assessment_response_id, assessmentId]
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
          error: 'Assessment response answer must be NO to promote OFC', 
          error_code: 'REQUIRES_NO_VULNERABILITY',
          answer: assessmentResponse.answer
        },
        { status: 400 }
      );
    }

    const questionCanonId = assessmentResponse.question_canon_id;

    // 3. Fetch candidate from CORPUS
    const candidateResult = await corpusPool.query(
      `
      SELECT 
        candidate_id,
        snippet_text,
        title,
        discipline_id,
        discipline_subtype_id,
        sector,
        subsector,
        source_id,
        source_registry_id,
        ofc_class,
        ofc_origin
      FROM public.ofc_candidate_queue
      WHERE candidate_id::text = $1
      `,
      [body.candidate_id]
    );

    if (candidateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found in CORPUS', error_code: 'CANDIDATE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const candidate = candidateResult.rows[0];

    // Check if candidate is already promoted (idempotency check)
    if (candidate.status === 'PROMOTED' && candidate.approved === true) {
      // Candidate already promoted - check if OFC and nomination exist
      // This allows re-promotion to different assessments
      console.log(`[PROMOTE] Candidate ${body.candidate_id} already promoted, checking for existing OFC`);
    }

    // 4. Validate discipline_subtype_id exists in RUNTIME taxonomy
    if (!candidate.discipline_subtype_id) {
      return NextResponse.json(
        { error: 'Candidate missing discipline_subtype_id. Cannot promote without taxonomy.', error_code: 'MISSING_DISCIPLINE_SUBTYPE' },
        { status: 400 }
      );
    }

    const subtypeCheck = await runtimePool.query(
      `
      SELECT id, discipline_id, code, is_active
      FROM public.discipline_subtypes
      WHERE id = $1
      `,
      [candidate.discipline_subtype_id]
    );

    if (subtypeCheck.rows.length === 0 || !subtypeCheck.rows[0].is_active) {
      return NextResponse.json(
        { 
          error: 'Invalid or inactive discipline_subtype_id in RUNTIME taxonomy', 
          error_code: 'INVALID_DISCIPLINE_SUBTYPE',
          discipline_subtype_id: candidate.discipline_subtype_id
        },
        { status: 400 }
      );
    }

    const disciplineSubtype = subtypeCheck.rows[0];

    // 5. Determine scope, sector, subsector for ofc_library
    // Use assessment sector/subsector if available, otherwise BASELINE
    let scope: 'BASELINE' | 'SECTOR' | 'SUBSECTOR' = 'BASELINE';
    let sector: string | null = null;
    let subsector: string | null = null;

    if (assessment.subsector_name) {
      scope = 'SUBSECTOR';
      sector = assessment.sector_name || null;
      subsector = assessment.subsector_name;
    } else if (assessment.sector_name) {
      scope = 'SECTOR';
      sector = assessment.sector_name;
      subsector = null;
    }

    // Determine link_type based on question source
    // For now, assume PRIMARY_QUESTION (can be enhanced later to check expansion_questions)
    const linkType = 'PRIMARY_QUESTION';
    const linkKey = questionCanonId;

    // 6. Create or reuse OFC in RUNTIME.ofc_library (admin promotion only)
    assertOfcWriteAllowed({ source: 'ADMIN_AUTHORING' });

    // Use ON CONFLICT to reuse existing OFC if it matches unique constraint
    const ofcText = candidate.snippet_text || candidate.title || '';
    const solutionRole = 'COMPLETE'; // Default to COMPLETE, can be made configurable

    const ofcInsertResult = await runtimePool.query(
      `
      INSERT INTO public.ofc_library (
        scope,
        sector,
        subsector,
        link_type,
        link_key,
        trigger_response,
        ofc_text,
        solution_role,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (scope, sector, subsector, link_type, link_key, trigger_response, ofc_text)
      DO UPDATE SET updated_at = now()
      RETURNING ofc_id
      `,
      [scope, sector, subsector, linkType, linkKey, 'NO', ofcText, solutionRole, 'ACTIVE']
    );

    const ofcId = ofcInsertResult.rows[0].ofc_id;

    // 7. Create citation link if source_registry_id exists (CORPUS)
    // Note: ofc_library_citations is in CORPUS, so we need to handle this separately
    // For now, we'll skip citations in this endpoint as they should be managed separately
    // The user requirement is to create the OFC and link, citations are handled elsewhere

    // 8. Create link record in ofc_nominations (idempotent UPSERT)
    // Uses unique constraints to prevent duplicates: (assessment_id, assessment_response_id, candidate_id)
    // and (assessment_id, assessment_response_id, ofc_id)
    
    const evidenceExcerpt = JSON.stringify({
      promoted_from_candidate: body.candidate_id,
      assessment_response_id: body.assessment_response_id,
      question_canon_id: questionCanonId,
      promotion_timestamp: new Date().toISOString()
    });

    let finalNominationId: string | null = null;
    let isAlreadyPromoted = false;

    // Try to insert, handle unique constraint violations gracefully
    try {
      const nominationInsertResult = await runtimePool.query(
        `
        INSERT INTO public.ofc_nominations (
          assessment_id,
          ofc_id,
          link_type,
          link_key,
          scope,
          sector,
          subsector,
          proposed_title,
          proposed_ofc_text,
          ofc_text_snapshot,
          evidence_excerpt,
          submitted_by,
          submitted_role,
          status,
          discipline_id,
          discipline_subtype_id,
          assessment_response_id,
          candidate_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING nomination_id
        `,
        [
          assessmentId,
          ofcId,
          linkType,
          linkKey, // question_canon_id
          scope,
          sector,
          subsector,
          candidate.title || 'Promoted OFC',
          ofcText,
          ofcText, // snapshot same as text
          evidenceExcerpt, // JSON with candidate_id, assessment_response_id, question_canon_id
          'SYSTEM', // submitted_by
          'ENGINEER', // submitted_role
          'SUBMITTED', // status
          disciplineSubtype.discipline_id,
          candidate.discipline_subtype_id,
          body.assessment_response_id, // assessment_response_id
          body.candidate_id // candidate_id
        ]
      );

      finalNominationId = nominationInsertResult.rows[0]?.nomination_id;
    } catch (insertError: unknown) {
      const err = insertError && typeof insertError === "object" ? insertError as { code?: string } : {};
      if (err.code === "23505") {
        // Nomination already exists - fetch it
        const existingNomination = await runtimePool.query(
          `
          SELECT nomination_id, ofc_id, assessment_response_id, candidate_id
          FROM public.ofc_nominations
          WHERE assessment_id::text = $1
            AND assessment_response_id::text = $2
            AND candidate_id::text = $3
          LIMIT 1
          `,
          [assessmentId, body.assessment_response_id, body.candidate_id]
        );

        if (existingNomination.rows.length > 0) {
          finalNominationId = existingNomination.rows[0].nomination_id;
          isAlreadyPromoted = true;
          
          // Update existing nomination to ensure all fields are populated (handles legacy rows)
          await runtimePool.query(
            `
            UPDATE public.ofc_nominations
            SET assessment_response_id = COALESCE(assessment_response_id, $1::uuid),
                candidate_id = COALESCE(candidate_id, $2::uuid),
                evidence_excerpt = COALESCE(evidence_excerpt, $3::text)
            WHERE nomination_id = $4
            `,
            [body.assessment_response_id, body.candidate_id, evidenceExcerpt, finalNominationId]
          );
        } else {
          throw insertError;
        }
      } else {
        throw insertError;
      }
    }

    // 9. Update candidate in CORPUS: set approved=true, status='PROMOTED' (idempotent)
    await corpusPool.query(
      `
      UPDATE public.ofc_candidate_queue
      SET 
        approved = true,
        status = 'PROMOTED',
        reviewed_at = COALESCE(reviewed_at, now()),
        reviewed_by = COALESCE(reviewed_by, 'SYSTEM'),
        updated_at = now()
      WHERE candidate_id::text = $1
        AND (approved = false OR status != 'PROMOTED')
      RETURNING candidate_id
      `,
      [body.candidate_id]
    );

    // 10. Write audit log entry (including idempotent duplicates)
    try {
      await runtimePool.query(
        `
        INSERT INTO public.promote_audit_log (
          assessment_id,
          assessment_response_id,
          candidate_id,
          ofc_id,
          actor,
          already_promoted
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          assessmentId,
          body.assessment_response_id,
          body.candidate_id,
          ofcId,
          'SYSTEM', // Can be enhanced to extract from auth context
          isAlreadyPromoted
        ]
      );
    } catch (auditError: unknown) {
      console.warn("[PROMOTE] Audit log insert failed (non-critical):", auditError);
    }

    // Log promotion action (minimal audit trail)
    console.log(`[PROMOTE] Assessment: ${assessmentId}, Response: ${body.assessment_response_id}, Candidate: ${body.candidate_id}, OFC: ${ofcId}, Nomination: ${finalNominationId}, Already: ${isAlreadyPromoted}`);

    return NextResponse.json({
      ok: true,
      already: isAlreadyPromoted,
      ofc_id: ofcId,
      nomination_id: finalNominationId,
      candidate_id: body.candidate_id,
      assessment_id: assessmentId,
      assessment_response_id: body.assessment_response_id,
      question_canon_id: questionCanonId
    }, { status: 200 });

  } catch (error: unknown) {
    console.error("[API /api/runtime/assessments/[assessmentId]/ofcs/promote POST] Error:", error);
    const err = error && typeof error === "object" ? error as { code?: string; detail?: unknown; message?: string } : {};
    if (err.code === "23514") {
      return NextResponse.json(
        {
          error: "Constraint violation: candidate approval status inconsistency",
          error_code: "CONSTRAINT_VIOLATION",
          details: err.detail ?? err.message,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to promote OFC",
        message: error instanceof Error ? error.message : "Unknown error",
        error_code: "PROMOTION_FAILED",
      },
      { status: 500 }
    );
  }
}
