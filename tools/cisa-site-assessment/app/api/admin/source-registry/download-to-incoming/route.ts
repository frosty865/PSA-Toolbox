import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { getModuleSourcesRoot } from '@/app/lib/storage/config';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';
import { screenCandidateUrl } from '@/app/lib/crawler/screenCandidateUrl';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/source-registry/download-to-incoming
 * Download a file from URL and save it to single library incoming folder.
 * URL is screened first; only PDFs that pass screening are downloaded.
 *
 * Body: { url, filename?, module_code? }
 * - module_code: Optional (for metadata). Downloads to MODULE_SOURCES_ROOT/incoming/ (single library; no per-module folders).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, filename, module_code } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'url is required (string)' },
        { status: 400 }
      );
    }

    const moduleCodeForMeta = (module_code && typeof module_code === 'string') ? module_code : null;

    // If module_code provided, validate module exists (optional; for metadata only)
    if (moduleCodeForMeta) {
      const runtimePool = await ensureRuntimePoolConnected();
      const modCheck = await runtimePool.query(
        'SELECT 1 FROM public.assessment_modules WHERE module_code = $1',
        [moduleCodeForMeta]
      );
      if (modCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Module not found', module_code: moduleCodeForMeta },
          { status: 404 }
        );
      }
    }

    const screen = await screenCandidateUrl(url, {
      target: moduleCodeForMeta ? { kind: 'module', moduleCode: moduleCodeForMeta } : { kind: 'corpus' },
      strictness: 'strict',
      resolveLandingToPdf: true,
    });
    if (!screen.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'URL did not pass screening',
          rejectCode: screen.rejectCode,
          reasons: screen.reasons,
          canonicalUrl: screen.canonicalUrl,
          screening: { strictness: 'strict', target: moduleCodeForMeta ? { kind: 'module', moduleCode: moduleCodeForMeta } : { kind: 'corpus' }, acceptedCount: 0, rejectedByCode: { [screen.rejectCode ?? 'VERIFY_FAILED']: 1 } },
        },
        { status: 400 }
      );
    }

    const urlToDownload = screen.finalUrl;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlToDownload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format after screening' },
        { status: 400 }
      );
    }

    // Single library: no per-module folders
    const moduleRoot = getModuleSourcesRoot();
    const incomingDir = path.join(moduleRoot, 'incoming');
    await fs.mkdir(incomingDir, { recursive: true });

    // Determine filename (unique to avoid overwrites in single incoming)
    let baseFilename: string;
    if (filename && typeof filename === 'string') {
      baseFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    } else {
      const urlPath = parsedUrl.pathname;
      const urlFilename = path.basename(urlPath) || 'downloaded.pdf';
      baseFilename = urlFilename.endsWith('.pdf') ? urlFilename : `${urlFilename}.pdf`;
    }
    const { randomUUID } = await import('crypto');
    const uniq = randomUUID().slice(0, 8);
    const stem = baseFilename.replace(/\.pdf$/i, '');
    const targetFilename = `${stem}_${uniq}.pdf`;
    const targetPath = path.join(incomingDir, targetFilename);

    // Check if file already exists
    if (existsSync(targetPath)) {
      return NextResponse.json(
        { 
          error: 'File already exists',
          path: targetPath,
          message: `File already exists at: ${targetPath}. Delete it first or use a different filename.`
        },
        { status: 409 }
      );
    }

    // Download file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(urlToDownload, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to download file: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json(
          { error: 'URL does not appear to be a PDF file. Only PDF files are supported.' },
          { status: 400 }
        );
      }

      // Check file size (100MB max)
      const contentLength = response.headers.get('content-length');
      const maxSizeMB = 100;
      if (contentLength) {
        const sizeMB = parseInt(contentLength, 10) / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
          return NextResponse.json(
            { error: `File too large: ${sizeMB.toFixed(2)}MB (max 100MB)` },
            { status: 400 }
          );
        }
      }

      // Download and save file
      const buffer = await response.arrayBuffer();
      const sizeMB = buffer.byteLength / (1024 * 1024);

      if (sizeMB > maxSizeMB) {
        return NextResponse.json(
          { error: `File too large: ${sizeMB.toFixed(2)}MB (max 100MB)` },
          { status: 400 }
        );
      }

      await fs.writeFile(targetPath, Buffer.from(buffer));

      return NextResponse.json({
        success: true,
        path: targetPath,
        filename: targetFilename,
        module_code: moduleCodeForMeta,
        size: buffer.byteLength,
        sizeMB: sizeMB.toFixed(2),
        message: `File downloaded successfully to library incoming: ${targetPath}`,
        screening: { strictness: 'strict', target: moduleCodeForMeta ? { kind: 'module', moduleCode: moduleCodeForMeta } : { kind: 'corpus' }, acceptedCount: 1, finalUrl: urlToDownload },
      });

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: 'Download timeout - file took too long to download' },
          { status: 408 }
        );
      }

      throw error;
    }

  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/download-to-incoming POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to download file',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

