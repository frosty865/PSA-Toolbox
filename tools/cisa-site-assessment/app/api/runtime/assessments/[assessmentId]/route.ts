import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { assertTableOnOwnerPool } from '@/app/lib/db/pool_guard';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// Force module evaluation
if (typeof window === 'undefined') {
  console.log('[ROUTE MODULE LOADED] /api/runtime/assessments/[assessmentId]/route.ts');
}

/**
 * GET /api/runtime/assessments/[assessmentId]
 * 
 * Returns detailed information about a specific assessment.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  console.log('[API /api/runtime/assessments/[assessmentId] GET] Route hit');
  try {
    // Hard guard: Assert RUNTIME-owned tables are on correct pool
    await assertTableOnOwnerPool("public.assessments");
    
    const { assessmentId } = await params;
    console.log('[API /api/runtime/assessments/[assessmentId] GET] assessmentId:', assessmentId);

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Check which columns exist in the assessments table
    let availableColumns = new Set<string>();
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessments'
      `);
      availableColumns = new Set(columnCheck.rows.map((r: Record<string, unknown>) => r.column_name as string));
    } catch (err) {
      console.error('[API] Error checking columns:', err);
    }

    // Build SELECT clause with only existing columns
    const selectFields: string[] = ['a.id as assessment_id'];
    
    if (availableColumns.has('facility_name')) selectFields.push('a.facility_name as name');
    if (availableColumns.has('sector_id')) selectFields.push('a.sector_id');
    if (availableColumns.has('sector_name')) selectFields.push('a.sector_name');
    if (availableColumns.has('subsector_id')) selectFields.push('a.subsector_id');
    if (availableColumns.has('subsector_name')) selectFields.push('a.subsector_name');
    if (availableColumns.has('status')) selectFields.push('a.status');
    if (availableColumns.has('created_at')) selectFields.push('a.created_at');
    if (availableColumns.has('updated_at')) selectFields.push('a.updated_at');
    if (availableColumns.has('qa_flag')) selectFields.push('a.qa_flag');
    if (availableColumns.has('test_run_id')) selectFields.push('a.test_run_id');

    // Also try to get sector_code/subsector_code from assessment_definitions
    // Cast both sides to text to handle UUID and TEXT id types robustly
    const query = `
      SELECT 
        ${selectFields.join(', ')},
        ad.sector_code,
        ad.subsector_code
      FROM public.assessments a
      LEFT JOIN public.assessment_definitions ad ON a.id::text = ad.assessment_id::text
      WHERE a.id::text = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [assessmentId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0], { status: 200 });

  } catch (error) {
    const err = error && typeof error === "object" ? error as { code?: string; detail?: unknown; constraint?: string; table?: string; column?: string } : {};
    const errorDetails = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column,
    };
    console.error('[API /api/runtime/assessments/[assessmentId] GET] Error:', errorDetails);
    return NextResponse.json(
      {
        error: 'Failed to fetch assessment',
        message: errorDetails.message,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
