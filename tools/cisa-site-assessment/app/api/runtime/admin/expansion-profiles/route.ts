import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getAdminAuditContext, writeAdminAuditLog } from '@/app/lib/admin/audit';
import { parseExpansionProfileUpsert } from '@/app/lib/admin/expansionProfiles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/runtime/admin/expansion-profiles
 * 
 * Admin-only endpoint to create or update expansion profiles (upsert by profile_id).
 * 
 * Body:
 * - profile_id: string (required)
 * - sector: string (required)
 * - subsector: string (required)
 * - version: integer > 0 (required)
 * - effective_date: date string (required)
 * - status: 'DRAFT' | 'ACTIVE' | 'RETIRED' (required)
 * - description: string (optional)
 * 
 * Note: Admin authentication should be implemented separately.
 */
export async function POST(request: NextRequest) {
  try {
    const audit = getAdminAuditContext(request);
    const {
      profile_id,
      sector,
      subsector,
      version,
      effective_date,
      status,
      description
    } = parseExpansionProfileUpsert(await request.json());

    const pool = getRuntimePool();

    // Upsert profile
    const result = await pool.query(`
      INSERT INTO public.sector_expansion_profiles (
        profile_id,
        sector,
        subsector,
        version,
        effective_date,
        status,
        description,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (profile_id) 
      DO UPDATE SET
        sector = EXCLUDED.sector,
        subsector = EXCLUDED.subsector,
        version = EXCLUDED.version,
        effective_date = EXCLUDED.effective_date,
        status = EXCLUDED.status,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING *
    `, [profile_id, sector, subsector, version, effective_date, status, description || null]);
    writeAdminAuditLog('expansion_profile_upserted', audit, {
      profile_id,
      sector,
      subsector,
      version,
      status,
    });

    return NextResponse.json({
      success: true,
      profile: result.rows[0]
    }, { status: 200 });

  } catch (error: unknown) {
    const audit = getAdminAuditContext(request);
    if (error instanceof Error && error.name === 'ZodError') {
      writeAdminAuditLog('expansion_profile_validation_error', audit, {
        error: error.message,
      });
      return NextResponse.json(
        {
          error: 'Invalid expansion profile payload',
          message: error.message,
        },
        { status: 400 }
      );
    }
    writeAdminAuditLog('expansion_profile_upsert_error', audit, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('[API /api/runtime/admin/expansion-profiles POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create/update expansion profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


