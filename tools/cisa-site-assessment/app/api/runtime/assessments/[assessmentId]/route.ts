import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { assertTableOnOwnerPool } from '@/app/lib/db/pool_guard';
import { deleteAssessmentsCascade } from '@/app/lib/db/delete_assessment_cascade';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * True if this assessment is allowed to be deleted via the assessments UI
 * (aligned with purge-test-assessments safety, plus [TEST]% from POST /api/runtime/test-assessments).
 */
function isDeletableTestAssessment(row: {
  qa_flag?: boolean | null;
  test_run_id?: string | null;
  facility_name?: string | null;
}): boolean {
  if (row.qa_flag === true) return true;
  if (row.test_run_id != null && String(row.test_run_id).trim() !== "") return true;
  const name = row.facility_name ?? "";
  if (name.startsWith("[QA]")) return true;
  if (name.toUpperCase().startsWith("[TEST]")) return true;
  return false;
}

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

async function deleteAssessment(
  _request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    await assertTableOnOwnerPool("public.assessments");

    const { assessmentId } = await params;
    if (!assessmentId?.trim()) {
      return NextResponse.json({ error: "assessmentId parameter is required" }, { status: 400 });
    }

    const pool = getRuntimePool();
    const client = await pool.connect();

    try {
      const meta = await client.query(
        `
        SELECT id, facility_name, qa_flag, test_run_id
        FROM public.assessments
        WHERE id::text = $1
        LIMIT 1
        `,
        [assessmentId]
      );

      if (meta.rows.length === 0) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      const row = meta.rows[0] as {
        id: string;
        facility_name: string | null;
        qa_flag: boolean | null;
        test_run_id: string | null;
      };

      if (!isDeletableTestAssessment(row)) {
        return NextResponse.json(
          {
            error: "Only test assessments can be deleted",
            message:
              "This assessment is not marked as a test (qa_flag / test_run_id / [QA] or [TEST] name). Delete is disabled for non-test assessments.",
          },
          { status: 403 }
        );
      }

      await deleteAssessmentsCascade(client, [assessmentId]);

      return NextResponse.json({ ok: true, deleted_assessment_id: row.id }, { status: 200 });
    } catch (inner: unknown) {
      throw inner;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    console.error("[API /api/runtime/assessments/[assessmentId] DELETE] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete assessment",
        message: msg,
        code: code || undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/runtime/assessments/[assessmentId]
 *
 * Deletes a **test** assessment and dependent runtime rows. Production-style assessments are refused.
 * Test detection: qa_flag, test_run_id, or facility_name prefix [QA] / [TEST] (case-insensitive for TEST).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string }> }
) {
  return deleteAssessment(request, context);
}

/**
 * POST /api/runtime/assessments/[assessmentId]
 *
 * Alias for DELETE to tolerate environments or proxies that reject DELETE.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string }> }
) {
  return deleteAssessment(request, context);
}
