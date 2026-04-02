import path from 'path';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { ingestCorpusPdfFileToDb } from '@/app/lib/corpus/corpusPdfIngest';

/**
 * Reprocess a CORPUS document by id using the Node PDF ingest path.
 *
 * This MUST:
 * - Produce document_chunks (or fail with a real error)
 * - Update corpus_documents.processing_status/chunk_count/last_error/processed_at truthfully
 */
export async function reprocessCorpusDocumentById(corpusDocumentId: string): Promise<void> {
  const pool = getCorpusPoolForAdmin();
  const { rows } = await pool.query(
    `SELECT id, source_registry_id, canonical_path, file_hash FROM public.corpus_documents WHERE id = $1`,
    [corpusDocumentId]
  );
  if (rows.length === 0) throw new Error(`corpus_document_id not found: ${corpusDocumentId}`);
  try {
    const doc = rows[0];
    const sourceRegistryId = doc.source_registry_id ? String(doc.source_registry_id) : null;
    if (!sourceRegistryId) {
      throw new Error(`corpus_document ${corpusDocumentId} is missing source_registry_id`);
    }

    const sourceRows = await pool.query<{ local_path: string | null; storage_relpath: string | null }>(
      `SELECT local_path, storage_relpath
       FROM public.source_registry
       WHERE id = $1`,
      [sourceRegistryId]
    );
    const sourceRow = sourceRows.rows[0] ?? null;
    const filePath = sourceRow?.local_path || (sourceRow?.storage_relpath ? path.join(process.cwd(), sourceRow.storage_relpath) : null) || doc.canonical_path || null;
    if (!filePath) {
      throw new Error(`Unable to resolve a file path for corpus_document ${corpusDocumentId}`);
    }

    const result = await ingestCorpusPdfFileToDb({
      filePath,
      pool,
      sourceRegistryId,
    });
    if (!result.success) {
      throw new Error(result.error || `Failed to reprocess corpus_document ${corpusDocumentId}`);
    }
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
