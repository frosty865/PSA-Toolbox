import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

/**
 * POST /api/admin/modules/wizard/sources/add-existing
 * 
 * Adds an existing source from source_registry (CORPUS) to a module.
 * Creates a CORPUS_POINTER source in module_sources.
 * Returns standardized error format.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { module_code, corpus_source_id } = body;

    if (!module_code || typeof module_code !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'Module code is required' } },
        { status: 400 }
      );
    }

    if (!corpus_source_id || typeof corpus_source_id !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_SOURCE_ID', message: 'Corpus source ID is required' } },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();
    const client = await runtimePool.connect();

    try {
      await client.query('BEGIN');

      // Verify module exists
      const moduleCheck = await client.query(
        'SELECT module_code FROM public.assessment_modules WHERE module_code = $1',
        [module_code]
      );

      if ((moduleCheck.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Module not found' } },
          { status: 404 }
        );
      }

      // Verify source exists in CORPUS source_registry
      const sourceCheck = await corpusPool.query(
        'SELECT id, title, publisher FROM public.source_registry WHERE id = $1',
        [corpus_source_id]
      );

      if ((sourceCheck.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Source not found in registry' } },
          { status: 404 }
        );
      }

      const sourceInfo = sourceCheck.rows[0];

      // Check if already added
      const existingCheck = await client.query(
        'SELECT id FROM public.module_sources WHERE module_code = $1 AND corpus_source_id = $2',
        [module_code, corpus_source_id]
      );
      const existingCount = existingCheck.rowCount ?? 0;

      if (existingCount > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: { code: 'SOURCE_ALREADY_ADDED', message: 'Source already added to this module' } },
          { status: 400 }
        );
      }

      // Insert CORPUS_POINTER source
      const result = await client.query(
        `INSERT INTO public.module_sources (module_code, source_type, corpus_source_id, source_label)
         VALUES ($1, 'CORPUS_POINTER', $2, $3)
         RETURNING id, source_label, corpus_source_id`,
        [
          module_code,
          corpus_source_id,
          sourceInfo.title || sourceInfo.publisher || 'Imported Source'
        ]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        source_id: result.rows[0].id,
        source_label: result.rows[0].source_label,
        corpus_source_id: result.rows[0].corpus_source_id
      }, { status: 201 });

    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    console.error('[API /api/admin/modules/wizard/sources/add-existing] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add existing source',
          details: error instanceof Error ? error.message : undefined
        }
      },
      { status: 500 }
    );
  }
}

