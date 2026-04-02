import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { getCorpusSourcesRoot } from '@/app/lib/storage/config';
import { assertSourceRegistryId } from '@/app/lib/sourceRegistry/guards';
import { tierFromPublisher } from '@/app/lib/sourceRegistry/tierFromPublisher';

export interface IngestionResult {
  success: boolean;
  documentId?: string;
  docSha256?: string;
  localPath?: string;
  chunksCount?: number;
  /** Publication date from extracted PDF metadata (YYYY-MM-DD). Set on source_registry after ingest so it is correct the first time. */
  publicationDate?: string | null;
  error?: string;
}

/**
 * Download a file from URL to temporary location
 */
async function downloadFile(url: string, maxSizeMB: number = 100): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength, 10) / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        throw new Error(`File too large: ${sizeMB.toFixed(2)}MB (max ${maxSizeMB}MB)`);
      }
    }

    // Determine file extension from URL or Content-Type
    const contentType = response.headers.get('content-type') || '';
    let ext = '.pdf';
    if (url.toLowerCase().endsWith('.pdf')) {
      ext = '.pdf';
    } else if (contentType.includes('pdf') || contentType.includes('application/pdf')) {
      ext = '.pdf';
    } else if (url.toLowerCase().endsWith('.html') || url.toLowerCase().endsWith('.htm')) {
      ext = '.html';
    } else if (contentType.includes('html')) {
      ext = '.html';
    }
    
    // Only support PDF for now (ingestion script only handles PDFs)
    if (ext !== '.pdf') {
      throw new Error(`Unsupported file type: ${contentType || 'unknown'}. Only PDF files are supported.`);
    }

    // Create temporary file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `psa-ingest-${Date.now()}${ext}`);
    
    // Stream download with size check
    const buffer = await response.arrayBuffer();
    const sizeMB = buffer.byteLength / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      throw new Error(`File too large: ${sizeMB.toFixed(2)}MB (max ${maxSizeMB}MB)`);
    }
    
    await fs.writeFile(tempFile, Buffer.from(buffer));

    return tempFile;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Download timeout - file took too long to download');
    }
    throw error;
  }
}

/**
 * Find Python executable
 * Uses PSA System venv (processor service) or falls back to system Python
 */
function findPythonExecutable(): string | null {
  // Sync loader for optional python venv (eslint-disable: no dynamic import equivalent for sync return)
  const { findPythonExecutable: findPSAPython } = require('@/app/lib/python/venv') as { findPythonExecutable: (name: string) => string | null }; // eslint-disable-line @typescript-eslint/no-require-imports
  return findPSAPython('processor');
}

/**
 * Resolve path to corpus_ingest_pdf.py so ingestion works from repo root or psa_rebuild.
 * Tries cwd/tools then cwd/psa_rebuild/tools. Returns first path that exists.
 */
async function resolveIngestScriptPath(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'tools', 'corpus_ingest_pdf.py'),
    path.join(cwd, 'psa_rebuild', 'tools', 'corpus_ingest_pdf.py'),
  ];
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      continue;
    }
  }
  return candidates[0];
}

/**
 * Ingest a document from a local file path using Python script
 * Exported for use in upload endpoint
 */
export async function ingestDocumentFromFile(
  filePath: string,
  sourceName: string,
  title: string,
  publishedAt?: string | null,
  authorityScope: string = 'BASELINE_AUTHORITY',
  sourceRegistryId?: string | null
): Promise<IngestionResult> {
  const scriptPath = await resolveIngestScriptPath();
  const scriptCwd = path.dirname(path.dirname(scriptPath));

  try {
    await fs.access(scriptPath);
  } catch {
    return {
      success: false,
      error: `Ingestion script not found at ${scriptPath}. Run from psa_rebuild or ensure tools/corpus_ingest_pdf.py exists.`,
    };
  }

  return new Promise((resolve) => {
    // Check if file is PDF (script only handles PDFs)
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      resolve({
        success: false,
        error: 'Only PDF files are supported for ingestion',
      });
      return;
    }
    
    // GUARDRAIL: Refuse to create corpus_documents without source_registry_id
    if (!sourceRegistryId || sourceRegistryId.trim() === '') {
      resolve({
        success: false,
        error: 'Refusing to create corpus_documents without source_registry_id. All documents must be linked to Source Registry.',
      });
      return;
    }
    
    // Build arguments array - each element becomes a separate argument
    // Important: Don't quote or escape - spawn handles this automatically
    const args = [
      scriptPath,
      '--pdf_path', filePath,
      '--source_name', sourceName,
      '--title', title, // Title as single string argument (spaces are fine)
      '--authority_scope', authorityScope,
      '--source_registry_id', sourceRegistryId, // Always required now
    ];

    console.log(`[Ingestion] Passing source_registry_id: ${sourceRegistryId}`);

    if (publishedAt) {
      // Ensure date is in ISO format (YYYY-MM-DD)
      let isoDate: string | null = null;
      
      if (typeof publishedAt === 'string') {
        // Check if already in ISO format
        if (publishedAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
          isoDate = publishedAt;
        } else {
          // Try to parse and reformat
          try {
            const date = new Date(publishedAt);
            if (!isNaN(date.getTime())) {
              isoDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            }
          } catch {
            console.warn(`[Ingestion] Failed to parse date: ${publishedAt}`);
          }
        }
      }
      
      if (isoDate) {
        args.push('--published_at', isoDate);
      } else {
        console.warn(`[Ingestion] Invalid or missing date format: ${publishedAt}, skipping --published_at`);
      }
    }

    // Find Python executable
    const pythonCmd = findPythonExecutable();
    if (!pythonCmd) {
      resolve({
        success: false,
        error: 'Python executable not found. Please ensure Python is installed and available in PATH, or use a virtual environment.',
      });
      return;
    }
    
    // On Windows with shell: true, we need to be careful with arguments
    // Use shell: false to ensure proper argument handling, or properly escape if shell: true
    const useShell = false; // Don't use shell to avoid argument parsing issues
    
    const pythonProcess = spawn(pythonCmd, args, {
      cwd: scriptCwd,
      stdio: 'pipe',
      env: { ...process.env },
      shell: useShell,
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
      if (code === 0) {
        try {
          // Parse JSON output from script
          // The script outputs JSON followed by success messages
          const lines = stdout.split('\n');
          let jsonLine: string | undefined;
          
          // Find the first line that looks like JSON (starts with {)
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              jsonLine = trimmed;
              break;
            }
          }
          
          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            const pubDate = result.publication_date ?? null;
            resolve({
              success: true,
              documentId: result.document_id,
              docSha256: result.content_hash,
              chunksCount: result.chunks_count,
              publicationDate: typeof pubDate === 'string' ? pubDate : null,
            });
          } else {
            // If no JSON found, check if there's useful info in stdout
            const hasSuccess = stdout.toLowerCase().includes('document ingested') || 
                              stdout.toLowerCase().includes('success');
            resolve({
              success: hasSuccess,
              error: hasSuccess ? undefined : 'Could not parse ingestion result from script output',
            });
          }
        } catch (parseError) {
          resolve({
            success: false,
            error: `Failed to parse ingestion output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Output: ${stdout.substring(0, 500)}`,
          });
        }
      } else {
        resolve({
          success: false,
          error: `Ingestion script failed with exit code ${code}. ${stderr || stdout}`,
        });
      }
    });

    pythonProcess.on('error', (err: Error) => {
      resolve({
        success: false,
        error: `Failed to spawn ingestion process: ${err.message}`,
      });
    });
  });
}

/**
 * Ingest a document from URL
 * Downloads the file, ingests it, and returns results
 */
export async function ingestDocumentFromUrl(
  url: string,
  sourceName: string,
  title: string,
  publishedAt?: string | null,
  authorityScope: string = 'BASELINE_AUTHORITY',
  sourceRegistryId?: string | null
): Promise<IngestionResult> {
  let tempFilePath: string | null = null;

  try {
    // Download file to temporary location
    tempFilePath = await downloadFile(url);

    // Ingest the document
    const result = await ingestDocumentFromFile(
      tempFilePath,
      sourceName,
      title,
      publishedAt,
      authorityScope,
      sourceRegistryId
    );

    // If successful, set localPath to the temp file (or we could move it to a permanent location)
    if (result.success) {
      result.localPath = tempFilePath;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during ingestion',
    };
  } finally {
    // Clean up temporary file after a delay (to allow ingestion to complete)
    // Note: The ingestion script may need the file, so we clean up after a short delay
    if (tempFilePath) {
      setTimeout(async () => {
        try {
          await fs.unlink(tempFilePath!);
        } catch (unlinkError) {
          // Ignore cleanup errors
          console.warn(`[Ingestion] Failed to cleanup temp file ${tempFilePath}:`, unlinkError);
        }
      }, 5000); // 5 second delay
    }
  }
}

/**
 * Update source_registry entry with ingestion results.
 * Always sets ingestion_stream='CORPUS'. Sets storage_relpath when localPath
 * is under CORPUS_SOURCES_ROOT (path relative to root).
 */
export async function updateSourceRegistryWithIngestion(
  sourceKey: string,
  ingestionResult: IngestionResult
): Promise<void> {
  if (!ingestionResult.success) {
    return; // Don't update if ingestion failed
  }

  const pool = getCorpusPoolForAdmin();
  const corpusRoot = path.resolve(getCorpusSourcesRoot());

  const updates: string[] = ["ingestion_stream = 'CORPUS'"];
  const params: string[] = [];
  let paramIndex = 1;

  if (ingestionResult.docSha256) {
    updates.push(`doc_sha256 = $${paramIndex}`);
    params.push(ingestionResult.docSha256);
    paramIndex++;
  }

  if (ingestionResult.localPath) {
    updates.push(`local_path = $${paramIndex}`);
    params.push(ingestionResult.localPath);
    paramIndex++;
    const resolved = path.resolve(ingestionResult.localPath);
    if (resolved.startsWith(corpusRoot)) {
      const rel = path.relative(corpusRoot, resolved);
      if (rel && !rel.startsWith("..")) {
        updates.push(`storage_relpath = $${paramIndex}`);
        params.push(rel);
        paramIndex++;
      }
    }
  }

  updates.push(`retrieved_at = $${paramIndex}`);
  params.push(new Date().toISOString());
  paramIndex++;

  if (ingestionResult.publicationDate) {
    const isoDate = ingestionResult.publicationDate.match(/^\d{4}-\d{2}-\d{2}$/)
      ? ingestionResult.publicationDate
      : null;
    if (isoDate) {
      updates.push(`publication_date = $${paramIndex}`);
      params.push(isoDate);
      paramIndex++;
    }
  }

  params.push(sourceKey);

  await pool.query(
    `UPDATE public.source_registry 
     SET ${updates.join(", ")}, updated_at = now()
     WHERE source_key = $${paramIndex}`,
    params
  );

  // Recursively fix all sources with null publication_date from linked corpus_documents
  await pool.query(`
    WITH first_doc_date AS (
      SELECT DISTINCT ON (source_registry_id) source_registry_id, publication_date
      FROM public.corpus_documents
      WHERE source_registry_id IS NOT NULL AND publication_date IS NOT NULL
      ORDER BY source_registry_id, publication_date
    )
    UPDATE public.source_registry sr
    SET publication_date = f.publication_date, updated_at = now()
    FROM first_doc_date f
    WHERE sr.id = f.source_registry_id AND sr.publication_date IS NULL
  `);
}

/**
 * Map authority_tier enum to authority scope string for ingestion
 */
export function mapAuthorityTierToScope(authorityTier: string): string {
  const tierMap: Record<string, string> = {
    'BASELINE_AUTHORITY': 'BASELINE_AUTHORITY',
    'SECTOR_AUTHORITY': 'SECTOR_AUTHORITY',
    'SUBSECTOR_AUTHORITY': 'SUBSECTOR_AUTHORITY',
  };
  return tierMap[authorityTier] || 'BASELINE_AUTHORITY';
}

/**
 * Compute SHA256 hash of a file
 */
async function sha256File(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Create or get Source Registry record for a local file.
 * Deterministic: same file (sha256 + absolute path) -> same Source Registry record.
 * 
 * @param absolutePath - Absolute path to the file
 * @param sha256 - SHA256 hash of the file (computed if not provided)
 * @param tags - Optional tags/metadata to store (e.g., { module: 'MODULE_X' })
 * @param triageRule - Optional triage rule that led to this file
 * @returns source_registry_id (UUID)
 */
export async function createOrGetSourceRegistryForLocalFile(
  absolutePath: string,
  sha256?: string,
  tags?: Record<string, unknown>,
  triageRule?: string
): Promise<string> {
  const pool = getCorpusPoolForAdmin();
  
  // Compute SHA256 if not provided
  const fileHash = sha256 || await sha256File(absolutePath);
  
  // Check if Source Registry record already exists by sha256 or absolute path
  const existingCheck = await pool.query(
    `SELECT id, source_key, doc_sha256, local_path 
     FROM public.source_registry 
     WHERE doc_sha256 = $1 OR local_path = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [fileHash, absolutePath]
  );
  
  if (existingCheck.rows.length > 0) {
    const existing = existingCheck.rows[0];
    console.log(`[SourceRegistry] Found existing record: ${existing.source_key} (id: ${existing.id})`);
    return existing.id;
  }
  
  // Create new Source Registry record; every document has a title and publisher — parse until found
  const pathParts = path.parse(absolutePath);
  const sourceKey = `local:${pathParts.name}:${fileHash.substring(0, 8)}`;

  const { extractPdfMetadataFromPath } = await import('@/app/lib/pdfExtractTitle');
  const { title: parsedTitle, publisher: parsedPublisher } = await extractPdfMetadataFromPath(absolutePath);
  
  // Build notes JSONB with tags and triage info
  const notes: Record<string, unknown> = {
    source: 'local_file',
    absolute_path: absolutePath,
    ...(tags || {}),
  };
  if (triageRule) {
    notes.triage_rule = triageRule;
  }
  
  const result = await pool.query(
    `INSERT INTO public.source_registry (
      source_key,
      publisher,
      tier,
      title,
      source_type,
      local_path,
      doc_sha256,
      notes,
      ingestion_stream
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [
      sourceKey,
      parsedPublisher,
      tierFromPublisher(parsedPublisher),
      parsedTitle,
      'PDF', // Default source_type
      absolutePath,
      fileHash,
      JSON.stringify(notes),
      'CORPUS', // Default ingestion stream
    ]
  );
  
  const sourceRegistryId = result.rows[0].id;
  console.log(`[SourceRegistry] Created new record: ${sourceKey} (id: ${sourceRegistryId})`);
  
  return sourceRegistryId;
}

/**
 * Ingest a document by source_registry_id.
 * This is the ONLY way to ingest documents - they must have a Source Registry record first.
 * 
 * @param sourceRegistryId - UUID of the Source Registry record
 * @param filePath - Path to the file to ingest (must match Source Registry record)
 * @param sourceName - Source name for ingestion
 * @param title - Document title
 * @param publishedAt - Optional publication date
 * @param authorityScope - Authority scope (default: BASELINE_AUTHORITY)
 * @returns IngestionResult
 */
export async function ingestSourceRegistryId(
  sourceRegistryId: string,
  filePath: string,
  sourceName: string,
  title: string,
  publishedAt?: string | null,
  authorityScope: string = 'BASELINE_AUTHORITY'
): Promise<IngestionResult> {
  // Hard guard: must have source_registry_id
  assertSourceRegistryId(sourceRegistryId, 'ingestSourceRegistryId');
  
  // Verify Source Registry record exists
  const pool = getCorpusPoolForAdmin();
  const srCheck = await pool.query(
    `SELECT id, source_key, local_path, doc_sha256 
     FROM public.source_registry 
     WHERE id = $1`,
    [sourceRegistryId]
  );
  
  if (srCheck.rows.length === 0) {
    return {
      success: false,
      error: `Source Registry record not found: ${sourceRegistryId}`,
    };
  }
  
  const srRecord = srCheck.rows[0];
  
  // Verify file path matches (if local_path is set)
  if (srRecord.local_path && srRecord.local_path !== filePath) {
    console.warn(`[Ingestion] File path mismatch: SR has ${srRecord.local_path}, provided ${filePath}`);
  }
  
  // Ingest using the existing function
  return await ingestDocumentFromFile(
    filePath,
    sourceName,
    title,
    publishedAt,
    authorityScope,
    sourceRegistryId
  );
}
