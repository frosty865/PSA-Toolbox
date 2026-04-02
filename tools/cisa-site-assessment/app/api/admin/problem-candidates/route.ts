/**
 * GET /api/admin/problem-candidates
 * List problem candidates with optional status filter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status'); // PENDING | REJECTED | ACCEPTED
    const disciplineSubtypeId = url.searchParams.get('discipline_subtype_id'); // UUID filter

    const pool = getRuntimePool();

    let query = `
      SELECT 
        pc.id,
        pc.discipline_subtype_id,
        pc.problem_statement,
        pc.evidence,
        pc.status,
        pc.created_at,
        pc.updated_at,
        ds.code AS discipline_subtype_code,
        ds.name AS discipline_subtype_name
      FROM public.problem_candidates pc
      LEFT JOIN public.discipline_subtypes ds ON ds.id = pc.discipline_subtype_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;
    if (statusFilter && ['PENDING', 'REJECTED', 'ACCEPTED'].includes(statusFilter)) {
      query += ` AND pc.status = $${paramIndex}`;
      params.push(statusFilter);
      paramIndex++;
    }
    if (disciplineSubtypeId && disciplineSubtypeId.trim()) {
      query += ` AND pc.discipline_subtype_id = $${paramIndex}::uuid`;
      params.push(disciplineSubtypeId.trim());
      paramIndex++;
    }
    query += ` ORDER BY pc.created_at DESC LIMIT 500`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      ok: true,
      candidates: result.rows,
    });
  } catch (err: unknown) {
    console.error('[GET /api/admin/problem-candidates]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'List failed' },
      { status: 500 }
    );
  }
}

