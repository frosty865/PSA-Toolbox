import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * POST /api/runtime/test-assessments
 * 
 * Creates a test/training assessment with minimal required fields.
 * This endpoint is specifically designed for test assessments and handles
 * all the complexity internally.
 * 
 * Body: (optional - all fields have defaults)
 * - assessment_name?: string (default: "[TEST] Training Assessment {timestamp}")
 * 
 * Returns:
 * - assessment_id: uuid
 * - assessment_instance_id: string
 * - facility_id: string
 */
export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;
  
  try {
    const bodyUnknown = await request.json().catch(() => ({}));
    const body = bodyUnknown as { assessment_name?: string };
    const assessmentName = body.assessment_name || `[TEST] Training Assessment ${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
    
    const pool = await ensureRuntimePoolConnected();
    client = await pool.connect();
    await client.query('BEGIN');
    
    // Step 1: Get or create a default template (simplified)
    let templateId: string | null = null;
    
    // Check if template_id is required for assessment_instances
    const instanceColumns = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'assessment_instances' 
      AND column_name = 'template_id'
    `);
    
    type ColRow = { is_nullable?: string; data_type?: string };
    const instanceColRow = instanceColumns.rows[0] as ColRow | undefined;
    const templateIdRequired = instanceColumns.rows.length > 0 && instanceColRow?.is_nullable === 'NO';
    const templateIdIsText = instanceColumns.rows.length > 0 && instanceColRow?.data_type === 'text';
    
    if (templateIdRequired) {
      try {
        // Check if table exists first
        const templatesTableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'assessment_templates'
          )
        `);
        
        if (!templatesTableExists.rows[0]?.exists) {
          // Create table if it doesn't exist
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
          console.log('[Test Assessment] Created assessment_templates table');
        }
        
        // Try to get existing template first
        const existingTemplate = await client.query(`
          SELECT id FROM public.assessment_templates 
          ORDER BY created_at DESC 
          LIMIT 1
        `);
        
        if (existingTemplate.rows.length > 0) {
          templateId = existingTemplate.rows[0].id;
          console.log('[Test Assessment] Using existing template:', templateId);
        } else {
          // Create a simple default template
          const templateIdValue = templateIdIsText 
            ? `template-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
            : null;
          
          const templateInsert = templateIdIsText
            ? `INSERT INTO public.assessment_templates (id, name) VALUES ($1, $2) RETURNING id`
            : `INSERT INTO public.assessment_templates (name) VALUES ($1) RETURNING id`;
          
          const templateParams = templateIdIsText 
            ? [templateIdValue, 'Test Assessment Template']
            : ['Test Assessment Template'];
          
          console.log('[Test Assessment] Creating template with:', { templateInsert, templateParams });
          const templateResult = await client.query(templateInsert, templateParams);
          templateId = templateResult.rows[0].id;
          console.log('[Test Assessment] Created template:', templateId);
          
          // Verify template exists - use text cast to handle UUID/TEXT types
          const verifyTemplate = await client.query(
            'SELECT id FROM public.assessment_templates WHERE id::text = $1',
            [String(templateId)]
          );
          if (verifyTemplate.rows.length === 0) {
            throw new Error(`Template ${templateId} was created but not found`);
          }
          console.log('[Test Assessment] Verified template exists:', templateId);
          
          // Also check what the foreign key constraint actually references
          const fkCheck = await client.query(`
            SELECT 
              tc.constraint_name,
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'assessment_instances'
              AND kcu.column_name = 'template_id'
          `);
          if (fkCheck.rows.length > 0) {
            console.log('[Test Assessment] Foreign key constraint details:', fkCheck.rows[0]);
          }
        }
      } catch (templateErr: unknown) {
        const te = templateErr as { message?: string; code?: string; detail?: string };
        console.error('[Test Assessment] Failed to get/create template:', {
          message: te.message,
          code: te.code,
          detail: te.detail
        });
        throw new Error(`Failed to get/create template: ${te.message ?? String(templateErr)}`);
      }
    }
    
    // Step 2: Get first available sector and subsector (or use null if not required)
    // Note: assessments.sector_id and assessments.subsector_id expect UUID, not TEXT
    let sectorId: string | null = null;
    let subsectorId: string | null = null;
    let sectorCode: string | null = null;
    let subsectorCode: string | null = null;
    
    try {
      // Check if assessments table expects UUID for sector_id
      const sectorIdTypeCheck = await client.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'assessments' 
        AND column_name = 'sector_id'
      `);
      
      const expectsUUID = sectorIdTypeCheck.rows.length > 0 && sectorIdTypeCheck.rows[0].data_type === 'uuid';
      
      // Get first active sector
      let sectorQuery = 'SELECT id FROM sectors WHERE is_active = true ORDER BY id LIMIT 1';
      if (expectsUUID) {
        // Check if id_uuid column exists
        const idUuidCheck = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'sectors' 
          AND column_name = 'id_uuid'
        `);
        
        if (idUuidCheck.rows.length > 0) {
          sectorQuery = 'SELECT id, id_uuid FROM sectors WHERE is_active = true ORDER BY id LIMIT 1';
        }
      }
      
      const sectorResult = await client.query(sectorQuery);
      
      if (sectorResult.rows.length > 0) {
        sectorCode = sectorResult.rows[0].id; // TEXT code for assessment_definitions
        sectorId = expectsUUID && sectorResult.rows[0].id_uuid 
          ? sectorResult.rows[0].id_uuid 
          : sectorResult.rows[0].id;
        
        // Get first active subsector for this sector
        let subsectorQuery = 'SELECT id FROM subsectors WHERE sector_id = $1 AND is_active = true ORDER BY id LIMIT 1';
        if (expectsUUID) {
          const idUuidCheck = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'subsectors' 
            AND column_name = 'id_uuid'
          `);
          
          if (idUuidCheck.rows.length > 0) {
            subsectorQuery = 'SELECT id, id_uuid FROM subsectors WHERE sector_id = $1 AND is_active = true ORDER BY id LIMIT 1';
          }
        }
        
        const subsectorResult = await client.query(subsectorQuery, [sectorCode]);
        
        if (subsectorResult.rows.length > 0) {
          subsectorCode = subsectorResult.rows[0].id; // TEXT code for assessment_definitions
          subsectorId = expectsUUID && subsectorResult.rows[0].id_uuid
            ? subsectorResult.rows[0].id_uuid
            : subsectorResult.rows[0].id;
        }
      }
    } catch (err: unknown) {
      console.warn('[Test Assessment] Could not resolve sector/subsector, continuing with null:', err instanceof Error ? err.message : String(err));
      // Continue without sector/subsector - they may be optional
    }
    
    // Step 3: Create facility (simple test facility)
    const facilityId = `facility-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Check facilities table schema
      const facilitiesColumns = await client.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'facilities'
      `);
      
      const facilitiesColMap = new Map(
        (facilitiesColumns.rows as { column_name: string; is_nullable: string; column_default: string | null }[]).map((r) => [r.column_name, { nullable: r.is_nullable === 'YES', default: r.column_default }])
      );
      
      const facilityInsertCols: string[] = [];
      const facilityInsertVals: unknown[] = [];
      
      if (facilitiesColMap.has('id')) {
        facilityInsertCols.push('id');
        facilityInsertVals.push(facilityId);
      }
      
      if (facilitiesColMap.has('name')) {
        facilityInsertCols.push('name');
        facilityInsertVals.push('Test Facility');
      } else if (facilitiesColMap.has('facility_name')) {
        facilityInsertCols.push('facility_name');
        facilityInsertVals.push('Test Facility');
      }
      
      // Add POC fields if they exist
      if (facilitiesColMap.has('poc_name')) {
        facilityInsertCols.push('poc_name');
        facilityInsertVals.push('Test User');
      }
      if (facilitiesColMap.has('poc_email')) {
        facilityInsertCols.push('poc_email');
        facilityInsertVals.push('test@example.com');
      }
      if (facilitiesColMap.has('poc_phone')) {
        facilityInsertCols.push('poc_phone');
        facilityInsertVals.push('555-0100');
      }
      
      if (facilityInsertCols.length === 0) {
        throw new Error('No valid columns found for facilities table');
      }
      
      const facilityPlaceholders = facilityInsertCols.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO facilities (${facilityInsertCols.join(', ')}) VALUES (${facilityPlaceholders})`,
        facilityInsertVals
      );
      console.log('[Test Assessment] Created facility:', facilityId);
    } catch (facilityErr: unknown) {
      const fe = facilityErr as { message?: string; code?: string; detail?: string };
      console.error('[Test Assessment] Failed to create facility:', {
        message: fe.message,
        code: fe.code,
        detail: fe.detail
      });
      throw new Error(`Failed to create facility: ${fe.message ?? String(facilityErr)}`);
    }
    
    // Step 4: Create assessment
    let assessmentId: string;
    
    try {
      const assessmentColumns = await client.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'assessments'
      `);
      
      const assessmentColMap = new Map(
        (assessmentColumns.rows as { column_name: string; is_nullable: string; column_default: string | null }[]).map((r) => [r.column_name, { nullable: r.is_nullable === 'YES', default: r.column_default }])
      );
      
      // Build assessment insert - only include columns that exist and need values
      const assessmentInsertCols: string[] = ['facility_name'];
      const assessmentInsertVals: unknown[] = [assessmentName];
      
      if (assessmentColMap.has('sector_id') && sectorId) {
        assessmentInsertCols.push('sector_id');
        assessmentInsertVals.push(sectorId);
      }
      
      if (assessmentColMap.has('subsector_id') && subsectorId) {
        assessmentInsertCols.push('subsector_id');
        assessmentInsertVals.push(subsectorId);
      }
      
      if (assessmentColMap.has('status')) {
        assessmentInsertCols.push('status');
        assessmentInsertVals.push('DRAFT');
      }
      
      if (assessmentColMap.has('qa_flag')) {
        assessmentInsertCols.push('qa_flag');
        assessmentInsertVals.push(true);
      }
      
      // id, created_at, updated_at are handled by database defaults or gen_random_uuid()
      
      const assessmentPlaceholders = assessmentInsertCols.map((_, i) => `$${i + 1}`).join(', ');
      
      console.log('[Test Assessment] Inserting assessment with:', {
        cols: assessmentInsertCols,
        vals: assessmentInsertVals.map((v, i) => `${assessmentInsertCols[i]}=${v}`)
      });
      
      const assessmentResult = await client.query(
        `INSERT INTO public.assessments (${assessmentInsertCols.join(', ')}) 
         VALUES (${assessmentPlaceholders}) 
         RETURNING id`,
        assessmentInsertVals
      );
      
      assessmentId = assessmentResult.rows[0].id;
      console.log('[Test Assessment] Created assessment:', assessmentId);
    } catch (assessmentErr: unknown) {
      const ae = assessmentErr as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string };
      console.error('[Test Assessment] Failed to create assessment:', {
        message: ae.message,
        code: ae.code,
        detail: ae.detail,
        constraint: ae.constraint,
        table: ae.table,
        column: ae.column
      });
      throw new Error(`Failed to create assessment: ${ae.message ?? String(assessmentErr)} (${ae.code ?? 'unknown'})`);
    }
    
    // Step 5: Create assessment_instance (if needed)
    // IMPORTANT: Save point before instance creation so we can rollback just this part if it fails
    let instanceId: string = assessmentId; // Default to assessment_id
    
    const instancesTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'assessment_instances'
      )
    `);
    
    if (instancesTableExists.rows[0]?.exists) {
      // Use SAVEPOINT so we can rollback just the instance creation without losing the assessment
      await client.query('SAVEPOINT before_instance_creation');
      
      try {
        // Check if template_id is required
        const templateIdRequiredCheck = await client.query(`
          SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_instances' 
          AND column_name = 'template_id'
        `);
        
        const templateIdRequired = templateIdRequiredCheck.rows.length > 0 && 
                                   templateIdRequiredCheck.rows[0].is_nullable === 'NO';
        
        if (templateIdRequired && !templateId) {
          throw new Error('assessment_instances requires template_id but no template was created');
        }
        
        const instanceIdType = await client.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_instances' 
          AND column_name = 'id'
        `);
        
        const instanceIdIsText = instanceIdType.rows.length > 0 && instanceIdType.rows[0].data_type === 'text';
        
        // Generate instance ID - always required (no default in schema)
        const generatedInstanceId = instanceIdIsText
          ? `instance-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          : `instance-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; // Fallback to text even if not text
        
        const instanceCols: string[] = ['id'];
        const instanceVals: unknown[] = [generatedInstanceId];
        
        // template_id is required (TEXT, no default)
        if (templateId) {
          // Check template_id data type for recreation if needed
          const templateIdTypeCheck = await client.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'assessment_instances' 
            AND column_name = 'template_id'
          `);
          const templateIdIsTextType = templateIdTypeCheck.rows.length > 0 && templateIdTypeCheck.rows[0].data_type === 'text';
          
          // Verify template still exists before using it (in case of transaction issues)
          const verifyTemplateBeforeUse = await client.query(
            'SELECT id FROM public.assessment_templates WHERE id::text = $1',
            [String(templateId)]
          );
          if (verifyTemplateBeforeUse.rows.length === 0) {
            console.warn(`[Test Assessment] Template ${templateId} not found, attempting to recreate or find existing`);
            // Try to find any existing template first
            const existingTemplate = await client.query(
              'SELECT id FROM public.assessment_templates ORDER BY created_at DESC LIMIT 1'
            );
            if (existingTemplate.rows.length > 0) {
              templateId = existingTemplate.rows[0].id;
              console.log(`[Test Assessment] Using existing template: ${templateId}`);
            } else {
              // Recreate the template if none exists
              const newTemplateIdValue = templateIdIsTextType 
                ? `template-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
                : null;
              
              const templateInsert = templateIdIsTextType
                ? `INSERT INTO public.assessment_templates (id, name) VALUES ($1, $2) RETURNING id`
                : `INSERT INTO public.assessment_templates (name) VALUES ($1) RETURNING id`;
              
              const templateParams = templateIdIsTextType 
                ? [newTemplateIdValue, 'Test Assessment Template']
                : ['Test Assessment Template'];
              
              const templateResult = await client.query(templateInsert, templateParams);
              templateId = templateResult.rows[0].id;
              console.log(`[Test Assessment] Recreated template: ${templateId}`);
            }
          }
          instanceCols.push('template_id');
          instanceVals.push(templateId);
        } else if (templateIdRequired) {
          throw new Error('template_id is required but was not set');
        }
        
        // facility_id and facility_name are optional
        instanceCols.push('facility_id', 'facility_name');
        instanceVals.push(facilityId, assessmentName);
        
        // status has default but we'll set it explicitly
        const instanceStatusCheck = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_instances' 
          AND column_name = 'status'
        `);
        
        if (instanceStatusCheck.rows.length > 0) {
          instanceCols.push('status');
          instanceVals.push('in_progress');
        }
        
        // started_at has default, but we can set it explicitly if needed
        // For now, let the default handle it
        
        // Build placeholders - all columns need values
        const instancePlaceholders = instanceCols.map((_, i) => `$${i + 1}`).join(', ');
        
        const instanceResult = await client.query(
          `INSERT INTO public.assessment_instances (${instanceCols.join(', ')}) 
           VALUES (${instancePlaceholders}) 
           RETURNING id`,
          instanceVals
        );
        
        instanceId = instanceResult.rows[0].id;
        console.log('[Test Assessment] Created assessment_instance:', instanceId);
        // Release savepoint on success
        await client.query('RELEASE SAVEPOINT before_instance_creation');
      } catch (instanceErr: unknown) {
        const ie = instanceErr as { message?: string; code?: string; constraint?: string };
        console.error('[Test Assessment] Could not create assessment_instance:', {
          message: ie.message,
          code: ie.code,
          constraint: ie.constraint
        });
        // Rollback to savepoint (keeps assessment creation)
        try {
          await client.query('ROLLBACK TO SAVEPOINT before_instance_creation');
          console.log('[Test Assessment] Rolled back to savepoint, assessment still exists');
        } catch (rollbackErr: unknown) {
          const re = rollbackErr as { message?: string };
          console.error('[Test Assessment] Failed to rollback to savepoint:', re.message);
          throw new Error(`Instance creation failed and rollback failed: ${ie.message ?? String(instanceErr)}`);
        }
        // Don't fail the whole operation - assessment can exist without instance
        instanceId = assessmentId;
      }
    }
    
    // Step 6: Create assessment_definitions (optional, best effort)
    try {
      // Check if table exists and what columns it has
      const defsTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_definitions'
        )
      `);
      
      if (defsTableExists.rows[0]?.exists) {
        const defsColumns = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_definitions'
        `);
        
        const defsColSet = new Set((defsColumns.rows as { column_name: string }[]).map((r) => r.column_name));
        const defsCols: string[] = ['assessment_id'];
        const defsVals: unknown[] = [assessmentId];
        
        if (defsColSet.has('facility_id')) {
          defsCols.push('facility_id');
          // facility_id expects UUID but facilities.id is TEXT - set to null if required
          defsVals.push(null);
        }
        
        if (defsColSet.has('sector_code')) {
          defsCols.push('sector_code');
          defsVals.push(sectorCode); // Use TEXT code, not UUID
        }
        
        if (defsColSet.has('subsector_code')) {
          defsCols.push('subsector_code');
          defsVals.push(subsectorCode); // Use TEXT code, not UUID
        }
        
        if (defsColSet.has('baseline_core_version')) {
          defsCols.push('baseline_core_version');
          defsVals.push('BASELINE_CORE_V1');
        }
        
        // modules is NOT NULL with default '[]' - include empty array
        if (defsColSet.has('modules')) {
          defsCols.push('modules');
          defsVals.push([]); // Empty array - pg driver will convert to JSONB
        }
        
        if (defsColSet.has('facility_snapshot')) {
          defsCols.push('facility_snapshot');
          // Pass object directly - pg driver will handle JSONB conversion
          defsVals.push({
            facility: {
              facility_name: 'Test Facility',
              poc_name: 'Test User',
              poc_email: 'test@example.com',
              poc_phone: '555-0100'
            },
            sector_code: sectorCode,
            subsector_code: subsectorCode
          });
        }
        
        // Build placeholders with JSONB cast for JSONB columns
        const defsPlaceholders = defsCols.map((col, i) => {
          if (col === 'facility_snapshot' || col === 'modules') {
            return `$${i + 1}::jsonb`;
          }
          return `$${i + 1}`;
        }).join(', ');
        
        const conflictClause = defsColSet.has('assessment_id') 
          ? 'ON CONFLICT (assessment_id) DO NOTHING'
          : '';
        
        console.log('[Test Assessment] Inserting assessment_definitions with:', {
          cols: defsCols,
          conflictClause
        });
        
        await client.query(
          `INSERT INTO public.assessment_definitions (${defsCols.join(', ')}) 
           VALUES (${defsPlaceholders})
           ${conflictClause}`,
          defsVals
        );
        console.log('[Test Assessment] Created assessment_definitions');
      }
    } catch (defsErr: unknown) {
      const de = defsErr as { message?: string; code?: string };
      console.warn('[Test Assessment] Could not create assessment_definitions (non-critical):', {
        message: de.message,
        code: de.code
      });
      if (de.code === '25P02' || de.message?.includes('current transaction is aborted')) {
        console.error('[Test Assessment] CRITICAL: Transaction aborted during definitions - this should not happen with savepoints');
      }
    }
    
    await client.query('COMMIT');
    console.log('[Test Assessment] Transaction committed successfully');
    
    // Release client BEFORE verification (use fresh connection from pool)
    client.release();
    client = null;
    
    // Verify assessment exists after commit using a fresh connection
    const verifyPool = await ensureRuntimePoolConnected();
    const verifyAfterCommit = await verifyPool.query(
      'SELECT id FROM public.assessments WHERE id::text = $1',
      [assessmentId]
    );
    if (verifyAfterCommit.rows.length === 0) {
      console.error('[Test Assessment] CRITICAL: Assessment not found after commit!');
      throw new Error('Assessment was not persisted after commit');
    }
    console.log('[Test Assessment] Verified assessment exists after commit:', assessmentId);
    
    return NextResponse.json({
      ok: true,
      assessment_id: assessmentId,
      assessment_instance_id: instanceId,
      facility_id: facilityId,
      name: assessmentName,
      status: 'DRAFT'
    }, { status: 201 });
    
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string; detail?: string; constraint?: string; table?: string; column?: string; stack?: string; hint?: string };
    console.error('[Test Assessment] Error occurred, rolling back transaction:', {
      message: e?.message,
      code: e?.code,
      stack: e?.stack
    });
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('[Test Assessment] Transaction rolled back');
      } catch (rollbackErr) {
        console.error('[Test Assessment] Rollback failed:', rollbackErr);
      }
      client.release();
    }
    
    const errorDetails = {
      message: e?.message,
      code: e?.code,
      detail: e?.detail,
      constraint: e?.constraint,
      table: e?.table,
      column: e?.column,
      stack: e?.stack
    };
    
    console.error('[API /api/runtime/test-assessments POST] Error:', errorDetails);
    
    return NextResponse.json(
      {
        error: 'Failed to create test assessment',
        message: e?.message ?? 'Unknown error',
        code: e?.code,
        ...(process.env.NODE_ENV === 'development' ? {
          details: {
            detail: e?.detail,
            constraint: e?.constraint,
            table: e?.table,
            column: e?.column,
            hint: e?.hint
          }
        } : {})
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      console.log('[Test Assessment] Releasing database client');
      client.release();
      client = null;
    }
  }
}

