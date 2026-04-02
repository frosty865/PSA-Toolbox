/**
 * Extract document title from a PDF buffer (metadata or first pages).
 * Used to rename uploaded PDFs to the document title only.
 */

import { existsSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { findPythonExecutable } from '@/app/lib/python/venv';
import { normalizePublisherName, isUnacceptablePublisher } from '@/app/lib/sourceRegistry/publisherNormalizer';
import { isUnacceptableTitle } from '@/app/lib/sourceRegistry/schema';

const SCRIPT_NAME = 'extract_pdf_metadata.py';

/**
 * Sanitize a string for use as a filename (no extension).
 * Replaces invalid chars, trims, limits length.
 */
export function sanitizePdfFilename(title: string): string {
  if (!title || typeof title !== 'string') return '';
  let s = title
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 180) s = s.slice(0, 180).trim();
  return s || '';
}

/**
 * Extract title from PDF buffer using Python citation extractor.
 * Returns the document title (inferred or from metadata), or null on failure.
 */
export async function extractPdfTitleFromBuffer(buffer: Buffer): Promise<string | null> {
  const pythonCmd = findPythonExecutable('processor');
  if (!pythonCmd) return null;

  const scriptPath = join(process.cwd(), 'tools', SCRIPT_NAME);
  const tempPath = join(tmpdir(), `psa-title-${randomUUID()}.pdf`);

  try {
    await writeFile(tempPath, buffer);

    const title = await new Promise<string | null>((resolve) => {
      const proc = spawn(pythonCmd, [scriptPath, tempPath], {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env },
        shell: false,
      });

      let stdout = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', () => {});

      proc.on('close', (code: number) => {
        if (code !== 0) {
          resolve(null);
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          const t = result.inferred_title || result.pdf_meta_title;
          resolve(t && typeof t === 'string' ? t.trim() : null);
        } catch {
          resolve(null);
        }
      });

      proc.on('error', () => resolve(null));
    });

    return title || null;
  } catch {
    return null;
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Extract title and publisher from PDF buffer using Python citation extractor.
 * Runs the script once; returns { title, publisher } (e.g. publisher: "CISA", "FEMA", "ISC").
 */
export async function extractPdfMetadataFromBuffer(buffer: Buffer): Promise<{
  title: string | null;
  publisher: string | null;
  citation_short: string | null;
  citation_full: string | null;
}> {
  const pythonCmd = findPythonExecutable('processor');
  if (!pythonCmd) return { title: null, publisher: null, citation_short: null, citation_full: null };

  const scriptPath = join(process.cwd(), 'tools', SCRIPT_NAME);
  const tempPath = join(tmpdir(), `psa-meta-${randomUUID()}.pdf`);

  try {
    await writeFile(tempPath, buffer);
    const result = await new Promise<{
      inferred_title?: string;
      pdf_meta_title?: string;
      publisher?: string;
      citation_short?: string;
      citation_full?: string;
    } | null>((resolve) => {
      const proc = spawn(pythonCmd, [scriptPath, tempPath], {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env },
        shell: false,
      });
      let stdout = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', () => {});
      proc.on('close', (code: number) => {
        if (code !== 0) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed && typeof parsed === 'object' ? parsed : null);
        } catch {
          resolve(null);
        }
      });
      proc.on('error', () => resolve(null));
    });
    const rawTitle = result?.inferred_title ?? result?.pdf_meta_title;
    const title = rawTitle && typeof rawTitle === 'string' ? rawTitle.trim() || null : null;
    const rawPublisher =
      result?.publisher && typeof result.publisher === 'string' ? result.publisher.trim() || null : null;
    const publisher = rawPublisher
      ? (normalizePublisherName(rawPublisher) ?? rawPublisher)
      : null;
    const citation_short =
      result?.citation_short && typeof result.citation_short === 'string'
        ? result.citation_short.trim() || null
        : null;
    const citation_full =
      result?.citation_full && typeof result.citation_full === 'string'
        ? result.citation_full.trim() || null
        : null;
    return {
      title: title || null,
      publisher: publisher || null,
      citation_short: citation_short || null,
      citation_full: citation_full || null,
    };
  } catch {
    return { title: null, publisher: null, citation_short: null, citation_full: null };
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Extract title and publisher from a PDF file path (content-only; file name is NEVER used).
 * Used for ingestion/triage. When extraction fails or returns empty, returns placeholder strings
 * rather than deriving from filename.
 */
export async function extractPdfMetadataFromPath(filePath: string): Promise<{
  title: string;
  publisher: string;
  citation_short?: string | null;
  citation_full?: string | null;
}> {
  const pythonCmd = findPythonExecutable('processor');
  const scriptPath = join(process.cwd(), 'tools', SCRIPT_NAME);
  const placeholderTitle = 'Unknown';
  const placeholderPublisher = '—';

  if (!pythonCmd || !existsSync(scriptPath) || !existsSync(filePath)) {
    return { title: placeholderTitle, publisher: placeholderPublisher };
  }

  const result = await new Promise<{
    inferred_title?: string;
    publisher?: string;
    citation_short?: string;
    citation_full?: string;
  } | null>((resolve) => {
    const proc = spawn(pythonCmd, [scriptPath, filePath], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env },
      shell: false,
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on('data', () => {});
    proc.on('close', (code: number) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed && typeof parsed === 'object' ? parsed : null);
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });

  let title =
    result?.inferred_title && typeof result.inferred_title === 'string'
      ? result.inferred_title.trim()
      : '';
  let publisher =
    result?.publisher && typeof result.publisher === 'string'
      ? result.publisher.trim()
      : '';
  if (!title || isUnacceptableTitle(title)) title = placeholderTitle;
  if (!publisher || isUnacceptablePublisher(publisher))
    publisher = normalizePublisherName(publisher) ?? placeholderPublisher;
  return {
    title,
    publisher,
    citation_short: result?.citation_short ?? null,
    citation_full: result?.citation_full ?? null,
  };
}

/**
 * Get a safe filename (stem only) for an uploaded PDF from its buffer.
 * Uses document title scraped from the PDF when available; otherwise returns null
 * so the caller can use the original filename.
 */
export async function getPdfFilenameFromTitle(buffer: Buffer): Promise<string | null> {
  const title = await extractPdfTitleFromBuffer(buffer);
  if (!title) return null;
  const sanitized = sanitizePdfFilename(title);
  return sanitized || null;
}
