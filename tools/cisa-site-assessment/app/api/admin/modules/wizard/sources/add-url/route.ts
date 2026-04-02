import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { screenCandidateUrl } from '@/app/lib/crawler/screenCandidateUrl';

/**
 * POST /api/admin/modules/wizard/sources/add-url
 *
 * Adds a source URL to a module. URL is screened first; only PDFs that pass
 * screening are accepted. Stored source_url is the resolved final PDF URL.
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

    const { module_code, source_url, source_label } = body;

    if (!module_code || typeof module_code !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'Module code is required' } },
        { status: 400 }
      );
    }

    if (!source_url && !source_label) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_SOURCE', message: 'Either source URL or label is required' } },
        { status: 400 }
      );
    }

    let urlToStore: string | null = null;
    if (source_url && typeof source_url === 'string') {
      const screen = await screenCandidateUrl(source_url.trim(), {
        target: { kind: 'module', moduleCode: module_code },
        strictness: 'strict',
        resolveLandingToPdf: true,
      });
      if (!screen.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'URL_REJECTED',
              message: 'URL did not pass screening',
              rejectCode: screen.rejectCode,
              reasons: screen.reasons,
              canonicalUrl: screen.canonicalUrl,
            },
          },
          { status: 400 }
        );
      }
      urlToStore = screen.finalUrl;
    }

    const runtimePool = getRuntimePool();
    const client = await runtimePool.connect();

    try {
      await client.query('BEGIN');

      // Verify module exists
      const moduleCheck = await client.query(
        'SELECT module_code FROM public.assessment_modules WHERE module_code = $1',
        [module_code]
      );

      if (!moduleCheck.rowCount || moduleCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Module not found' } },
          { status: 404 }
        );
      }

      // Insert source (use screened final URL when URL was provided)
      const result = await client.query(
        `INSERT INTO public.module_sources (module_code, source_type, source_url, source_label)
         VALUES ($1, 'MODULE_UPLOAD', $2, $3)
         RETURNING id, source_url, source_label`,
        [
          module_code,
          urlToStore ?? (source_url ? String(source_url).trim() : null),
          source_label ? source_label.trim() : null
        ]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        source_id: result.rows[0].id,
        source_url: result.rows[0].source_url,
        source_label: result.rows[0].source_label
      }, { status: 201 });

    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    console.error('[API /api/admin/modules/wizard/sources/add-url] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add source',
          details: error instanceof Error ? error.message : undefined
        }
      },
      { status: 500 }
    );
  }
}

