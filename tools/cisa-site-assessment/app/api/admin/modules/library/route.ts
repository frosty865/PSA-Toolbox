import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/modules/library
 * 
 * Returns all modules in the library with their questions.
 */
export async function GET() {
  try {
    let pool;
    try {
      pool = getRuntimePool();
    } catch (poolError: unknown) {
      const msg = poolError instanceof Error ? poolError.message : 'Database connection error';
      console.error('[API /api/admin/modules/library] Failed to get runtime pool:', poolError);
      return NextResponse.json(
        {
          error: 'Failed to connect to database',
          message: msg,
          details: process.env.NODE_ENV === 'development' && poolError instanceof Error ? poolError.stack : undefined
        },
        { status: 500 }
      );
    }
    
    // Check if assessment_modules table exists first
    let tableExists = false;
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'assessment_modules'
        ) as table_exists
      `);
      tableExists = tableCheck.rows[0]?.table_exists === true;
    } catch (checkError: unknown) {
      const msg = checkError instanceof Error ? checkError.message : 'Schema check error';
      console.error('[API /api/admin/modules/library] Failed to check assessment_modules table:', checkError);
      return NextResponse.json(
        {
          error: 'Failed to check database schema',
          message: msg,
          details: process.env.NODE_ENV === 'development' && checkError instanceof Error ? checkError.stack : undefined
        },
        { status: 500 }
      );
    }

    if (!tableExists) {
      console.warn('[API /api/admin/modules/library] assessment_modules table does not exist');
      return NextResponse.json({
        modules: [],
        total: 0
      });
    }

    // Check which columns exist in assessment_modules
    const assessmentModulesColumns = new Set<string>();
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessment_modules'
      `);
      (columnCheck.rows as { column_name: string }[]).forEach((r) => assessmentModulesColumns.add(r.column_name));
    } catch (colCheckError: unknown) {
      console.warn('[API /api/admin/modules/library] Failed to check assessment_modules columns:', colCheckError instanceof Error ? colCheckError.message : String(colCheckError));
    }

    // Build SELECT clause dynamically based on available columns
    const selectCols: string[] = [];
    if (assessmentModulesColumns.has('module_code')) selectCols.push('module_code');
    if (assessmentModulesColumns.has('module_name')) selectCols.push('module_name');
    if (assessmentModulesColumns.has('description')) selectCols.push('description');
    if (assessmentModulesColumns.has('created_at')) selectCols.push('created_at');
    if (assessmentModulesColumns.has('updated_at')) selectCols.push('updated_at');
    if (assessmentModulesColumns.has('is_active')) selectCols.push('is_active');
    if (assessmentModulesColumns.has('status')) selectCols.push('status');

    // Get all active modules (including DRAFT status if status column exists)
    let modulesResult;
    try {
      const whereClause = assessmentModulesColumns.has('is_active') 
        ? 'WHERE is_active = true' 
        : '';
      
      modulesResult = await pool.query(`
        SELECT ${selectCols.join(', ')}
        FROM public.assessment_modules
        ${whereClause}
        ORDER BY module_code
      `);
    } catch (queryError: unknown) {
      const e = queryError as { message?: string; code?: string; detail?: string; hint?: string; position?: string; stack?: string };
      console.error('[API /api/admin/modules/library] Failed to query assessment_modules:', queryError);
      console.error('[API /api/admin/modules/library] Query error details:', {
        message: e?.message,
        code: e?.code,
        detail: e?.detail,
        hint: e?.hint,
        position: e?.position
      });
      return NextResponse.json(
        {
          error: 'Failed to load modules',
          message: e?.message ?? 'Database query error',
          code: e?.code,
          details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        },
        { status: 500 }
      );
    }

    // Check if module_questions table exists and which columns it has
    let moduleQuestionsTableExists = false;
    const availableColumns = new Set<string>();
    const selectColumns: string[] = [];
    
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'module_questions'
        ) as table_exists
      `);
      
      moduleQuestionsTableExists = tableCheck.rows[0]?.table_exists === true;
      
      if (tableExists) {
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'module_questions'
        `);
        
        (columnCheck.rows as { column_name: string }[]).forEach((r) => availableColumns.add(r.column_name));
        
        // Build SELECT clause dynamically based on available columns
        // Core columns (must exist for query to work)
        if (availableColumns.has('module_question_id')) {
          selectColumns.push('module_question_id');
        }
        if (availableColumns.has('question_text')) {
          selectColumns.push('question_text');
        }
        if (availableColumns.has('response_enum')) {
          selectColumns.push('response_enum');
        }
        
        // If we don't have at least the core columns, don't try to query
        if (selectColumns.length === 0) {
          console.warn('[API /api/admin/modules/library] module_questions table exists but has no recognized columns');
          moduleQuestionsTableExists = false; // Treat as if table doesn't exist
        } else {
          // Optional columns
          if (availableColumns.has('question_intent')) selectColumns.push('question_intent');
          if (availableColumns.has('order_index')) {
            selectColumns.push('order_index');
          } else if (availableColumns.has('question_order')) {
            selectColumns.push('question_order AS order_index');
          }
          
          if (availableColumns.has('asset_or_location')) selectColumns.push('asset_or_location');
          if (availableColumns.has('event_trigger')) selectColumns.push('event_trigger');
          if (availableColumns.has('discipline_id')) selectColumns.push('discipline_id');
          if (availableColumns.has('discipline_subtype_id')) selectColumns.push('discipline_subtype_id');
        }
      }
    } catch (schemaCheckError: unknown) {
      console.warn('[API /api/admin/modules/library] Error checking module_questions schema:', schemaCheckError instanceof Error ? schemaCheckError.message : String(schemaCheckError));
      // Continue with empty questions if schema check fails
      moduleQuestionsTableExists = false;
    }
    
    // Safety check: ensure we have a valid result
    if (!modulesResult || !Array.isArray(modulesResult.rows)) {
      console.error('[API /api/admin/modules/library] Invalid modulesResult:', modulesResult);
      return NextResponse.json(
        {
          error: 'Invalid database response',
          message: 'Database query returned unexpected format'
        },
        { status: 500 }
      );
    }

    // Get module-specific questions for each module (NOT baseline)
    type ModuleRow = Record<string, unknown> & { module_code: string };
    const modules = await Promise.all(
      (modulesResult.rows as ModuleRow[]).map(async (module) => {
        try {
          // If table doesn't exist or no valid columns, return empty questions
          if (!moduleQuestionsTableExists || selectColumns.length === 0) {
            let chunk_count = 0;
            try {
              const chunkResult = await pool.query(
                `SELECT COUNT(*)::int AS n
                 FROM public.module_chunks mc
                 JOIN public.module_documents md ON md.id = mc.module_document_id
                 WHERE md.module_code = $1 AND md.status = 'INGESTED'`,
                [module.module_code]
              );
              chunk_count = chunkResult.rows[0]?.n ?? 0;
            } catch {
              // ignore
            }
            return {
              ...module,
              questions: [],
              question_count: 0,
              chunk_count
            };
          }
          
          // Build ORDER BY clause
          const orderBy = availableColumns.has('order_index') 
            ? 'ORDER BY order_index ASC' 
            : availableColumns.has('question_order')
            ? 'ORDER BY question_order ASC'
            : availableColumns.has('created_at')
            ? 'ORDER BY created_at ASC'
            : '';
          
          const questionsResult = await pool.query(`
            SELECT ${selectColumns.join(', ')}
            FROM public.module_questions
            WHERE module_code = $1
            ${orderBy}
          `, [module.module_code]);

          // Chunk count from RUNTIME (ingested module_documents -> module_chunks)
          let chunk_count = 0;
          try {
            const chunkResult = await pool.query(
              `SELECT COUNT(*)::int AS n
               FROM public.module_chunks mc
               JOIN public.module_documents md ON md.id = mc.module_document_id
               WHERE md.module_code = $1 AND md.status = 'INGESTED'`,
              [module.module_code]
            );
            chunk_count = chunkResult.rows[0]?.n ?? 0;
          } catch {
            // module_chunks or module_documents may not exist
          }

          return {
            ...module,
            questions: (questionsResult.rows as Record<string, unknown>[]).map((q) => ({
              module_question_id: q.module_question_id || null,
              question_text: q.question_text || '',
              response_enum: q.response_enum || ['YES', 'NO', 'N_A'],
              question_intent: q.question_intent || null,
              asset_or_location: q.asset_or_location || null,
              event_trigger: q.event_trigger || null,
              discipline_id: q.discipline_id || null,
              discipline_subtype_id: q.discipline_subtype_id || null,
              order: q.order_index || q.question_order || 0
            })),
            question_count: questionsResult.rows.length,
            chunk_count
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[API /api/admin/modules/library] Error fetching questions for ${module.module_code}:`, msg);
          let chunk_count = 0;
          try {
            const chunkResult = await pool.query(
              `SELECT COUNT(*)::int AS n
               FROM public.module_chunks mc
               JOIN public.module_documents md ON md.id = mc.module_document_id
               WHERE md.module_code = $1 AND md.status = 'INGESTED'`,
              [module.module_code]
            );
            chunk_count = chunkResult.rows[0]?.n ?? 0;
          } catch {
            // ignore
          }
          return {
            ...module,
            questions: [],
            question_count: 0,
            chunk_count
          };
        }
      })
    );

    return NextResponse.json({
      modules,
      total: modules.length
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[API /api/admin/modules/library] Error:', error);
    console.error('[API /api/admin/modules/library] Error stack:', stack);
    return NextResponse.json(
      {
        error: 'Failed to load module library',
        message,
        details: process.env.NODE_ENV === 'development' ? stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/modules/library?module_code=MODULE_XXX
 * 
 * Soft-deletes a module by setting is_active = false.
 * Does not delete module instances or responses.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleCode = searchParams.get('module_code');

    if (!moduleCode) {
      return NextResponse.json(
        { error: 'module_code parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();
    
    // Check if module exists
    const checkResult = await pool.query(
      'SELECT module_code FROM public.assessment_modules WHERE module_code = $1',
      [moduleCode]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Module ${moduleCode} not found` },
        { status: 404 }
      );
    }

    // Soft delete
    await pool.query(
      'UPDATE public.assessment_modules SET is_active = false, updated_at = NOW() WHERE module_code = $1',
      [moduleCode]
    );

    return NextResponse.json({
      success: true,
      message: `Module ${moduleCode} deactivated successfully`
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/admin/modules/library] DELETE Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete module',
        message
      },
      { status: 500 }
    );
  }
}

