import { NextRequest, NextResponse } from 'next/server';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';
import { assertTableOnOwnerPool } from '@/app/lib/db/pool_guard';
import { createAssessmentBodySchema } from '@/app/lib/runtime/assessmentRequestSchema';
import path from 'path';
import { spawn } from 'child_process';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/** pg Pool or PoolClient - both have .query() */
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: { id?: string }[] }> };

/** Row from information_schema.columns */
type ColumnNameRow = { column_name: string };
type DataTypeRow = { data_type: string };
type IsNullableRow = { is_nullable: string; column_default: string | null };
/**
 * Ensure template exists in assessment_templates. If missing and templatePayload
 * is provided, insert it. If missing and no payload, return 400 (not 500).
 */
async function ensureTemplateExists(
  q: Queryable,
  templateId: string,
  templatePayload?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  let rows: { id?: string }[];
  try {
    const r = await q.query(
      'SELECT id FROM public.assessment_templates WHERE id = $1',
      [templateId]
    );
    rows = r.rows;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code ?? '';
    if (code === '42P01' || /does not exist|relation .* does not exist/i.test(msg)) {
      return { ok: false, status: 500, error: `assessment_templates table is missing: ${msg}` };
    }
    return { ok: false, status: 500, error: `Failed to check template: ${msg}` };
  }
  if (rows.length > 0) return { ok: true };

  if (!templatePayload) {
    return {
      ok: false,
      status: 400,
      error:
        `Invalid reference: template_id (${templateId}) does not exist in assessment_templates. ` +
        `Create/select a template first, or send a template payload to create it.`,
    };
  }

  const name = typeof templatePayload.name === 'string' ? templatePayload.name : 'Unspecified Template';
  const description = templatePayload.description !== undefined ? templatePayload.description : null;

  try {
    await q.query(
      `INSERT INTO public.assessment_templates (id, name, description) VALUES ($1, $2, $3)`,
      [templateId, name, description]
    );
  } catch (err: unknown) {
    return { ok: false, status: 500, error: `Failed creating template: ${err instanceof Error ? err.message : String(err)}` };
  }
  return { ok: true };
}

/**
 * GET /api/runtime/assessments
 * 
 * Returns list of assessments, excluding QA assessments by default.
 * 
 * Query params:
 * - include_qa: if 'true', includes QA assessments (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    // Hard guard: Assert RUNTIME-owned tables are on correct pool
    await assertTableOnOwnerPool("public.assessments");
    
    const { searchParams } = new URL(request.url);
    const includeQa = searchParams.get('include_qa') === 'true';

    let pool;
    try {
      pool = await ensureRuntimePoolConnected();
    } catch (poolError) {
      console.error('[API /api/runtime/assessments GET] Failed to get database pool:', poolError);
      return NextResponse.json(
        {
          error: 'Database connection failed',
          message: poolError instanceof Error ? poolError.message : 'Unknown error',
          hint: 'Check RUNTIME_DATABASE_URL and verify the runtime database is reachable.'
        },
        { status: 500 }
      );
    }

    // Check which columns exist in the assessments table
    let availableColumns = new Set<string>();
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessments'
      `);
      availableColumns = new Set((columnCheck.rows as ColumnNameRow[]).map((r) => r.column_name));
    } catch (err: unknown) {
      console.error('[API] Error checking columns:', err);
      // If check fails, we'll use a minimal query
    }

    // Build SELECT clause with only existing columns
    const selectFields: string[] = [
      'id as assessment_id',
      'facility_name as name',
    ];

    if (availableColumns.has('sector_id')) selectFields.push('sector_id');
    if (availableColumns.has('sector_name')) selectFields.push('sector_name');
    if (availableColumns.has('subsector_id')) selectFields.push('subsector_id');
    if (availableColumns.has('subsector_name')) selectFields.push('subsector_name');
    if (availableColumns.has('status')) selectFields.push('status');
    if (availableColumns.has('created_at')) selectFields.push('created_at');
    if (availableColumns.has('updated_at')) selectFields.push('updated_at');
    if (availableColumns.has('qa_flag')) selectFields.push('qa_flag');
    if (availableColumns.has('created_by')) selectFields.push('created_by');
    if (availableColumns.has('submitted_by')) selectFields.push('submitted_by');
    if (availableColumns.has('submitted_at')) selectFields.push('submitted_at');
    if (availableColumns.has('locked_by')) selectFields.push('locked_by');
    if (availableColumns.has('locked_at')) selectFields.push('locked_at');

    const hasQaFlag = availableColumns.has('qa_flag');
    const hasTestRunId = availableColumns.has('test_run_id');

    let query = `
      SELECT 
        ${selectFields.join(',\n        ')}
      FROM public.assessments
      WHERE 1=1
    `;

    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    // Exclude test assessments by default (unless include_qa=true)
    // Test marker rule: qa_flag = true OR test_run_id IS NOT NULL
    if (!includeQa) {
      if (hasQaFlag && hasTestRunId) {
        // Primary: Use qa_flag and test_run_id (deterministic test marker rule)
        query += ` AND (qa_flag = false OR qa_flag IS NULL) AND (test_run_id IS NULL)`;
        // Fallback defense-in-depth: also exclude by name prefix
        query += ` AND (facility_name NOT LIKE $${paramIndex} OR facility_name IS NULL)`;
        params.push('[QA]%');
        paramIndex++;
      } else if (hasQaFlag) {
        // Use qa_flag column if available (test_run_id not yet added)
        query += ` AND (qa_flag = false OR qa_flag IS NULL)`;
        // Fallback: exclude by name prefix [QA]
        query += ` AND (facility_name NOT LIKE $${paramIndex} OR facility_name IS NULL)`;
        params.push('[QA]%');
        paramIndex++;
      } else {
        // Fallback: exclude by name prefix [QA] only
        query += ` AND (facility_name NOT LIKE $${paramIndex} OR facility_name IS NULL)`;
        params.push('[QA]%');
        paramIndex++;
      }
    }

    // Order by created_at if it exists, otherwise by id
    if (availableColumns.has('created_at')) {
      query += ` ORDER BY created_at DESC`;
    } else {
      query += ` ORDER BY id DESC`;
    }

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCode = (error as { code?: string })?.code;
    
    console.error('[API /api/runtime/assessments GET] Error:', {
      message: errorMessage,
      code: errorCode,
      stack: errorStack
    });
    
    return NextResponse.json(
      {
        error: 'Failed to fetch assessments',
        message: errorMessage,
        code: errorCode || undefined,
        hint: errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND'
          ? 'Database connection failed. Check RUNTIME_DATABASE_URL and verify the runtime database is reachable.'
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/runtime/assessments
 * 
 * Creates a new assessment with instance.
 * 
 * Body:
 * - name: string (required) - Facility or assessment name
 * - sector_id?: uuid (optional)
 * - subsector_id?: uuid (optional)
 * 
 * Returns:
 * - assessment_id: uuid
 * - assessment_instance_id: uuid
 */
export async function POST(request: NextRequest) {
  try {
    // Hard guard: Assert RUNTIME-owned tables are on correct pool
    await assertTableOnOwnerPool("public.assessments");
    
    const bodyResult = createAssessmentBodySchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          message: bodyResult.error.issues[0]?.message ?? 'Malformed payload',
        },
        { status: 400 }
      );
    }
    const body = bodyResult.data;
    
    // Support both new facility-based format and legacy format
    const isNewFormat = body.assessment_name && body.sector_code && body.subsector_code && body.facility;
    
    if (isNewFormat) {
      // New facility-based format
      const assessment_name = body.assessment_name;
      const sector_code = body.sector_code;
      const subsector_code = body.subsector_code;
      const facility = body.facility;
      const subsector_details = body.subsector_details;
      const modules = body.modules;

      if (!assessment_name || typeof assessment_name !== 'string' || assessment_name.trim().length === 0) {
        return NextResponse.json(
          { error: 'assessment_name is required and must be a non-empty string' },
          { status: 400 }
        );
      }

      if (!sector_code || !subsector_code) {
        return NextResponse.json(
          { error: 'sector_code and subsector_code are required' },
          { status: 400 }
        );
      }

      if (!facility?.facility_name) {
        return NextResponse.json(
          { error: 'facility.facility_name is required' },
          { status: 400 }
        );
      }

      if (!facility?.poc_name || !facility?.poc_email || !facility?.poc_phone) {
        return NextResponse.json(
          { error: 'facility.poc_name, facility.poc_email, and facility.poc_phone are required' },
          { status: 400 }
        );
      }

      let pool;
      let client;
      
      try {
        pool = await ensureRuntimePoolConnected();
        client = await pool.connect();
        await client.query('BEGIN');

        // Resolve template from body when provided (avoids template_id FK 500)
        let resolvedTemplateId: string | null = null;
        if (body.template_id || body.template) {
          const tid =
            body.template_id ??
            body.template?.id ??
            (body.template ? `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : undefined);
          if (!tid) {
            await client.query('ROLLBACK').catch(() => {});
            return NextResponse.json(
              { error: 'template_id or template.id is required when providing template.' },
              { status: 400 }
            );
          }
          const ensured = await ensureTemplateExists(client, tid, body.template);
          if (!ensured.ok) {
            await client.query('ROLLBACK').catch(() => {});
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
          }
          resolvedTemplateId = tid;
        }

        // Create facility
        // Check actual schema first
        const facilitiesColumnsCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'facilities'
          ORDER BY ordinal_position
        `);
        const facilitiesColumns = new Set((facilitiesColumnsCheck.rows as ColumnNameRow[]).map((r) => r.column_name));
        
        // Build INSERT based on actual schema
        const facilityInsertCols: string[] = [];
        const facilityInsertVals: (string | number | boolean | null)[] = [];
        
        // Generate ID if 'id' column exists and is required
        if (facilitiesColumns.has('id')) {
          // Check if id is nullable or has default
          const idColumnInfo = await client.query(`
            SELECT is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'facilities'
            AND column_name = 'id'
          `);
          const idRow = idColumnInfo.rows[0] as IsNullableRow | undefined;
          const idIsNullable = idRow?.is_nullable === 'YES';
          const idHasDefault = idRow?.column_default !== null && idRow?.column_default !== undefined;
          
          // If id is NOT NULL and has no default, we need to generate one
          if (!idIsNullable && !idHasDefault) {
            // Based on actual schema, facilities.id is TEXT, not UUID
            // Generate a TEXT ID
            const sanitizedName = facility.facility_name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .substring(0, 30);
            const facilityId = `${sanitizedName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            facilityInsertCols.push('id');
            facilityInsertVals.push(facilityId);
          }
        }
        
        // Use 'name' if it exists, otherwise 'facility_name'
        // Based on actual schema, it's 'name'
        if (facilitiesColumns.has('name')) {
          facilityInsertCols.push('name');
          facilityInsertVals.push(facility.facility_name);
        } else if (facilitiesColumns.has('facility_name')) {
          facilityInsertCols.push('facility_name');
          facilityInsertVals.push(facility.facility_name);
        } else {
          throw new Error('Facilities table must have either "name" or "facility_name" column');
        }
        
        // Add optional address fields if columns exist
        if (facilitiesColumns.has('address_line1')) {
          facilityInsertCols.push('address_line1');
          facilityInsertVals.push(facility.address_line1 || null);
        }
        if (facilitiesColumns.has('address_line2')) {
          facilityInsertCols.push('address_line2');
          facilityInsertVals.push(facility.address_line2 || null);
        }
        if (facilitiesColumns.has('city')) {
          facilityInsertCols.push('city');
          facilityInsertVals.push(facility.city || null);
        }
        if (facilitiesColumns.has('state')) {
          facilityInsertCols.push('state');
          facilityInsertVals.push(facility.state || null);
        }
        if (facilitiesColumns.has('postal_code')) {
          facilityInsertCols.push('postal_code');
          facilityInsertVals.push(facility.postal_code || null);
        }
        if (facilitiesColumns.has('latitude')) {
          facilityInsertCols.push('latitude');
          facilityInsertVals.push(facility.latitude || null);
        }
        if (facilitiesColumns.has('longitude')) {
          facilityInsertCols.push('longitude');
          facilityInsertVals.push(facility.longitude || null);
        }
        if (facilitiesColumns.has('poc_name')) {
          facilityInsertCols.push('poc_name');
          facilityInsertVals.push(facility.poc_name || null);
        }
        if (facilitiesColumns.has('poc_email')) {
          facilityInsertCols.push('poc_email');
          facilityInsertVals.push(facility.poc_email || null);
        }
        if (facilitiesColumns.has('poc_phone')) {
          facilityInsertCols.push('poc_phone');
          facilityInsertVals.push(facility.poc_phone || null);
        }
        
        // Determine return column name - actual schema uses 'id'
        const returnCol = facilitiesColumns.has('id') ? 'id' : (facilitiesColumns.has('facility_id') ? 'facility_id' : 'id');
        
        const placeholders = facilityInsertCols.map((_, i) => `$${i + 1}`).join(', ');
        const facilityQuery = `
          INSERT INTO facilities (${facilityInsertCols.join(', ')})
          VALUES (${placeholders})
          RETURNING ${returnCol}
        `;
        
        const facilityResult = await client.query(facilityQuery, facilityInsertVals);
        const facility_id = facilityResult.rows[0][returnCol];

        // Resolve sector_id from sector_code
        // Schema: sectors.id is TEXT (like "general", "education_facilities")
        // But assessments table may expect UUID for sector_id
        // Check if sectors has id_uuid column and use that if assessments expects UUID
        let sector_id: string | null = null;
        if (sector_code) {
          try {
            // Check what assessments.sector_id expects
            const assessmentsSectorIdCheck = await client.query(`
              SELECT data_type 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'assessments'
              AND column_name = 'sector_id'
            `);
            const sectorIdRow = assessmentsSectorIdCheck.rows[0] as DataTypeRow | undefined;
            const expectsUUID = assessmentsSectorIdCheck.rows.length > 0 && sectorIdRow?.data_type === 'uuid';
            
            if (expectsUUID) {
              // Query for id_uuid instead of id
              const sectorResult = await client.query(
                'SELECT id_uuid FROM sectors WHERE id = $1 LIMIT 1',
                [sector_code]
              );
              const sectorRow = sectorResult.rows[0] as { id_uuid?: string } | undefined;
              if (sectorResult.rows.length > 0 && sectorRow?.id_uuid) {
                sector_id = sectorRow.id_uuid;
                console.log(`[API] Resolved sector_id (UUID): ${sector_id} for code: ${sector_code}`);
              } else {
                console.warn(`[API] Sector not found or missing id_uuid for id: ${sector_code}`);
              }
            } else {
              // Use TEXT id directly - try exact match first
              let sectorResult = await client.query(
                'SELECT id FROM sectors WHERE id = $1 LIMIT 1',
                [sector_code]
              );
              
              // If not found, try case-insensitive match
              if (sectorResult.rows.length === 0) {
                sectorResult = await client.query(
                  'SELECT id FROM sectors WHERE LOWER(id) = LOWER($1) LIMIT 1',
                  [sector_code]
                );
              }
              
              const sectorTextRow = sectorResult.rows[0] as { id: string } | undefined;
              if (sectorResult.rows.length > 0 && sectorTextRow) {
                sector_id = sectorTextRow.id;
                console.log(`[API] Resolved sector_id (TEXT): ${sector_id} for code: ${sector_code}`);
              } else {
                // Log available sectors for debugging
                const allSectors = await client.query('SELECT id FROM sectors LIMIT 10');
                console.warn(`[API] Sector not found for id: ${sector_code}. Available sectors (sample):`, 
                  (allSectors.rows as { id: string }[]).map((r) => r.id));
              }
            }
          } catch (err: unknown) {
            console.error('[API] Error resolving sector_id:', err instanceof Error ? err.message : String(err));
          }
        }

        // Resolve subsector_id from subsector_code
        // Schema: subsectors.id is TEXT (like "ed1", "ed2")
        // But assessments table may expect UUID for subsector_id
        // Check if subsectors has id_uuid column and use that if assessments expects UUID
        let subsector_id: string | null = null;
        if (subsector_code) {
          try {
            // Check what assessments.subsector_id expects
            const assessmentsSubsectorIdCheck = await client.query(`
              SELECT data_type 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'assessments'
              AND column_name = 'subsector_id'
            `);
            const subsectorIdRow = assessmentsSubsectorIdCheck.rows[0] as DataTypeRow | undefined;
            const expectsUUID = assessmentsSubsectorIdCheck.rows.length > 0 && subsectorIdRow?.data_type === 'uuid';
            
            if (expectsUUID) {
              // Query for id_uuid instead of id
              const subsectorResult = await client.query(
                'SELECT id_uuid FROM subsectors WHERE id = $1 LIMIT 1',
                [subsector_code]
              );
              const subsectorUuidRow = subsectorResult.rows[0] as { id_uuid?: string } | undefined;
              if (subsectorResult.rows.length > 0 && subsectorUuidRow?.id_uuid) {
                subsector_id = subsectorUuidRow.id_uuid;
                console.log(`[API] Resolved subsector_id (UUID): ${subsector_id} for code: ${subsector_code}`);
              } else {
                console.warn(`[API] Subsector not found or missing id_uuid for id: ${subsector_code}`);
              }
            } else {
              // Use TEXT id directly - try exact match first
              let subsectorResult = await client.query(
                'SELECT id FROM subsectors WHERE id = $1 LIMIT 1',
                [subsector_code]
              );
              
              // If not found, try case-insensitive match
              if (subsectorResult.rows.length === 0) {
                subsectorResult = await client.query(
                  'SELECT id FROM subsectors WHERE LOWER(id) = LOWER($1) LIMIT 1',
                  [subsector_code]
                );
              }
              
              const subsectorTextRow = subsectorResult.rows[0] as { id: string } | undefined;
              if (subsectorResult.rows.length > 0 && subsectorTextRow) {
                subsector_id = subsectorTextRow.id;
                console.log(`[API] Resolved subsector_id (TEXT): ${subsector_id} for code: ${subsector_code}`);
              } else {
                // Log available subsectors for debugging
                const allSubsectors = await client.query(
                  'SELECT id, sector_id FROM subsectors WHERE sector_id = $1 LIMIT 10',
                  [sector_id || sector_code]
                );
                console.warn(`[API] Subsector not found for id: ${subsector_code}. Available subsectors (sample):`, 
                  (allSubsectors.rows as { id: string }[]).map((r) => r.id));
              }
            }
          } catch (err: unknown) {
            console.error('[API] Error resolving subsector_id:', err instanceof Error ? err.message : String(err));
          }
        }

        // Create facility snapshot
        const facility_snapshot = {
          facility,
          sector_code,
          subsector_code,
          subsector_details: subsector_details || {},
          modules: modules || []
        };

        // Check if qa_flag column exists and get value from body
        let hasQaFlag = false;
        let qaFlagValue = false;
        try {
          const columnCheck = await client.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'assessments'
            AND column_name = 'qa_flag'
          `);
          hasQaFlag = columnCheck.rows.length > 0;
          if (hasQaFlag && body.qa_flag !== undefined) {
            qaFlagValue = Boolean(body.qa_flag);
          }
        } catch {
          // Ignore errors
        }

        // Validate that we have the required IDs (if codes were provided)
        if (sector_code && !sector_id) {
          // Get list of available sectors for better error message
          const availableSectors = await client.query('SELECT id FROM sectors ORDER BY id LIMIT 20');
          const sectorList = (availableSectors.rows as { id: string }[]).map((r) => r.id).join(', ');
          throw new Error(
            `Sector not found for code: "${sector_code}". ` +
            `Please verify the sector code is correct. Available sectors: ${sectorList || 'none'}`
          );
        }
        if (subsector_code && !subsector_id) {
          // Get list of available subsectors for the sector (if found) or all subsectors
          const subsectorQuery = sector_id 
            ? 'SELECT id FROM subsectors WHERE sector_id = $1 ORDER BY id LIMIT 20'
            : 'SELECT id FROM subsectors ORDER BY id LIMIT 20';
          const subsectorParams = sector_id ? [sector_id] : [];
          const availableSubsectors = await client.query(subsectorQuery, subsectorParams);
          const subsectorList = (availableSubsectors.rows as { id: string }[]).map((r) => r.id).join(', ');
          throw new Error(
            `Subsector not found for code: "${subsector_code}". ` +
            `Please verify the subsector code is correct. Available subsectors: ${subsectorList || 'none'}`
          );
        }
        
        console.log('[API] Resolved IDs:', { sector_id, subsector_id, sector_code, subsector_code });

        // Create assessment
        console.log('[API] Step 1: Creating assessment record...');
        const assessmentQuery = hasQaFlag && qaFlagValue
          ? `INSERT INTO public.assessments (id, facility_name, sector_id, subsector_id, status, qa_flag, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, 'DRAFT', $4, NOW(), NOW())
             RETURNING id`
          : `INSERT INTO public.assessments (id, facility_name, sector_id, subsector_id, status, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, 'DRAFT', NOW(), NOW())
             RETURNING id`;
        
        const assessmentParams = hasQaFlag && qaFlagValue
          ? [assessment_name.trim(), sector_id, subsector_id, qaFlagValue]
          : [assessment_name.trim(), sector_id, subsector_id];
        
        console.log('[API] Assessment query:', assessmentQuery);
        console.log('[API] Assessment params:', {
          assessment_name: assessment_name.trim(),
          sector_id: `${sector_id} (type: ${typeof sector_id})`,
          subsector_id: `${subsector_id} (type: ${typeof subsector_id})`,
          sector_code,
          subsector_code
        });
        
        let assessment_id: string;
        try {
          const assessmentResult = await client.query(assessmentQuery, assessmentParams);
          assessment_id = assessmentResult.rows[0].id;
          console.log('[API] Step 1: SUCCESS - Assessment created with id:', assessment_id);
        } catch (err: unknown) {
          const e = err as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string };
          console.error('[API] Step 1: FAILED - Assessment creation error:', {
            message: e.message,
            code: e.code,
            detail: e.detail,
            constraint: e.constraint,
            table: e.table,
            column: e.column
          });
          throw err;
        }

        // Create or update assessment_definitions
        console.log('[API] Step 2: Creating assessment_definitions record...');
        // NOTE: assessment_definitions.facility_id expects UUID, but facilities.id is TEXT
        // Check if we need to convert or if facility_id can be null
        const assessmentDefsFacilityIdCheck = await client.query(`
          SELECT data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_definitions'
          AND column_name = 'facility_id'
        `);
        const defsRow = assessmentDefsFacilityIdCheck.rows[0] as { data_type?: string; is_nullable?: string } | undefined;
        const facilityIdExpectsUUID = assessmentDefsFacilityIdCheck.rows.length > 0 && defsRow?.data_type === 'uuid';
        const facilityIdIsNullable = assessmentDefsFacilityIdCheck.rows.length > 0 && defsRow?.is_nullable === 'YES';
        
        // If facility_id expects UUID but we have TEXT, set to null (if nullable) or skip
        const facilityIdForDefs = (facilityIdExpectsUUID && typeof facility_id === 'string' && !facility_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
          ? (facilityIdIsNullable ? null : undefined)
          : facility_id;
        
        if (facilityIdForDefs === undefined) {
          throw new Error('assessment_definitions.facility_id requires UUID but facilities.id is TEXT and column is NOT NULL');
        }
        
        console.log('[API] Assessment definitions params:', {
          assessment_id,
          facility_id: facilityIdForDefs,
          sector_code,
          subsector_code,
          modules: modules?.length || 0
        });
        
        try {
          await client.query(
            `INSERT INTO public.assessment_definitions (
              assessment_id, facility_id, sector_code, subsector_code, modules, 
              baseline_core_version, facility_snapshot
            ) VALUES ($1, $2, $3, $4, $5::jsonb, 'BASELINE_CORE_V1', $6::jsonb)
            ON CONFLICT (assessment_id) DO UPDATE SET
              facility_id = EXCLUDED.facility_id,
              sector_code = EXCLUDED.sector_code,
              subsector_code = EXCLUDED.subsector_code,
              modules = EXCLUDED.modules,
              facility_snapshot = EXCLUDED.facility_snapshot,
              updated_at = NOW()`,
            [
              assessment_id,
              facilityIdForDefs,
              sector_code,
              subsector_code,
              JSON.stringify(modules || []),
              JSON.stringify(facility_snapshot)
            ]
          );
          console.log('[API] Step 2: SUCCESS - Assessment definitions created');
        } catch (err: unknown) {
          const e = err as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string };
          console.error('[API] Step 2: FAILED - Assessment definitions creation error:', {
            message: e.message,
            code: e.code,
            detail: e.detail,
            constraint: e.constraint,
            table: e.table,
            column: e.column
          });
          throw err;
        }

        // Create assessment_instance
        console.log('[API] Step 3: Creating assessment_instance record...');
        // Schema: assessment_instances.id is TEXT, template_id is TEXT, facility_id is TEXT
        let instanceId: string;
        
        // Check assessment_instances schema
        const instanceIdCheck = await client.query(`
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_instances'
          AND column_name = 'id'
        `);
        const instanceIdRow = instanceIdCheck.rows[0] as DataTypeRow | undefined;
        const instanceIdIsText = instanceIdCheck.rows.length > 0 && instanceIdRow?.data_type === 'text';
        
        // Generate instance ID based on type
        const generateInstanceId = async () => {
          if (instanceIdIsText) {
            return `instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          } else {
            const { randomUUID } = await import('crypto');
            return randomUUID();
          }
        };
        
        // Check if assessment_templates table exists; use body-provided template when present
        let templateId: string | null = resolvedTemplateId;
        let templatesTableExists = false;
        if (!resolvedTemplateId) {
          try {
            const tableExistsCheck = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'assessment_templates'
              )
            `);
            templatesTableExists = tableExistsCheck.rows[0]?.exists === true;

            if (templatesTableExists) {
              const templateResult = await client.query(`SELECT id FROM public.assessment_templates LIMIT 1`);
              templateId = templateResult.rows.length > 0 ? templateResult.rows[0].id : null;
            }
          } catch (err: unknown) {
            console.warn('[API] Could not check/query assessment_templates table:', err instanceof Error ? err.message : String(err));
            templatesTableExists = false;
          }
        }

        const instanceColumns = await client.query(`
          SELECT column_name, is_nullable, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'assessment_instances' AND column_name = 'template_id'
        `);
        const instanceColRow = instanceColumns.rows[0] as { is_nullable?: string; data_type?: string } | undefined;
        const templateIdRequired = instanceColumns.rows.length > 0 && instanceColRow?.is_nullable === 'NO';

        if (templateIdRequired && !templateId) {
          // Create table if it doesn't exist
          let tableJustCreated = false;
          if (!templatesTableExists) {
            console.log('[API] Creating assessment_templates table...');
            await client.query(`
              CREATE TABLE IF NOT EXISTS public.assessment_templates (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NULL,
                discipline_ids TEXT[] NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              )
            `);
            templatesTableExists = true;
            tableJustCreated = true;
            console.log('[API] assessment_templates table created');
          }
          
          // Check if templates.id is TEXT or UUID
          const templateIdCheck = await client.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'assessment_templates'
            AND column_name = 'id'
          `);
          const templateIdTypeRow = templateIdCheck.rows[0] as DataTypeRow | undefined;
          const templateIdIsTextType = templateIdCheck.rows.length > 0 && templateIdTypeRow?.data_type === 'text';
          
          // Check required columns for assessment_templates
          const templateColumnsCheck = await client.query(`
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'assessment_templates'
          `);
          type TemplateColRow = { column_name: string; is_nullable: string; column_default: string | null };
          const templateColumns = new Map<string, { nullable: boolean; default: string | null }>(
            (templateColumnsCheck.rows as TemplateColRow[]).map((r) => [r.column_name, { nullable: r.is_nullable === 'YES', default: r.column_default }])
          );
          
          // Build INSERT based on actual schema
          const templateInsertCols: string[] = [];
          const templateInsertVals: (string | number | boolean | null | string[])[] = [];
          
          // Generate ID based on type
          if (templateIdIsTextType) {
            const templateIdValue = `template-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            templateInsertCols.push('id');
            templateInsertVals.push(templateIdValue);
          } else {
            // UUID will be generated by database
            templateInsertCols.push('id');
          }
          
          // Add name
          templateInsertCols.push('name');
          templateInsertVals.push('Baseline v2 Template');
          
          // Add discipline_ids if required (NOT NULL without default)
          // Note: If we just created the table, it has DEFAULT '{}', so we don't need to include it
          if (templateColumns.has('discipline_ids') && !tableJustCreated) {
            const disciplineIdsCol = templateColumns.get('discipline_ids')!;
            // Only include if NOT NULL and no default (or default is null/empty string)
            const hasDefault = disciplineIdsCol.default && disciplineIdsCol.default !== null && disciplineIdsCol.default !== '';
            if (!disciplineIdsCol.nullable && !hasDefault) {
              templateInsertCols.push('discipline_ids');
              templateInsertVals.push([]); // Empty array - pg driver will convert to TEXT[]
            }
          }
          
          // Skip created_at and updated_at - they have DEFAULT NOW()
          // Don't include them in INSERT since they have defaults
          
          // Build placeholders correctly
          let placeholderIndex = 1;
          const templatePlaceholders = templateInsertCols
            .map((col) => {
              if (col === 'id' && !templateIdIsTextType) {
                return 'gen_random_uuid()';
              }
              if (col === 'created_at' || col === 'updated_at') {
                return 'NOW()';
              }
              const placeholder = `$${placeholderIndex}`;
              placeholderIndex++;
              return placeholder;
            })
            .join(', ');
          
          console.log('[API] Creating template with:', {
            columns: templateInsertCols,
            placeholders: templatePlaceholders,
            values: templateInsertVals
          });
          
          let newTemplateResult;
          try {
            newTemplateResult = await client.query(
              `INSERT INTO public.assessment_templates (${templateInsertCols.join(', ')}) VALUES (${templatePlaceholders}) RETURNING id`,
              templateInsertVals
            );
            console.log('[API] Template created successfully:', newTemplateResult.rows[0].id);
          } catch (templateErr: unknown) {
            const te = templateErr as { message?: string; code?: string; detail?: string; constraint?: string };
            console.error('[API] Failed to create template:', {
              message: te.message,
              code: te.code,
              detail: te.detail,
              constraint: te.constraint
            });
            throw templateErr;
          }
          
          const defaultTemplateId = newTemplateResult.rows[0].id;
          console.log('[API] Using template_id:', defaultTemplateId);
          
          // Verify template exists in the current transaction before using it
          // Use a query that will see uncommitted rows in the transaction
          const templateVerify = await client.query(
            'SELECT id FROM public.assessment_templates WHERE id = $1',
            [defaultTemplateId]
          );
          if (templateVerify.rows.length === 0) {
            throw new Error(`Template ${defaultTemplateId} was created but not found in database`);
          }
          console.log('[API] Template verified in database');
          
          // Use TEXT facility_id (from facilities.id), not UUID assessment_id
          // Schema: assessment_instances uses 'started_at' not 'created_at'
          // Schema: assessment_instances.status must be 'in_progress' (not 'DRAFT')
          const instanceId1 = await generateInstanceId();
          console.log('[API] Creating assessment_instance with template_id:', defaultTemplateId);
          
          try {
            const instanceResult = await client.query(`
              INSERT INTO public.assessment_instances (id, template_id, facility_id, facility_name, status, started_at)
              VALUES ($1, $2, $3, $4, 'in_progress', NOW())
              RETURNING id
            `, [instanceId1, defaultTemplateId, facility_id, assessment_name.trim()]);
            instanceId = instanceResult.rows[0].id;
            console.log('[API] Assessment instance created:', instanceId);
          } catch (instanceErr: unknown) {
            const ie = instanceErr as { code?: string; constraint?: string };
            // If foreign key constraint fails, try to get an existing template
            if (ie.code === '23503' && ie.constraint?.includes('template_id')) {
              console.warn('[API] Foreign key constraint failed, trying to find existing template...');
              const existingTemplate = await client.query(
                'SELECT id FROM public.assessment_templates ORDER BY created_at DESC LIMIT 1'
              );
              if (existingTemplate.rows.length > 0) {
                const existingTemplateId = (existingTemplate.rows[0] as { id: string }).id;
                console.log('[API] Using existing template:', existingTemplateId);
                const instanceResult = await client.query(`
                  INSERT INTO public.assessment_instances (id, template_id, facility_id, facility_name, status, started_at)
                  VALUES ($1, $2, $3, $4, 'in_progress', NOW())
                  RETURNING id
                `, [instanceId1, existingTemplateId, facility_id, assessment_name.trim()]);
                instanceId = instanceResult.rows[0].id;
                console.log('[API] Assessment instance created with existing template:', instanceId);
              } else {
                throw instanceErr;
              }
            } else {
              throw instanceErr;
            }
          }
        } else if (templateId) {
          // Use TEXT facility_id (from facilities.id), not UUID assessment_id
          // Schema: assessment_instances uses 'started_at' not 'created_at'
          // Schema: assessment_instances.status must be 'in_progress' (not 'DRAFT')
          const instanceId2 = await generateInstanceId();
          const instanceResult = await client.query(`
            INSERT INTO public.assessment_instances (id, template_id, facility_id, facility_name, status, started_at)
            VALUES ($1, $2, $3, $4, 'in_progress', NOW())
            RETURNING id
          `, [instanceId2, templateId, facility_id, assessment_name.trim()]);
          instanceId = instanceResult.rows[0].id;
        } else {
          try {
            // Use TEXT facility_id (from facilities.id), not UUID assessment_id
            // Schema: assessment_instances uses 'started_at' not 'created_at'
            // Schema: assessment_instances.status must be 'in_progress' (not 'DRAFT')
            const instanceId3 = await generateInstanceId();
            const instanceResult = await client.query(`
              INSERT INTO public.assessment_instances (id, facility_id, facility_name, status, started_at)
              VALUES ($1, $2, $3, 'in_progress', NOW())
              RETURNING id
            `, [instanceId3, facility_id, assessment_name.trim()]);
            instanceId = instanceResult.rows[0].id;
            console.log('[API] Step 3: SUCCESS - Assessment instance created with id:', instanceId);
          } catch (err: unknown) {
            console.warn('[API] Could not create assessment_instance, using assessment_id as instance_id:', err instanceof Error ? err.message : String(err));
            instanceId = assessment_id;
          }
        }

        console.log('[API] Committing transaction...');
        await client.query('COMMIT');
        console.log('[API] Transaction committed successfully');

        // Reconcile modules based on subsector policy (after commit)
        // This will auto-attach DEFAULT_ON and REQUIRED modules
        try {
          const { reconcileModulesForAssessment } = await import('@/app/lib/runtime/reconcile_modules');
          // Use TEXT subsector_code for policy lookup (subsector_module_policy uses TEXT subsector_id)
          const reconcileResult = await reconcileModulesForAssessment({
            assessmentId: assessment_id,
            subsectorId: subsector_code // Use TEXT code for policy lookup
          });
          console.log('[API] Module reconciliation result:', reconcileResult);
        } catch (reconcileError: unknown) {
          // Log but don't fail - reconciliation is best-effort
          console.warn('[API] Could not reconcile modules:', reconcileError instanceof Error ? reconcileError.message : String(reconcileError));
        }

        // Create user-selected module instances (enable modules for this assessment)
        // This happens after reconcile so user selections take precedence
        if (modules && Array.isArray(modules) && modules.length > 0) {
          try {
            console.log('[API] Creating user-selected module instances for modules:', modules);
            for (const moduleCode of modules) {
              if (moduleCode && typeof moduleCode === 'string' && moduleCode.startsWith('MODULE_')) {
                try {
                  await pool.query(
                    `INSERT INTO public.assessment_module_instances 
                     (assessment_id, module_code, attached_via, is_locked)
                     VALUES ($1, $2, 'USER', false)
                     ON CONFLICT (assessment_id, module_code) 
                     DO UPDATE SET 
                       attached_via = CASE 
                         WHEN assessment_module_instances.is_locked = true 
                         THEN assessment_module_instances.attached_via 
                         ELSE 'USER' 
                       END,
                       is_locked = CASE 
                         WHEN assessment_module_instances.is_locked = true 
                         THEN true 
                         ELSE false 
                       END`,
                    [assessment_id, moduleCode]
                  );
                  console.log(`[API] User-selected module ${moduleCode} enabled for assessment`);
                } catch (moduleErr: unknown) {
                  // Log but don't fail - module might not exist yet
                  console.warn(`[API] Could not enable module ${moduleCode}:`, moduleErr instanceof Error ? moduleErr.message : String(moduleErr));
                }
              }
            }
          } catch (moduleInstanceError: unknown) {
            // Log but don't fail - module instances are optional
            console.warn('[API] Could not create module instances:', moduleInstanceError instanceof Error ? moduleInstanceError.message : String(moduleInstanceError));
          }
        }

        // Compose assessment universe (best-effort, don't fail on error)
        try {
          const modulesJson = JSON.stringify(modules || []);
          const composeScript = path.join(process.cwd(), 'tools', 'runtime', 'compose_assessment_universe.py');
          
          await new Promise<void>((resolve) => {
            const pythonProcess = spawn('python', [
              composeScript,
              assessment_id,
              sector_code || 'null',
              subsector_code || 'null',
              modulesJson
            ], { cwd: process.cwd(), stdio: 'pipe' });
            
            pythonProcess.on('close', (code: number) => {
              if (code === 0) {
                console.log('[API] Assessment universe composed successfully');
              } else {
                console.warn('[API] Warning from compose_assessment_universe');
              }
              resolve();
            });
            
            pythonProcess.on('error', () => {
              console.warn('[API] Could not compose assessment universe');
              resolve();
            });
          });
        } catch (composeError: unknown) {
          console.warn('[API] Could not compose assessment universe:', composeError instanceof Error ? composeError.message : String(composeError));
        }

        return NextResponse.json({
          ok: true,
          assessment_id,
          assessment_instance_id: instanceId,
          facility_id,
          name: assessment_name.trim(),
          status: 'DRAFT'
        }, { status: 201 });

      } catch (error: unknown) {
        if (client) {
          await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
        }
        const e = error as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string; stack?: string };
        console.error('[API /api/runtime/assessments POST] Transaction error:', {
          message: e?.message,
          code: e?.code,
          detail: e?.detail,
          constraint: e?.constraint,
          table: e?.table,
          column: e?.column,
          stack: e?.stack
        });
        throw error;
      } finally {
        if (client) {
          client.release();
        }
      }
    }
    
    // Legacy format for backward compatibility
    const name = body.name;
    const sector_id = body.sector_id;
    const subsector_id = body.subsector_id;
    const modules = body.modules;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const pool = await ensureRuntimePoolConnected();

    // Check if qa_flag column exists (it should, but check anyway)
    let hasQaFlag = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessments'
        AND column_name = 'qa_flag'
      `);
      hasQaFlag = columnCheck.rows.length > 0;
    } catch (err: unknown) {
      console.warn('[API] Error checking for qa_flag column:', err);
      hasQaFlag = false;
    }

    // Check for required version columns
    type VersionColRow = { column_name: string; is_nullable: string; column_default: string | null };
    const versionColumns: Record<string, { nullable: boolean; default: string | null }> = {};
    try {
      const versionColumnsCheck = await pool.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'assessments'
        AND column_name IN ('baseline_version', 'sector_version', 'subsector_version', 'ofc_version')
      `);
      
      for (const row of versionColumnsCheck.rows as VersionColRow[]) {
        versionColumns[row.column_name] = {
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
        };
      }
    } catch {
      // Ignore errors checking version columns
    }

    // Build INSERT statement dynamically based on available columns
    const insertCols: string[] = ['id', 'facility_name', 'sector_id', 'subsector_id', 'status'];
    const insertVals: string[] = ['gen_random_uuid()', '$1', '$2', '$3', '$4'];
    const params: (string | null | boolean)[] = [name.trim(), sector_id ?? null, subsector_id ?? null, 'DRAFT'];
    let paramIndex = 5;

    if (hasQaFlag) {
      insertCols.push('qa_flag');
      insertVals.push('$' + paramIndex);
      // Accept qa_flag from request body, default to false
      params.push(body.qa_flag === true ? true : false);
      paramIndex++;
    }

    // Add version columns if they exist and are required (NOT NULL without default)
    if (versionColumns.baseline_version && !versionColumns.baseline_version.nullable && !versionColumns.baseline_version.default) {
      insertCols.push('baseline_version');
      insertVals.push('$' + paramIndex);
      params.push('v2');
      paramIndex++;
    }
    if (versionColumns.sector_version && !versionColumns.sector_version.nullable && !versionColumns.sector_version.default) {
      insertCols.push('sector_version');
      insertVals.push('$' + paramIndex);
      params.push('v1');
      paramIndex++;
    }
    if (versionColumns.subsector_version && !versionColumns.subsector_version.nullable && !versionColumns.subsector_version.default) {
      insertCols.push('subsector_version');
      insertVals.push('$' + paramIndex);
      params.push('v1');
      paramIndex++;
    }
    if (versionColumns.ofc_version && !versionColumns.ofc_version.nullable && !versionColumns.ofc_version.default) {
      insertCols.push('ofc_version');
      insertVals.push('$' + paramIndex);
      params.push('v1');
      paramIndex++;
    }

    insertCols.push('created_at', 'updated_at');
    insertVals.push('NOW()', 'NOW()');

    // Create assessment
    // Log the query for debugging
    const insertQuery = `
      INSERT INTO public.assessments (
        ${insertCols.join(', ')}
      ) VALUES (
        ${insertVals.join(', ')}
      )
      RETURNING id
    `;
    
    console.log('[API POST /assessments] Insert query:', insertQuery);
    console.log('[API POST /assessments] Params:', params);
    console.log('[API POST /assessments] Columns:', insertCols);
    console.log('[API POST /assessments] Values:', insertVals);
    
    const assessmentResult = await pool.query(insertQuery, params);

    const assessmentId = assessmentResult.rows[0].id;

    // Resolve template from body when provided (avoids template_id FK 500)
    let resolvedTemplateId: string | null = null;
    if (body.template_id || body.template) {
      const tid =
        body.template_id ??
        body.template?.id ??
        (body.template ? `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : undefined);
      if (!tid) {
        return NextResponse.json(
          { error: 'template_id or template.id is required when providing template.' },
          { status: 400 }
        );
      }
      const ensured = await ensureTemplateExists(pool, tid, body.template);
      if (!ensured.ok) {
        return NextResponse.json({ error: ensured.error }, { status: ensured.status });
      }
      resolvedTemplateId = tid;
    }

    // Create or find assessment_instance
    // Check if assessment_templates table exists; use body-provided template when present
    let templateId: string | null = resolvedTemplateId;
    let templatesTableExists = false;
    if (!resolvedTemplateId) {
      try {
        const tableExistsCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'assessment_templates'
          )
        `);
        templatesTableExists = tableExistsCheck.rows[0]?.exists === true;

        if (templatesTableExists) {
          const templateResult = await pool.query(`
            SELECT id FROM public.assessment_templates LIMIT 1
          `);
          templateId = templateResult.rows.length > 0 ? templateResult.rows[0].id : null;
        }
      } catch (err: unknown) {
        console.warn('[API] Could not check/query assessment_templates table:', err instanceof Error ? err.message : String(err));
        templatesTableExists = false;
      }
    }

    // Check if assessment_instances table requires template_id
    const instanceColumns = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'assessment_instances'
      AND column_name = 'template_id'
    `);

    const instanceColRowLegacy = instanceColumns.rows[0] as { is_nullable?: string } | undefined;
    const templateIdRequired = instanceColumns.rows.length > 0 && instanceColRowLegacy?.is_nullable === 'NO';

    // Ensure instanceId is always defined in outer scope (used by all branches below)
    let instanceId: string | null = null;

    if (templateIdRequired && !templateId) {
      // Create table if it doesn't exist
      if (!templatesTableExists) {
        console.log('[API] Creating assessment_templates table...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.assessment_templates (
            id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NULL,
            discipline_ids TEXT[] NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        templatesTableExists = true;
        console.log('[API] assessment_templates table created');
      }
      
      // Build simple INSERT with only required fields
      // Since table has defaults for discipline_ids, created_at, updated_at, we only need id and name
      const templateIdValue = `template-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      console.log('[API] Creating template with id:', templateIdValue);
      
      // Create a default template
      let newTemplateResult;
      try {
        // Simple INSERT - only id and name, let defaults handle the rest
        newTemplateResult = await pool.query(
          `INSERT INTO public.assessment_templates (id, name) VALUES ($1, $2) RETURNING id`,
          [templateIdValue, 'Baseline v2 Template']
        );
        console.log('[API] Template created successfully:', newTemplateResult.rows[0].id);
      } catch (templateErr: unknown) {
        const te = templateErr as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string };
        console.error('[API] Failed to create template:', {
          message: te.message,
          code: te.code,
          detail: te.detail,
          constraint: te.constraint,
          table: te.table,
          column: te.column
        });
        throw templateErr;
      }
      
      const defaultTemplateId = (newTemplateResult.rows[0] as { id: string }).id;
      console.log('[API] Using template_id:', defaultTemplateId);
      
      // Verify template exists before using it
      const templateVerify = await pool.query(
        'SELECT id FROM public.assessment_templates WHERE id = $1',
        [defaultTemplateId]
      );
      if (templateVerify.rows.length === 0) {
        throw new Error(`Template ${defaultTemplateId} was created but not found in database`);
      }
      console.log('[API] Template verified in database');
      
      // Generate instance ID (TEXT, not UUID)
      const instanceIdValue = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      console.log('[API] Creating assessment_instance with template_id:', defaultTemplateId);

      instanceId = instanceIdValue ?? null;

      try {
        const instanceResult = await pool.query(`
          INSERT INTO public.assessment_instances (
            id, template_id, facility_id, facility_name, status, started_at
          ) VALUES (
            $1, $2, $3, $4, 'in_progress', NOW()
          )
          RETURNING id
        `, [instanceIdValue, defaultTemplateId, assessmentId, name.trim()]);

        // Prefer DB-returned id; keep null-safe and explicit
        instanceId = String(instanceResult.rows?.[0]?.id ?? instanceIdValue ?? "");
        console.log("[API] Assessment instance created:", instanceId);
      } catch (instanceErr: unknown) {
        const ie = instanceErr as { code?: string; constraint?: string };
        // If foreign key constraint fails, try to get an existing template
        if (ie.code === '23503' && ie.constraint?.includes('template_id')) {
          console.warn('[API] Foreign key constraint failed, trying to find existing template...');
          const existingTemplate = await pool.query(
            'SELECT id FROM public.assessment_templates ORDER BY created_at DESC LIMIT 1'
          );
          if (existingTemplate.rows.length > 0) {
            const existingTemplateId = (existingTemplate.rows[0] as { id: string }).id;
            console.log('[API] Using existing template:', existingTemplateId);
            const instanceResult = await pool.query(`
              INSERT INTO public.assessment_instances (
                id, template_id, facility_id, facility_name, status, started_at
              ) VALUES (
                $1, $2, $3, $4, 'in_progress', NOW()
              )
              RETURNING id
            `, [instanceIdValue, existingTemplateId, assessmentId, name.trim()]);
            instanceId = instanceResult.rows[0].id;
            console.log('[API] Assessment instance created with existing template:', instanceId);
          } else {
            throw instanceErr;
          }
        } else {
          throw instanceErr;
        }
      }

      // Hard fail if we still don't have an instance id
      if (!instanceId) {
        return NextResponse.json(
          { error: "Failed to resolve assessment instance id" },
          { status: 500 }
        );
      }
    } else if (templateId) {
      // Generate instance ID (TEXT, not UUID)
      const instanceIdValue = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const instanceResult = await pool.query(`
        INSERT INTO public.assessment_instances (
          id, template_id, facility_id, facility_name, status, started_at
        ) VALUES (
          $1, $2, $3, $4, 'in_progress', NOW()
        )
        RETURNING id
      `, [instanceIdValue, templateId, assessmentId, name.trim()]);
      
      instanceId = instanceResult.rows[0].id;
    } else {
      // Try to create instance without template_id (if nullable)
      try {
        const instanceResult = await pool.query(`
          INSERT INTO public.assessment_instances (
            id, facility_id, facility_name, status, started_at
          ) VALUES (
            gen_random_uuid(), $1, $2, 'in_progress', NOW()
          )
          RETURNING id
        `, [assessmentId, name.trim()]);
        
        instanceId = instanceResult.rows[0].id;
      } catch (err: unknown) {
        // If that fails, use assessment_id as instance_id
        console.warn('[API] Could not create assessment_instance, using assessment_id as instance_id:', err instanceof Error ? err.message : String(err));
        instanceId = assessmentId;
      }
    }

    // Reconcile modules based on subsector policy (if subsector_id exists)
    // This will auto-attach DEFAULT_ON and REQUIRED modules
    if (subsector_id) {
      try {
        // Resolve UUID to TEXT code if needed for policy lookup
        let subsectorCodeForPolicy: string | null = null;
        if (subsector_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // UUID - resolve to TEXT code
          const resolvedResult = await pool.query(
            'SELECT id FROM subsectors WHERE id_uuid = $1 LIMIT 1',
            [subsector_id]
          );
          if (resolvedResult.rows.length > 0) {
            subsectorCodeForPolicy = (resolvedResult.rows[0] as { id: string }).id;
          }
        } else {
          subsectorCodeForPolicy = subsector_id;
        }

        if (subsectorCodeForPolicy) {
          const { reconcileModulesForAssessment } = await import('@/app/lib/runtime/reconcile_modules');
          const reconcileResult = await reconcileModulesForAssessment({
            assessmentId,
            subsectorId: subsectorCodeForPolicy
          });
          console.log('[API] Module reconciliation result:', reconcileResult);
        }
      } catch (reconcileError: unknown) {
        // Log but don't fail - reconciliation is best-effort
        console.warn('[API] Could not reconcile modules:', reconcileError instanceof Error ? reconcileError.message : String(reconcileError));
      }
    }

    // Create user-selected module instances (enable modules for this assessment)
    // This happens after reconcile so user selections take precedence
    if (modules && Array.isArray(modules) && modules.length > 0) {
      try {
        console.log('[API] Creating user-selected module instances for modules:', modules);
        for (const moduleCode of modules) {
          if (moduleCode && typeof moduleCode === 'string' && moduleCode.startsWith('MODULE_')) {
            try {
              await pool.query(
                `INSERT INTO public.assessment_module_instances 
                 (assessment_id, module_code, attached_via, is_locked)
                 VALUES ($1, $2, 'USER', false)
                 ON CONFLICT (assessment_id, module_code) 
                 DO UPDATE SET 
                   attached_via = CASE 
                     WHEN assessment_module_instances.is_locked = true 
                     THEN assessment_module_instances.attached_via 
                     ELSE 'USER' 
                   END,
                   is_locked = CASE 
                     WHEN assessment_module_instances.is_locked = true 
                     THEN true 
                     ELSE false 
                   END`,
                [assessmentId, moduleCode]
              );
              console.log(`[API] User-selected module ${moduleCode} enabled for assessment`);
            } catch (moduleErr: unknown) {
              // Log but don't fail - module might not exist yet
              console.warn(`[API] Could not enable module ${moduleCode}:`, moduleErr instanceof Error ? moduleErr.message : String(moduleErr));
            }
          }
        }
      } catch (moduleInstanceError: unknown) {
        // Log but don't fail - module instances are optional
        console.warn('[API] Could not create module instances:', moduleInstanceError instanceof Error ? moduleInstanceError.message : String(moduleInstanceError));
      }
    }

    // Compose assessment universe (baseline core + modules)
    try {
      // Import and call compose function directly
      
      const modulesArray = modules || [];
      const modulesJson = JSON.stringify(modulesArray);
      const sectorCode = sector_id || null;
      const subsectorCode = subsector_id || null;
      
      // Call compose_assessment_universe.py as subprocess
      const composeScript = path.join(process.cwd(), 'tools', 'runtime', 'compose_assessment_universe.py');
      
      await new Promise<void>((resolve) => {
        const pythonProcess = spawn('python', [
          composeScript,
          assessmentId,
          sectorCode || 'null',
          subsectorCode || 'null',
          modulesJson
        ], {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
        
        let stderr = '';
        
        pythonProcess.stdout.on('data', () => {
          // stdout discarded
        });
        
        pythonProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
        
        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            console.log('[API] Assessment universe composed successfully');
            resolve();
          } else {
            console.warn('[API] Warning from compose_assessment_universe:', stderr);
            // Don't fail - universe composition is optional for now
            resolve();
          }
        });
        
        pythonProcess.on('error', (err: Error) => {
          console.warn('[API] Could not compose assessment universe:', err.message);
          // Don't fail - universe composition is optional for now
          resolve();
        });
      });
    } catch (composeError: unknown) {
      // Log but don't fail - universe composition is optional for now
      console.warn('[API] Could not compose assessment universe:', composeError instanceof Error ? composeError.message : String(composeError));
    }

    return NextResponse.json({
      assessment_id: assessmentId,
      assessment_instance_id: instanceId,
      name: name.trim(),
      status: 'DRAFT'
    }, { status: 201 });

  } catch (error: unknown) {
    const e = error as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string; stack?: string };
    console.error('[API /api/runtime/assessments POST] Error:', error);
    const errorMessage = e?.message ?? 'Unknown error';
    const errorCode = e?.code ?? 'UNKNOWN';
    const errorDetails = e?.stack ?? e?.detail;
    
    // Log full error details for debugging
    console.error('[API /api/runtime/assessments POST] Full error details:', {
      message: errorMessage,
      code: errorCode,
      detail: e?.detail,
      constraint: e?.constraint,
      table: e?.table,
      column: e?.column,
      stack: errorDetails
    });
    
    // Return more helpful error message
    let userMessage = 'Failed to create assessment';
    if (e?.code === '23502') { // NOT NULL violation
      userMessage = `Missing required field: ${e?.column ?? 'unknown'}`;
    } else if (e?.code === '23505') { // Unique violation
      userMessage = 'An assessment with this name already exists';
    } else if (e?.code === '23503') { // Foreign key violation
      userMessage = `Invalid reference: ${e?.detail ?? 'foreign key constraint violation'}`;
    } else if (e?.code === '23514') { // Check constraint violation
      userMessage = `Invalid value: ${e?.constraint ?? 'check constraint violation'}`;
    }
    
    return NextResponse.json(
      {
        error: userMessage,
        message: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? {
          detail: e?.detail,
          constraint: e?.constraint,
          table: e?.table,
          column: e?.column,
          stack: errorDetails
        } : undefined
      },
      { status: 500 }
    );
  }
}

