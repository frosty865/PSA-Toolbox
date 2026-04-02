import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/runtime/admin/purge-test-assessments
 * 
 * Safe purge mechanism for test assessments.
 * 
 * Body:
 * - mode: "DRY_RUN" | "EXECUTE"
 * - test_run_id?: string (optional, purge only this run)
 * - older_than_days?: number (optional, purge tests older than N days)
 * - limit?: number (optional, max assessments per execution)
 * 
 * Safety: Only deletes assessments where (qa_flag=true OR test_run_id IS NOT NULL OR name LIKE '[QA]%')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, test_run_id, older_than_days, limit } = body;

    if (!mode || !['DRY_RUN', 'EXECUTE'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode must be "DRY_RUN" or "EXECUTE"' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Build WHERE clause for test assessments
    // Safety: MUST only match test assessments
    let whereClause = `
      (qa_flag = true OR test_run_id IS NOT NULL OR facility_name LIKE '[QA]%')
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Add optional filters
    if (test_run_id) {
      whereClause += ` AND test_run_id = $${paramIndex}`;
      params.push(test_run_id);
      paramIndex++;
    }

    if (older_than_days) {
      whereClause += ` AND created_at < NOW() - INTERVAL '${older_than_days} days'`;
    }

    // Get assessments to delete
    const assessmentsQuery = `
      SELECT id, facility_name, qa_flag, test_run_id, test_purpose, created_at
      FROM public.assessments
      WHERE ${whereClause}
      ORDER BY created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `;

    const assessmentsResult = await pool.query(assessmentsQuery, params);
    const assessmentIds = assessmentsResult.rows.map((r: Record<string, unknown>) => r.id as string);

    if (assessmentIds.length === 0) {
      return NextResponse.json({
        mode,
        message: 'No test assessments found matching criteria',
        counts: {
          assessments_to_delete: 0,
          responses_to_delete: 0,
          nominations_to_delete: 0,
          instances_to_delete: 0,
        }
      }, { status: 200 });
    }

    // Get counts of dependent rows
    const instanceIdsQuery = `
      SELECT id FROM public.assessment_instances
      WHERE facility_id = ANY($1::uuid[])
    `;
    const instanceIdsResult = await pool.query(instanceIdsQuery, [assessmentIds]);
    const instanceIds = instanceIdsResult.rows.map((r: Record<string, unknown>) => r.id as string);

    // Count responses
    // Cast to text to avoid INT32 serialization issues with large counts
    const responsesCountResult = await pool.query(`
      SELECT COUNT(*)::text as count
      FROM public.assessment_responses
      WHERE assessment_instance_id = ANY($1::uuid[])
    `, [instanceIds.length > 0 ? instanceIds : [null]]);

    // Count nominations
    const nominationsCountResult = await pool.query(`
      SELECT COUNT(*)::text as count
      FROM public.ofc_nominations
      WHERE assessment_id = ANY($1::uuid[])
    `, [assessmentIds]);

    const counts = {
      assessments_to_delete: assessmentIds.length,
      instances_to_delete: instanceIds.length,
      responses_to_delete: parseInt(String(responsesCountResult.rows[0]?.count || '0'), 10),
      nominations_to_delete: parseInt(String(nominationsCountResult.rows[0]?.count || '0'), 10),
    };

    // Build filters object for audit log
    const filters = {
      test_run_id: test_run_id || null,
      older_than_days: older_than_days || null,
      limit: limit || null,
    };

    // DRY_RUN: Return counts only
    if (mode === 'DRY_RUN') {
      // Log dry run to audit table
      await pool.query(`
        INSERT INTO public.test_assessment_purge_log (
          mode, filters_applied, counts, notes
        ) VALUES ($1, $2, $3, $4)
      `, [
        'DRY_RUN',
        JSON.stringify(filters),
        JSON.stringify(counts),
        `Dry run: ${assessmentIds.length} assessments would be deleted`
      ]);

      return NextResponse.json({
        mode: 'DRY_RUN',
        message: 'Dry run completed. No data was deleted.',
        filters_applied: filters,
        counts,
        assessment_ids: assessmentIds,
        assessment_details: assessmentsResult.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.facility_name,
          qa_flag: r.qa_flag,
          test_run_id: r.test_run_id,
          test_purpose: r.test_purpose,
          created_at: r.created_at,
        })),
      }, { status: 200 });
    }

    // EXECUTE: Perform deletion in transaction
    if (mode === 'EXECUTE') {
      // Safety check: Refuse if filter resolves to 0 rows
      if (assessmentIds.length === 0) {
        return NextResponse.json(
          { error: 'Cannot execute: No test assessments found matching criteria' },
          { status: 400 }
        );
      }

      // Double-check: Ensure we're only deleting test assessments
      // This is a hard guard against production data corruption
      // Cast to text to avoid INT32 serialization issues with large counts
      const safetyCheck = await pool.query(`
        SELECT COUNT(*)::text as count
        FROM public.assessments
        WHERE id = ANY($1::uuid[])
        AND NOT (qa_flag = true OR test_run_id IS NOT NULL OR facility_name LIKE '[QA]%')
      `, [assessmentIds]);

      const nonTestCount = parseInt(String(safetyCheck.rows[0]?.count || '0'), 10);
      if (nonTestCount > 0) {
        return NextResponse.json(
          { 
            error: 'Safety check failed: Attempted to delete non-test assessments',
            non_test_count: nonTestCount
          },
          { status: 500 }
        );
      }

      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Delete dependent rows first (cascade order)
        // 1. Delete responses
        if (instanceIds.length > 0) {
          await client.query(`
            DELETE FROM public.assessment_responses
            WHERE assessment_instance_id = ANY($1::uuid[])
          `, [instanceIds]);
        }

        // 2. Delete nominations
        await client.query(`
          DELETE FROM public.ofc_nominations
          WHERE assessment_id = ANY($1::uuid[])
        `, [assessmentIds]);

        // 3. Delete assessment instances
        if (instanceIds.length > 0) {
          await client.query(`
            DELETE FROM public.assessment_instances
            WHERE id = ANY($1::uuid[])
          `, [instanceIds]);
        }

        // 4. Delete assessments last
        await client.query(`
          DELETE FROM public.assessments
          WHERE id = ANY($1::uuid[])
        `, [assessmentIds]);

        // Commit transaction
        await client.query('COMMIT');

        // Log purge to audit table
        await pool.query(`
          INSERT INTO public.test_assessment_purge_log (
            mode, filters_applied, counts, assessment_ids_deleted, notes
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          'EXECUTE',
          JSON.stringify(filters),
          JSON.stringify(counts),
          assessmentIds,
          `Purged ${assessmentIds.length} test assessments`
        ]);

        return NextResponse.json({
          mode: 'EXECUTE',
          message: 'Purge completed successfully',
          filters_applied: filters,
          counts,
          assessment_ids_deleted: assessmentIds,
        }, { status: 200 });

      } catch (error: unknown) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return NextResponse.json(
      { error: 'Invalid mode' },
      { status: 400 }
    );

  } catch (error: unknown) {
    console.error('[API /api/runtime/admin/purge-test-assessments POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to purge test assessments',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


