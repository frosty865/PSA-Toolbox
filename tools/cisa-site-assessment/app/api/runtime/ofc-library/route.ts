import { NextRequest, NextResponse } from 'next/server';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';
import { OFCScope, OFCLinkType } from '@/app/lib/ofc_library/eligibility';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Allowed status values for OFC library (matches database CHECK constraint)
 */
const ALLOWED_STATUSES = new Set(['ACTIVE', 'RETIRED']);

type DbErrorLike = { code?: string; message?: string; table?: string; detail?: unknown };

function mapDbErrorToHttp(err: unknown): { status: number; code: string; message: string; details?: unknown } {
  const e = err && typeof err === "object" ? (err as DbErrorLike) : {};
  const code = e.code;
  const message = e.message ?? "Database error";

  if (code === "42P01") {
    return {
      status: 500,
      code: "MISSING_TABLE",
      message: "OFC library table or view not initialized",
      details: { table: e.table ?? "v_eligible_ofc_library or ofc_library" },
    };
  }
  if (code === "42P07") {
    return { status: 500, code: "DB_SCHEMA_ERROR", message: "Database schema conflict", details: { detail: e.detail } };
  }
  if (code === "42501") {
    return { status: 500, code: "DB_PERMISSION", message: "Database permission denied", details: { detail: e.detail } };
  }
  if (code === "22P02") {
    return { status: 422, code: "VALIDATION_ERROR", message: "Invalid parameter type or value", details: { detail: e.detail } };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Database error", details: { code, message } };
}

/**
 * GET /api/runtime/ofc-library
 * 
 * Returns eligible OFCs from the runtime OFC library with filters.
 * 
 * Query params:
 * - link_type: 'PRIMARY_QUESTION' | 'EXPANSION_QUESTION' (optional)
 * - link_key: string (question key or question_id) (optional)
 * - scope: 'BASELINE' | 'SECTOR' | 'SUBSECTOR' (optional)
 * - sector: string (optional)
 * - subsector: string (optional)
 * - status: 'ACTIVE' | 'RETIRED' (default: 'ACTIVE')
 * - discipline_subtype_id: UUID (optional) — when provided, only OFCs with this subtype are returned; assessment must pass this for subtype gating (zero OFCs if mismatch or missing)
 * 
 * Returns OFCs ordered by scope precedence (SUBSECTOR > SECTOR > BASELINE).
 * 
 * Note: This route queries ONLY the runtime OFC library (ofc_library table).
 * Module OFCs are NOT included. The view v_eligible_ofc_library filters to ACTIVE
 * status with >= 1 citation. For RETIRED status, queries the base table directly.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const linkType = searchParams.get('link_type') as OFCLinkType | null;
    const linkKey = searchParams.get('link_key');
    const scope = searchParams.get('scope') as OFCScope | null;
    const sector = searchParams.get('sector');
    const subsector = searchParams.get('subsector');
    const statusParam = searchParams.get('status');
    const disciplineSubtypeId = searchParams.get('discipline_subtype_id');
    
    // Validate and normalize status (default to ACTIVE)
    const status = statusParam ? statusParam.toUpperCase() : 'ACTIVE';
    
    console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} status=${status}, linkType=${linkType}, linkKey=${linkKey}`);
    
    // Validate status allowlist
    if (!ALLOWED_STATUSES.has(status)) {
      console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} invalid status: ${status}`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status. Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}`,
          details: { provided: statusParam, allowed: Array.from(ALLOWED_STATUSES) }
        }
      }, { status: 422 });
    }
    
    // Validate link_type if provided
    if (linkType && !['PRIMARY_QUESTION', 'EXPANSION_QUESTION'].includes(linkType)) {
      console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} invalid linkType: ${linkType}`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'link_type must be PRIMARY_QUESTION or EXPANSION_QUESTION',
          details: { provided: linkType }
        }
      }, { status: 422 });
    }
    
    const pool = await ensureRuntimePoolConnected();
    
    // Check if base table exists first
    let tableExists = false;
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ofc_library'
        ) as table_exists
      `);
      tableExists = tableCheck.rows[0]?.table_exists === true;
    } catch (checkError) {
      console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} error checking table existence:`, checkError);
    }
    
    if (!tableExists) {
      console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} table ofc_library does not exist`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'RUNTIME_SCHEMA_MISSING',
          message: 'OFC library table not initialized. The ofc_library table does not exist in the RUNTIME database.',
          details: { table: 'public.ofc_library', action: 'Run database migrations to create ofc_library table' }
        }
      }, { status: 500 });
    }
    
    // Check if ofc_library_citations exists (required for view and FK integrity)
    let citationsTableExists = false;
    try {
      const citationsCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ofc_library_citations'
        ) as table_exists
      `);
      citationsTableExists = citationsCheck.rows[0]?.table_exists === true;
    } catch (checkError) {
      console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} error checking citations table existence:`, checkError);
    }
    
    if (!citationsTableExists) {
      console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} table ofc_library_citations does not exist`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'RUNTIME_SCHEMA_MISSING',
          message: 'OFC library citations table not initialized. The ofc_library_citations table does not exist in the RUNTIME database.',
          details: { 
            table: 'public.ofc_library_citations', 
            action: 'Run database migrations to create ofc_library_citations table. This table must be in RUNTIME (not CORPUS) due to FK constraint to ofc_library.' 
          }
        }
      }, { status: 500 });
    }
    
    // Check if canonical_sources exists (required for FK integrity)
    let canonicalSourcesExists = false;
    try {
      const canonicalSourcesCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'canonical_sources'
        ) as table_exists
      `);
      canonicalSourcesExists = canonicalSourcesCheck.rows[0]?.table_exists === true;
    } catch (checkError) {
      console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} error checking canonical_sources table existence:`, checkError);
    }
    
    if (!canonicalSourcesExists) {
      console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} table canonical_sources does not exist`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'RUNTIME_SCHEMA_MISSING',
          message: 'Canonical sources table not initialized. The canonical_sources table does not exist in the RUNTIME database.',
          details: { 
            table: 'public.canonical_sources', 
            action: 'Run database migrations to create canonical_sources table. This table must be in RUNTIME (not CORPUS) due to FK constraint from ofc_library_citations.' 
          }
        }
      }, { status: 500 });
    }
    
    // When filtering by discipline_subtype_id we must use base table (view may not have column)
    let useView = false;
    if (status === 'ACTIVE' && !disciplineSubtypeId) {
      try {
        const viewCheck = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'v_eligible_ofc_library'
          ) as view_exists
        `);
        useView = viewCheck.rows[0]?.view_exists === true;
        if (!useView) {
          console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} view v_eligible_ofc_library does not exist, using base table`);
        }
      } catch (checkError) {
        console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} error checking view existence, using base table:`, checkError);
        useView = false;
      }
    }
    
    // Build query - use view if available for ACTIVE, otherwise use base table
    let query: string;
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (useView) {
      // Use optimized view for ACTIVE status (no discipline_subtype_id filter)
      query = `
        SELECT 
          ofc_id,
          scope,
          sector,
          subsector,
          link_type,
          link_key,
          trigger_response,
          ofc_text,
          solution_role,
          status,
          citation_count,
          created_at,
          updated_at
        FROM public.v_eligible_ofc_library
        WHERE 1=1
      `;
    } else {
      // Query base table (required when discipline_subtype_id filter; also for RETIRED)
      query = `
        SELECT 
          ol.ofc_id,
          ol.scope,
          ol.sector,
          ol.subsector,
          ol.link_type,
          ol.link_key,
          ol.trigger_response,
          ol.ofc_text,
          ol.solution_role,
          ol.status,
          COUNT(olc.source_id)::text as citation_count,
          ol.created_at,
          ol.updated_at
        FROM public.ofc_library ol
        LEFT JOIN public.ofc_library_citations olc ON ol.ofc_id = olc.ofc_id
        WHERE ol.status = $${paramIndex}
        GROUP BY ol.ofc_id
        HAVING COUNT(olc.source_id) >= 1
      `;
      params.push(status);
      paramIndex++;
    }
    
    // Add filters
    if (linkType) {
      query += ` AND link_type = $${paramIndex}`;
      params.push(linkType);
      paramIndex++;
    }
    
    if (linkKey) {
      query += ` AND link_key = $${paramIndex}`;
      params.push(linkKey);
      paramIndex++;
    }
    
    // For view, status is already filtered; for base table, we already filtered above
    if (useView && status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (scope) {
      query += ` AND scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }
    
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
    
    // Subtype gating: only OFCs matching question subtype (zero OFCs if mismatch)
    if (disciplineSubtypeId) {
      query += ` AND ol.discipline_subtype_id = $${paramIndex}`;
      params.push(disciplineSubtypeId);
      paramIndex++;
    }
    
    // Order by scope precedence (SUBSECTOR > SECTOR > BASELINE)
    query += `
      ORDER BY 
        CASE scope
          WHEN 'SUBSECTOR' THEN 3
          WHEN 'SECTOR' THEN 2
          WHEN 'BASELINE' THEN 1
          ELSE 0
        END DESC,
        link_key,
        ofc_id
    `;
    
    const querySource = useView ? 'v_eligible_ofc_library (view)' : 'ofc_library (base table)';
    console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} executing query on ${querySource}`);
    const result = await pool.query(query, params);
    
    // Transform result rows to ensure count fields are strings (avoid INT32 serialization)
    const transformedRows = result.rows.map((row: Record<string, unknown>) => {
      if (row.citation_count !== undefined && typeof row.citation_count !== 'string') {
        row.citation_count = String(row.citation_count);
      }
      return row;
    });
    
    const duration = Date.now() - startTime;
    console.log(`[GET /api/runtime/ofc-library] requestId=${requestId} success: returned ${transformedRows.length} OFCs in ${duration}ms`);
    
    return NextResponse.json({
      ok: true,
      requestId,
      ofcs: transformedRows
    }, { status: 200 });
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const err = error && typeof error === "object" ? error as { name?: string; message?: string; code?: string; stack?: string } : {};
    console.error(`[GET /api/runtime/ofc-library] requestId=${requestId} error after ${duration}ms:`, {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
    });

    if (err.code) {
      const mapped = mapDbErrorToHttp(error);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: mapped.code,
          message: mapped.message,
          details: mapped.details
        }
      }, { status: mapped.status });
    }
    
    // Unexpected error
    return NextResponse.json({
      ok: false,
      requestId,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error'
      }
    }, { status: 500 });
  }
}


