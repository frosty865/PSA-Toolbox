import { spawn } from 'child_process';
import path from 'path';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

type RunResult = { code: number; stdout: string; stderr: string };

function run(cmd: string, args: string[], cwd: string, timeoutMs?: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));

    let timeoutId: NodeJS.Timeout | null = null;
    if (timeoutMs && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        // Give it a moment to clean up, then force kill
        setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // Process may already be dead
          }
        }, 5000);
        reject(new Error(`Process timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    child.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
    
    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Reprocess a CORPUS document by id by invoking the existing Python ingest script.
 *
 * This MUST:
 * - Produce document_chunks (or fail with a real error)
 * - Update corpus_documents.processing_status/chunk_count/last_error/processed_at truthfully
 */
export async function reprocessCorpusDocumentById(corpusDocumentId: string): Promise<void> {
  const pool = getCorpusPool();
  const { rows } = await pool.query(
    `SELECT id FROM public.corpus_documents WHERE id = $1`,
    [corpusDocumentId]
  );
  if (rows.length === 0) throw new Error(`corpus_document_id not found: ${corpusDocumentId}`);

  let pythonExe = process.env.PSA_PYTHON_PROCESSOR_EXE?.trim() || '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dynamic load
    const { findPythonExecutable } = require('../python/venv') as { findPythonExecutable: (s: string) => string | null };
    pythonExe = pythonExe || (findPythonExecutable('processor') ?? '');
  } catch {
    // use env or fallback below
  }
  if (!pythonExe) {
    throw new Error(
      "Python executable not resolved. Set PSA_PYTHON_PROCESSOR_EXE or ensure app/lib/python/venv findPythonExecutable('processor') works."
    );
  }

  const repoRoot = process.cwd();
  const scriptPath = path.join(repoRoot, 'tools', 'corpus_ingest_pdf.py');
  const args = [scriptPath, '--reprocess-corpus-document-id', corpusDocumentId];

  // Default timeout: 30 minutes (PDF processing can be slow for large files)
  // Can be overridden via REPROCESS_TIMEOUT_MS environment variable
  const timeoutMs = parseInt(process.env.REPROCESS_TIMEOUT_MS || '1800000', 10);

  try {
    const res = await run(pythonExe, args, repoRoot, timeoutMs);
    if (res.code !== 0) {
      const tail = (res.stderr || res.stdout || '').slice(-800);
      throw new Error(`Python reprocess failed (code ${res.code}). Tail:\n${tail}`);
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('timeout')) {
      throw new Error(
        `Python reprocess timed out after ${timeoutMs}ms (${Math.round(timeoutMs / 60000)} minutes). ` +
        `The document may be too large or the processing may be stuck. ` +
        `Set REPROCESS_TIMEOUT_MS to increase the timeout.`
      );
    }
    throw error;
  }
}
