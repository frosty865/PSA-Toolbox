/**
 * POST /api/admin/module-sources/backfill-publishers
 *
 * Backfills module_sources.publisher from PDF content (scrape_source_metadata_from_content).
 * Only updates rows where publisher IS NULL and a file can be resolved (storage_relpath or document_blobs).
 * Optional body: { limit?: number } to cap how many to process.
 */

import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getModuleSourcesRoot } from '@/app/lib/storage/config';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';

const SCRIPT = 'tools/corpus/backfill_module_source_publishers.py';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === 'number' ? body.limit : undefined;

    const pool = getRuntimePool();
    const root = getModuleSourcesRoot();

    const rows = await pool.query<{
      id: string;
      module_code: string;
      storage_relpath: string | null;
      sha256: string | null;
      document_blob_relpath: string | null;
    }>(
      `SELECT ms.id, ms.module_code, ms.storage_relpath, ms.sha256, db.storage_relpath AS document_blob_relpath
       FROM public.module_sources ms
       LEFT JOIN public.document_blobs db ON db.sha256 = ms.sha256
       WHERE ms.source_type = 'MODULE_UPLOAD'
         AND (ms.publisher IS NULL OR ms.publisher = '')
         AND (ms.storage_relpath IS NOT NULL OR ms.sha256 IS NOT NULL)
       ORDER BY ms.created_at
       LIMIT $1`,
      [limit ?? 1000]
    );

    const toUpdate: { id: string; absPath: string }[] = [];
    for (const r of rows.rows || []) {
      const relpath = r.document_blob_relpath || r.storage_relpath;
      if (!relpath) continue;
      const absPath = path.join(root, relpath.replace(/\\/g, '/'));
      if (existsSync(absPath)) toUpdate.push({ id: r.id, absPath });
    }

    if (toUpdate.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        total: rows.rows?.length ?? 0,
        message: 'No module sources with missing publisher and resolvable file.',
      });
    }

    const cwd = process.cwd();
    const env = { ...process.env, PYTHONPATH: cwd, RUNTIME_DATABASE_URL: process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL };
    const scriptPath = path.join(cwd, SCRIPT);
    const { existsSync: fsExists } = await import('fs');
    if (!fsExists(scriptPath)) {
      return NextResponse.json(
        { error: 'BACKFILL_SCRIPT_MISSING', message: `Script not found: ${SCRIPT}. Run backfill manually.` },
        { status: 503 }
      );
    }

    return new Promise<NextResponse>((resolve) => {
      const proc = spawn(
        'python',
        [SCRIPT, '--limit', String(toUpdate.length)],
        { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d) => { stdout += d; });
      proc.stderr?.on('data', (d) => { stderr += d; });
      proc.on('close', (code) => {
        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: 'BACKFILL_FAILED', message: stderr || stdout || `Exit ${code}` },
              { status: 500 }
            )
          );
          return;
        }
        const match = stdout.match(/Updated:\s*(\d+)/);
        const updated = match ? parseInt(match[1], 10) : 0;
        resolve(
          NextResponse.json({
            ok: true,
            updated,
            total: toUpdate.length,
            message: `Backfilled publisher for ${updated} module source(s).`,
          })
        );
      });
    });
  } catch (e: unknown) {
    console.error('[backfill-publishers]', e);
    return NextResponse.json(
      { error: 'BACKFILL_ERROR', message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
