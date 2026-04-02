/**
 * GET /api/admin/source-registry/[sourceKey]/file
 *
 * Serves the local file for a corpus source (storage_relpath or local_path under CORPUS_SOURCES_ROOT).
 * Returns 404 if source has no file on disk.
 */

import { NextResponse } from 'next/server';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { resolveCorpusPath, getCorpusSourcesRoot } from '@/app/lib/storage/config';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function isUnderRoot(rootAbs: string, candidateAbs: string): boolean {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) ? true : rel === '';
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sourceKey: string }> }
) {
  try {
    const { sourceKey } = await ctx.params;
    const key = decodeURIComponent(sourceKey).trim();
    if (!key) {
      return NextResponse.json({ error: 'Missing source key' }, { status: 400 });
    }

    const pool = getCorpusPoolForAdmin();
    const row = await pool.query<{ storage_relpath: string | null; local_path: string | null; title: string | null }>(
      `SELECT storage_relpath, local_path, title FROM public.source_registry WHERE source_key = $1`,
      [key]
    );
    if (row.rows.length === 0) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    const sr = row.rows[0];
    const root = getCorpusSourcesRoot();
    let absPath: string | null = null;

    if (sr.storage_relpath) {
      try {
        absPath = resolveCorpusPath(sr.storage_relpath);
      } catch {
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
      }
    } else if (sr.local_path) {
      const local = sr.local_path.replace(/\\/g, '/');
      if (path.isAbsolute(local)) {
        if (!isUnderRoot(root, local)) {
          return NextResponse.json({ error: 'Local path outside corpus root' }, { status: 400 });
        }
        absPath = local;
      } else {
        try {
          absPath = resolveCorpusPath(local);
        } catch {
          return NextResponse.json({ error: 'Invalid local path' }, { status: 400 });
        }
      }
    }

    if (!absPath || !existsSync(absPath)) {
      return NextResponse.json(
        { error: 'No local file for this source' },
        { status: 404 }
      );
    }

    const buf = await readFile(absPath);
    const ext = path.extname(absPath).toLowerCase().slice(1) || '';
    const contentType =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'txt'
          ? 'text/plain'
          : 'application/octet-stream';
    const filename =
      (sr.title || key).replace(/[^a-zA-Z0-9._-]/g, '_') +
      (ext ? `.${ext}` : '');

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    console.error('[API GET source-registry file]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to serve file' },
      { status: 500 }
    );
  }
}
