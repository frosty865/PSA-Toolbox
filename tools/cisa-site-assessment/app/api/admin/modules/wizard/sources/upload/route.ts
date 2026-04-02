import { NextResponse } from 'next/server';
import { randomUUID, createHash } from 'crypto';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getModuleSourcesRoot } from '@/app/lib/storage/config';
import { getPdfFilenameFromTitle } from '@/app/lib/pdfExtractTitle';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * POST /api/admin/modules/wizard/sources/upload
 *
 * Uploads a PDF file for a module source. Renames file to document title
 * scraped from within the PDF when available.
 * Stores file to single library: storage/module_sources/incoming/
 * (no per-module folders; sources are categorized when choosing sources for a module).
 * Returns standardized error format.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const module_code = formData.get('module_code') as string | null;

    if (!module_code) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'Module code is required' } },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_FILE', message: 'File is required' } },
        { status: 400 }
      );
    }

    // Verify module exists
    const runtimePool = getRuntimePool();
    const moduleCheck = await runtimePool.query(
      'SELECT module_code FROM public.assessment_modules WHERE module_code = $1',
      [module_code]
    );

    if (!moduleCheck.rowCount || moduleCheck.rowCount === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Module not found' } },
        { status: 404 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const originalName = file.name || 'document.pdf';
    const titleStem = await getPdfFilenameFromTitle(buffer);
    const uniq = randomUUID().slice(0, 8);
    const baseName = titleStem ? titleStem.replace(/[/\\:*?"<>|]/g, '_').trim().slice(0, 180) : originalName.replace(/\.pdf$/i, '');
    const filename = `${baseName}_${uniq}.pdf`;
    const sourceLabel = titleStem || originalName.replace(/\.pdf$/i, '');

    const moduleRoot = getModuleSourcesRoot();
    const uploadDir = join(moduleRoot, 'incoming');
    await mkdir(uploadDir, { recursive: true });

    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const storage_relpath = `incoming/${filename}`;
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const content_type = 'application/pdf';
    const fetch_status = 'PENDING';

    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO public.module_sources (module_code, source_type, source_label, file_path, storage_relpath, sha256, content_type, fetch_status, fetched_at)
         VALUES ($1, 'MODULE_UPLOAD', $2, $3, $4, $5, $6, $7, now())
         RETURNING id, source_label, storage_relpath`,
        [module_code, sourceLabel, storage_relpath, storage_relpath, sha256, content_type, fetch_status]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        source_id: result.rows[0].id,
        source_label: result.rows[0].source_label,
        upload_path: result.rows[0].storage_relpath
      }, { status: 201 });

    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    console.error('[API /api/admin/modules/wizard/sources/upload] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to upload file',
          details: error instanceof Error ? error.message : undefined
        }
      },
      { status: 500 }
    );
  }
}

