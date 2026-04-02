import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vulnerabilities
 * List normalized vulnerabilities with optional filters and sorting
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const discipline = searchParams.get('discipline');
    const disciplineSubtype = searchParams.get('discipline_subtype');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'DESC';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const pool = getRuntimePool();

    // Check if table exists (graceful handling)
    let tableExists = true;
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'normalized_vulnerabilities'
        )
      `);
      tableExists = tableCheck.rows[0].exists;
    } catch {
      tableExists = false;
    }

    if (!tableExists) {
      return NextResponse.json({
        success: true,
        vulnerabilities: [],
        total: 0,
        limit: limit || null,
        offset,
        message: 'Table normalized_vulnerabilities does not exist. Please run migration 20251218_add_normalized_libraries.sql'
      });
    }

    // Validate sort_by to prevent SQL injection
    const allowedSortColumns = [
      'id', 'discipline', 'discipline_subtype', 'canonical_title', 
      'canonical_description', 'status', 'created_at', 'updated_at'
    ];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = `
      SELECT 
        v.*,
        (SELECT count(*)::text FROM public.normalized_evidence_links nel WHERE nel.vulnerability_id = v.id) AS evidence_count
      FROM public.normalized_vulnerabilities v
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (discipline) {
      query += ` AND v.discipline = $${paramIndex}`;
      params.push(discipline);
      paramIndex++;
    }

    if (disciplineSubtype) {
      query += ` AND v.discipline_subtype = $${paramIndex}`;
      params.push(disciplineSubtype);
      paramIndex++;
    }

    if (status) {
      query += ` AND v.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY v.${validSortBy} ${validSortOrder}`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
      if (offset > 0) {
        query += ` OFFSET $${paramIndex}`;
        params.push(offset);
      }
    }

    const result = await pool.query(query, params);
    
    // Transform result rows to ensure count fields are strings (avoid INT32 serialization)
    const transformedRows = result.rows.map((row: Record<string, unknown>) => {
      if (row.evidence_count !== undefined) {
        row.evidence_count = String(row.evidence_count);
      }
      return row;
    });

    // Get total count for pagination
    // Cast to text to avoid INT32 serialization issues with large counts
    let countQuery = `
      SELECT count(*)::text as total
      FROM public.normalized_vulnerabilities v
      WHERE 1=1
    `;
    const countParams: unknown[] = [];
    let countParamIndex = 1;

    if (discipline) {
      countQuery += ` AND v.discipline = $${countParamIndex}`;
      countParams.push(discipline);
      countParamIndex++;
    }

    if (disciplineSubtype) {
      countQuery += ` AND v.discipline_subtype = $${countParamIndex}`;
      countParams.push(disciplineSubtype);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND v.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    // Handle BIGINT count values - cast to string first to avoid INT32 overflow
    const totalValue = countResult.rows[0].total;
    const total = typeof totalValue === 'string' 
      ? parseInt(totalValue, 10) 
      : typeof totalValue === 'bigint' 
        ? Number(totalValue)
        : Number(totalValue);

    return NextResponse.json({
      success: true,
      vulnerabilities: transformedRows,
      total,
      limit: limit || null,
      offset
    });

  } catch (error: unknown) {
    console.error('[API /api/vulnerabilities GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch vulnerabilities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


