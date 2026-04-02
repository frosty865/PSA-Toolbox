/**
 * POST /api/admin/problem-candidates/[id]/promote
 * Promote a PENDING problem_candidate to a canonical OFC (ofc_library).
 * Only status=PENDING allowed. Admin authors capability_statement (ofc_text).
 * Inserts into ofc_library with scope=BASELINE, discipline_subtype_id from candidate, module_code=NULL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { assertOfcWriteAllowed } from '@/app/lib/ofc_write_guard';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const capability_statement =
      typeof body.capability_statement === 'string' ? body.capability_statement.trim() : '';

    if (!capability_statement) {
      return NextResponse.json(
        { error: 'capability_statement is required (admin-authored OFC text)' },
        { status: 400 }
      );
    }

    assertOfcWriteAllowed({ source: 'ADMIN_AUTHORING' });

    const pool = getRuntimePool();

    const candidateRow = await pool.query(
      `SELECT id, discipline_subtype_id, problem_statement, evidence, status
       FROM public.problem_candidates WHERE id::text = $1`,
      [id]
    );

    if (candidateRow.rows.length === 0) {
      return NextResponse.json(
        { error: 'Problem candidate not found', error_code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const candidate = candidateRow.rows[0];
    if (candidate.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: 'Only PENDING candidates can be promoted',
          error_code: 'INVALID_STATUS',
          status: candidate.status,
        },
        { status: 400 }
      );
    }

    const disciplineSubtypeId = candidate.discipline_subtype_id;
    const linkKey = `problem_candidate:${id}`;

    // Minimal PSA-scope guard (reject clearly cyber-technical content)
    const forbidden = ['phishing', 'malware', 'ransomware', 'SIEM', 'EDR', 'IDS/IPS', 'firewall', 'encryption', 'patching'];
    const statementLower = (capability_statement || '').toLowerCase();
    for (const w of forbidden) {
      if (statementLower.includes(w.toLowerCase())) {
        return NextResponse.json(
          { error: 'capability_statement out of PSA scope' },
          { status: 400 }
        );
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO public.ofc_library (
        scope,
        sector,
        subsector,
        link_type,
        link_key,
        trigger_response,
        ofc_text,
        solution_role,
        status,
        discipline_subtype_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ofc_id`,
      [
        'BASELINE',
        null,
        null,
        'PRIMARY_QUESTION',
        linkKey,
        'NO',
        capability_statement,
        'COMPLETE',
        'ACTIVE',
        disciplineSubtypeId,
      ]
    );

    const ofcId = insertResult.rows[0]?.ofc_id;
    if (!ofcId) {
      return NextResponse.json(
        { error: 'Insert did not return ofc_id' },
        { status: 500 }
      );
    }

    await pool.query(
      `UPDATE public.problem_candidates SET status = 'ACCEPTED', updated_at = now() WHERE id::text = $1`,
      [id]
    );

    return NextResponse.json({
      success: true,
      ofc_id: ofcId,
      problem_candidate_id: id,
      discipline_subtype_id: disciplineSubtypeId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('[GUARD] OFC creation blocked')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('discipline_subtype_id') || /column.*does not exist/i.test(message)) {
      return NextResponse.json(
        {
          error: 'ofc_library.discipline_subtype_id may not exist. Run migration 20260130_ofc_library_discipline_subtype_id.sql.',
        },
        { status: 500 }
      );
    }
    console.error('[POST /api/admin/problem-candidates/[id]/promote]', err);
    return NextResponse.json(
      { error: message || 'Promote failed' },
      { status: 500 }
    );
  }
}
