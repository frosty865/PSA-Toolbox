import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ofc/canonical
 * List canonical OFCs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const disciplineId = searchParams.get('discipline_id');
    const disciplineSubtypeId = searchParams.get('discipline_subtype_id');
    const status = searchParams.get('status') || 'ACTIVE';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'DESC';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const pool = getRuntimePool();

    // Validate sort_by to prevent SQL injection
    const allowedSortColumns = [
      'canonical_code', 'title', 'ofc_text', 'discipline_id', 'discipline_subtype_id',
      'status', 'version_major', 'version_minor', 'created_at', 'created_by',
      'approved_at', 'approved_by', 'discipline_name', 'subtype_name'
    ];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = `
      SELECT 
        o.*,
        d.name as discipline_name,
        d.code as discipline_code,
        ds.name as subtype_name,
        ds.code as subtype_code,
        (SELECT count(*)::text FROM public.canonical_ofc_citations c WHERE c.canonical_ofc_id = o.canonical_ofc_id) AS citation_count
      FROM public.canonical_ofcs o
      LEFT JOIN disciplines d ON o.discipline_id = d.id
      LEFT JOIN discipline_subtypes ds ON o.discipline_subtype_id = ds.id
      WHERE o.status = $1
    `;

    const params: unknown[] = [status];
    let paramIndex = 2;

    if (disciplineId) {
      query += ` AND o.discipline_id = $${paramIndex}`;
      params.push(disciplineId);
      paramIndex++;
    }

    if (disciplineSubtypeId) {
      query += ` AND o.discipline_subtype_id = $${paramIndex}`;
      params.push(disciplineSubtypeId);
      paramIndex++;
    }

    // Handle sort columns that need table aliases
    let sortColumn: string;
    if (validSortBy === 'discipline_name') {
      sortColumn = 'd.name';
    } else if (validSortBy === 'subtype_name') {
      sortColumn = 'ds.name';
    } else {
      sortColumn = `o.${validSortBy}`;
    }

    query += ` ORDER BY ${sortColumn} ${validSortOrder}`;

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
      if (row.citation_count !== undefined) {
        row.citation_count = String(row.citation_count);
      }
      return row;
    });

    // Get total count for pagination
    // Cast to text to avoid INT32 serialization issues with large counts
    let countQuery = `
      SELECT count(*)::text as total
      FROM public.canonical_ofcs o
      WHERE o.status = $1
    `;
    const countParams: unknown[] = [status];
    let countParamIndex = 2;

    if (disciplineId) {
      countQuery += ` AND o.discipline_id = $${countParamIndex}`;
      countParams.push(disciplineId);
      countParamIndex++;
    }

    if (disciplineSubtypeId) {
      countQuery += ` AND o.discipline_subtype_id = $${countParamIndex}`;
      countParams.push(disciplineSubtypeId);
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
      canonical_ofcs: transformedRows,
      total,
      limit: limit || null,
      offset
    });

  } catch (error: unknown) {
    console.error('[API /api/ofc/canonical GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch canonical OFCs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


