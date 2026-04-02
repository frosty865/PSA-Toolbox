import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { isValidProfileStatus } from '@/app/lib/expansion/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/expansion-profiles
 * 
 * Returns expansion profiles filtered by status (default: ACTIVE), sector, subsector.
 * 
 * Query params:
 * - status: 'DRAFT' | 'ACTIVE' | 'RETIRED' (default: 'ACTIVE')
 * - sector: optional filter
 * - subsector: optional filter
 * 
 * No auto-apply behavior.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const sector = searchParams.get('sector');
    const subsector = searchParams.get('subsector');

    if (!isValidProfileStatus(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: DRAFT, ACTIVE, RETIRED` },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    let query = `
      SELECT 
        profile_id,
        sector,
        subsector,
        version,
        effective_date,
        status,
        description,
        created_at,
        updated_at
      FROM public.sector_expansion_profiles
      WHERE status = $1
    `;
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (sector) {
      query += ` AND sector = $${paramIndex}`;
      params.push(sector);
      paramIndex++;
    }

    if (subsector) {
      query += ` AND subsector = $${paramIndex}`;
      params.push(subsector);
      paramIndex++;
    }

    query += ` ORDER BY sector, subsector, version DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/runtime/expansion-profiles GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch expansion profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


