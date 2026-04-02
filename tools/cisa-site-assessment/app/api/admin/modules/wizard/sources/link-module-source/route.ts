import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

/**
 * POST /api/admin/modules/wizard/sources/link-module-source
 *
 * Links an existing module source (from any module) to the current module.
 * Creates a new module_sources row for the target module with the same sha256
 * so the document is available in both modules.
 * Body: { module_code: string; from_module_code: string; source_id: string }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { module_code, from_module_code, source_id } = body;

    if (!module_code || typeof module_code !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'module_code is required' } },
        { status: 400 }
      );
    }

    if (!source_id || typeof source_id !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_SOURCE_ID', message: 'source_id is required' } },
        { status: 400 }
      );
    }

    const targetCode = module_code.trim();
    const fromCode = (from_module_code && typeof from_module_code === 'string') ? from_module_code.trim() : null;
    const id = String(source_id).trim();

    const pool = getRuntimePool();

    const moduleCheck = await pool.query(
      'SELECT module_code FROM public.assessment_modules WHERE module_code = $1',
      [targetCode]
    );
    if ((moduleCheck.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Target module not found' } },
        { status: 404 }
      );
    }

    // Resolve source: module_sources by id (optionally scoped by from_module_code), or module_documents
    let row: { sha256: string | null; storage_relpath: string | null; source_label: string | null } | null = null;

    const msWhere = fromCode
      ? 'ms.id = $1::uuid AND ms.module_code = $2'
      : 'ms.id = $1::uuid';
    const msParams = fromCode ? [id, fromCode] : [id];

    const msResult = await pool.query(
      `SELECT ms.sha256, ms.storage_relpath, ms.source_label
       FROM public.module_sources ms
       WHERE ${msWhere}`,
      msParams
    );
    if (msResult.rows.length > 0) {
      row = msResult.rows[0] as typeof row;
    }

    if (!row && !fromCode) {
      const mdResult = await pool.query(
        `SELECT md.sha256, md.label AS source_label
         FROM public.module_documents md
         WHERE md.id = $1::uuid`,
        [id]
      );
      if (mdResult.rows.length > 0) {
        const r = mdResult.rows[0] as { sha256: string | null; source_label: string | null };
        row = { sha256: r.sha256, storage_relpath: null, source_label: r.source_label };
      }
    }

    if (!row || !row.sha256) {
      return NextResponse.json(
        { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Module source not found or has no sha256' } },
        { status: 404 }
      );
    }

    const sha256 = row.sha256;
    let storage_relpath = row.storage_relpath;
    if (!storage_relpath) {
      const blobRow = await pool.query<{ storage_relpath: string }>(
        'SELECT storage_relpath FROM public.document_blobs WHERE sha256 = $1 LIMIT 1',
        [sha256]
      );
      storage_relpath = blobRow.rows[0]?.storage_relpath ?? null;
    }

    const existing = await pool.query(
      'SELECT id FROM public.module_sources WHERE module_code = $1 AND sha256 = $2',
      [targetCode, sha256]
    );
    if ((existing.rowCount ?? 0) > 0) {
      const existingId = (existing.rows[0] as { id: string }).id;
      return NextResponse.json({
        ok: true,
        source_id: existingId,
        source_label: row.source_label ?? 'Linked document',
        sha256,
        already_linked: true
      }, { status: 200 });
    }

    const insertResult = await pool.query(
      `INSERT INTO public.module_sources (module_code, source_type, source_label, sha256, storage_relpath, fetch_status, fetched_at)
       VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, 'DOWNLOADED', now())
       RETURNING id, source_label, sha256`,
      [targetCode, row.source_label ?? 'Linked document', sha256, storage_relpath]
    );

    const inserted = insertResult.rows[0] as { id: string; source_label: string | null; sha256: string };

    return NextResponse.json({
      ok: true,
      source_id: inserted.id,
      source_label: inserted.source_label ?? 'Linked document',
      sha256: inserted.sha256
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API link-module-source]', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to link module source'
        }
      },
      { status: 500 }
    );
  }
}
