import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import * as path from 'path';
import { normalizePublisherName } from '@/app/lib/sourceRegistry/publisherNormalizer';
import { findPythonExecutable as findPSAPython } from '@/app/lib/python/venv';
import { verifyPdfBuffer } from '@/app/lib/crawler/pdfVerify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Find Python executable
 * Uses PSA System venv (processor service) or falls back to system Python
 */
function findPythonExecutable(): string | null {
  // Use processor venv for PDF metadata extraction
  return findPSAPython('processor');
}

/**
 * POST /api/admin/source-registry/extract-pdf-metadata
 * Extract metadata from a PDF file
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Save file to temporary location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!verifyPdfBuffer(buffer)) {
      return NextResponse.json(
        { error: 'File is not a valid PDF (missing %PDF- signature)' },
        { status: 400 }
      );
    }

    tempFilePath = join(tmpdir(), `psa-metadata-${randomUUID()}.pdf`);
    await writeFile(tempFilePath, buffer);

    // Find Python executable
    const pythonCmd = findPythonExecutable();
    if (!pythonCmd) {
      return NextResponse.json(
        { error: 'Python executable not found' },
        { status: 500 }
      );
    }

    // TypeScript guard: tempFilePath is guaranteed to be set at this point (assigned above)
    if (!tempFilePath) {
      return NextResponse.json(
        { error: 'Failed to create temporary file' },
        { status: 500 }
      );
    }

    // Run Python script to extract metadata
    const scriptPath = path.join(process.cwd(), 'tools', 'extract_pdf_metadata.py');
    
    // At this point, both pythonCmd and tempFilePath are guaranteed to be non-null
    const finalPythonCmd: string = pythonCmd;
    const finalTempFilePath: string = tempFilePath;
    
    return new Promise<NextResponse>((resolve) => {
      const pythonProcess = spawn(finalPythonCmd, [scriptPath, finalTempFilePath], {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env },
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        // Clean up temp file
        import('fs/promises').then(fs => {
          fs.unlink(finalTempFilePath).catch(() => {});
        });

        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            // Normalize publisher name if present
            const rawPublisher = result.publisher || null;
            const normalizedPublisher = rawPublisher ? normalizePublisherName(rawPublisher) : null;

            resolve(NextResponse.json({
              success: true,
              metadata: {
                title: result.inferred_title || result.pdf_meta_title || null,
                publisher: normalizedPublisher || rawPublisher || null,
                year: result.publication_date ? new Date(result.publication_date).getFullYear() : null,
                description: null,
                citation_short: result.citation_short || null,
                citation_full: result.citation_full || null,
              }
            }));
          } catch {
            resolve(NextResponse.json(
              { error: 'Failed to parse metadata output', details: stdout.substring(0, 500) },
              { status: 500 }
            ));
          }
        } else {
          resolve(NextResponse.json(
            { error: 'Failed to extract metadata', details: stderr || stdout },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', (err: Error) => {
        import('fs/promises').then(fs => {
          fs.unlink(finalTempFilePath).catch(() => {});
        });
        resolve(NextResponse.json(
          { error: 'Failed to run metadata extraction', details: err.message },
          { status: 500 }
        ));
      });
    });
  } catch (error: unknown) {
    if (tempFilePath) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    return NextResponse.json(
      {
        error: 'Failed to extract PDF metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

