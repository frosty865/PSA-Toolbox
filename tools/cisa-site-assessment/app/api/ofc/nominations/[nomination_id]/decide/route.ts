import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { generateCanonicalCode, getSecurityMode, canPerformDecision, logAuditEvent } from '@/app/lib/ofc-utils';
import { guardOFCRequiresCitations } from '@/app/lib/citation/guards';
import { assertSourceKeysExistInCorpus } from '@/app/lib/citation/validateSourceKeys';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ofc/nominations/{nomination_id}/decide
 * Make a decision on a nomination (APPROVE_TO_CANONICAL, REJECT, REQUEST_CHANGES)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nomination_id: string }> }
) {
  try {
    const { nomination_id } = await params;
    const nominationId = nomination_id;
    const body = await request.json();

    const {
      decision,
      decision_notes,
      decided_by,
      decided_role
    } = body;

    if (!decision || !decision_notes || !decided_by || !decided_role) {
      return NextResponse.json(
        { error: 'Missing required fields: decision, decision_notes, decided_by, decided_role' },
        { status: 400 }
      );
    }

    if (!['APPROVE_TO_CANONICAL', 'REJECT', 'REQUEST_CHANGES'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be APPROVE_TO_CANONICAL, REJECT, or REQUEST_CHANGES' },
        { status: 400 }
      );
    }

    // Guardrail: Require reason for rejection
    if (decision === 'REJECT' && (!decision_notes || !decision_notes.trim())) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    if (!['ENGINEER', 'GOVERNANCE'].includes(decided_role)) {
      return NextResponse.json(
        { error: 'Invalid decided_role. Must be ENGINEER or GOVERNANCE' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Get security mode
    const securityMode = await getSecurityMode(pool);

    // Check if role can perform decision
    if (!canPerformDecision(securityMode, decided_role as 'ENGINEER' | 'GOVERNANCE')) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          message: `Security mode ${securityMode} does not allow ${decided_role} to make decisions`
        },
        { status: 403 }
      );
    }

    // Get nomination
    const nomResult = await pool.query(
      `SELECT * FROM public.ofc_nominations WHERE nomination_id = $1`,
      [nominationId]
    );

    if (nomResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Nomination not found' },
        { status: 404 }
      );
    }

    const nomination = nomResult.rows[0];

    // Guardrail: Prevent approval if reference_unresolved
    if (decision === 'APPROVE_TO_CANONICAL' && nomination.reference_unresolved) {
      return NextResponse.json(
        { 
          error: 'Cannot approve: References are unresolved',
          message: 'All references must be resolved before approval. Please resolve references first.'
        },
        { status: 400 }
      );
    }

    if (nomination.locked) {
      return NextResponse.json(
        { error: 'Nomination is locked and cannot be modified' },
        { status: 409 }
      );
    }

    if (nomination.status === 'APPROVED' || nomination.status === 'REJECTED' || nomination.status === 'WITHDRAWN') {
      return NextResponse.json(
        { error: `Nomination is already ${nomination.status} and cannot be modified` },
        { status: 409 }
      );
    }

    let canonicalOfcId: string | null = null;

    // If approving, create canonical OFC
    if (decision === 'APPROVE_TO_CANONICAL') {
      // HARD BLOCK: Cannot approve if reference_unresolved == true
      if (nomination.reference_unresolved === true) {
        return NextResponse.json(
          { 
            error: 'Cannot approve: nomination has unresolved bibliographic reference',
            message: 'This OFC cannot be promoted until a valid reference is attached. The reference_unresolved flag must be false.'
          },
          { status: 400 }
        );
      }

      // HARD GUARD: Citations required for promotion
      // Note: For now, we check if citations are provided in body.
      // In future, citations should be required on all promotions.
      if (body.citations && Array.isArray(body.citations) && body.citations.length > 0) {
        // Validate citation structure
        const citationGuard = await guardOFCRequiresCitations(body.citations);
        if (!citationGuard.valid) {
          return NextResponse.json(
            { error: citationGuard.error },
            { status: 400 }
          );
        }

        // HARD BLOCK: Assert all source_keys exist in CORPUS before promotion
        const sourceKeys = body.citations.map((c: Record<string, unknown>) => c.source_key).filter(Boolean);
        if (sourceKeys.length > 0) {
          try {
            await assertSourceKeysExistInCorpus(sourceKeys as string[]);
          } catch (error: unknown) {
            const err = error && typeof error === "object" ? error as { message?: string; missing_keys?: unknown; status?: number } : {};
            return NextResponse.json(
              {
                error: err.message ?? "Source key validation failed",
                missing_keys: err.missing_keys,
              },
              { status: err.status ?? 400 }
            );
          }
        }
      }

      if (!nomination.discipline_id || !nomination.discipline_subtype_id) {
        return NextResponse.json(
          { error: 'Cannot approve: nomination missing discipline_id or discipline_subtype_id' },
          { status: 400 }
        );
      }

      // Get discipline and subtype codes
      const discResult = await pool.query(
        `SELECT code FROM disciplines WHERE id = $1`,
        [nomination.discipline_id]
      );
      const subtypeResult = await pool.query(
        `SELECT code FROM discipline_subtypes WHERE id = $1`,
        [nomination.discipline_subtype_id]
      );

      if (discResult.rows.length === 0 || subtypeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Discipline or subtype not found' },
          { status: 404 }
        );
      }

      const disciplineCode = discResult.rows[0].code;
      const subtypeCode = subtypeResult.rows[0].code;

      // Generate canonical code
      const canonicalCode = generateCanonicalCode(
        disciplineCode,
        subtypeCode,
        nomination.proposed_ofc_text
      );

      // Check if canonical code already exists
      const existingCheck = await pool.query(
        `SELECT canonical_ofc_id FROM public.canonical_ofcs WHERE canonical_code = $1`,
        [canonicalCode]
      );

      if (existingCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Canonical OFC with this code already exists', canonical_ofc_id: existingCheck.rows[0].canonical_ofc_id },
          { status: 409 }
        );
      }

      // Create canonical OFC
      const canonicalResult = await pool.query(
        `INSERT INTO public.canonical_ofcs (
          canonical_code, title, ofc_text,
          discipline_id, discipline_subtype_id,
          status, created_by, approved_by
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
        RETURNING canonical_ofc_id`,
        [
          canonicalCode,
          nomination.proposed_title,
          nomination.proposed_ofc_text,
          nomination.discipline_id,
          nomination.discipline_subtype_id,
          nomination.submitted_by,
          decided_by
        ]
      );

      canonicalOfcId = canonicalResult.rows[0].canonical_ofc_id;

      // Create citation from nomination evidence
      await pool.query(
        `INSERT INTO public.canonical_ofc_citations (
          canonical_ofc_id, document_id, page, excerpt, source_label, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          canonicalOfcId,
          nomination.document_id,
          nomination.evidence_page || nomination.page,
          nomination.evidence_excerpt,
          null,
          decided_by
        ]
      );

      // Update nomination status to APPROVED and lock it
      await pool.query(
        `UPDATE public.ofc_nominations
         SET status = 'APPROVED', locked = true
         WHERE nomination_id = $1`,
        [nominationId]
      );
    } else if (decision === 'REJECT') {
      // Update nomination status to REJECTED and lock it
      await pool.query(
        `UPDATE public.ofc_nominations
         SET status = 'REJECTED', status_reason = $1, locked = true
         WHERE nomination_id = $2`,
        [decision_notes, nominationId]
      );
    } else if (decision === 'REQUEST_CHANGES') {
      // Update nomination status back to SUBMITTED (unlock for resubmission)
      await pool.query(
        `UPDATE public.ofc_nominations
         SET status = 'SUBMITTED', status_reason = $1
         WHERE nomination_id = $2`,
        [decision_notes, nominationId]
      );
    }

    // Create decision record (immutable)
    const decisionResult = await pool.query(
      `INSERT INTO public.ofc_nomination_decisions (
        nomination_id, decision, decision_notes,
        decided_by, decided_role, canonical_ofc_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING decision_id`,
      [
        nominationId,
        decision,
        decision_notes,
        decided_by,
        decided_role,
        canonicalOfcId
      ]
    );

    // Log audit event
    await logAuditEvent(
      pool,
      'OFC_NOMINATION_DECIDED',
      {
        nomination_id: nominationId,
        decision,
        decided_by,
        decided_role,
        canonical_ofc_id: canonicalOfcId,
        security_mode: securityMode
      },
      decided_by
    );

    return NextResponse.json({
      success: true,
      decision_id: decisionResult.rows[0].decision_id,
      canonical_ofc_id: canonicalOfcId,
      nomination_status: decision === 'APPROVE_TO_CANONICAL' ? 'APPROVED' : 
                         decision === 'REJECT' ? 'REJECTED' : 'SUBMITTED'
    });

  } catch (error) {
    console.error('[API /api/ofc/nominations/[nomination_id]/decide] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to make decision',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

