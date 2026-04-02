/**
 * Apply extracted metadata to source_registry and corpus_documents.
 * GUARDED: only fill nulls; never overwrite existing non-null.
 * CORPUS only. scope_tags: strict ScopeTag[] (sector/subsector codes only).
 */

import type { Pool } from 'pg';
import type { ExtractedMetadata } from './extract_document_metadata';
import { getSectorTaxonomy } from '@/app/lib/taxonomy/get_sector_taxonomy';
import { normalizeScopeTags, upsertSectorSubsectorTags } from '@/app/lib/sourceRegistry/scope_tags';

/**
 * Apply extracted metadata to source_registry (by id).
 * - title, publisher, publication_date: only if current value is null.
 * - scope_tags: canonical codes only via upsertSectorSubsectorTags; write only if result differs or cleanup needed.
 */
export async function applyExtractedMetadataToSourceRegistry(
  pool: Pool,
  sourceRegistryId: string,
  extracted: ExtractedMetadata
): Promise<void> {
  const row = await pool.query<{ title: string | null; publisher: string | null; publication_date: string | null; scope_tags: unknown }>(
    `SELECT title, publisher, publication_date, scope_tags FROM public.source_registry WHERE id = $1`,
    [sourceRegistryId]
  );
  if (row.rows.length === 0) return;

  const current = row.rows[0];
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (extracted.title != null && extracted.title.trim() !== '' && (current.title == null || current.title.trim() === '')) {
    updates.push(`title = $${idx}`);
    params.push(extracted.title.trim());
    idx++;
  }
  if (extracted.publisher_or_agency != null && extracted.publisher_or_agency.trim() !== '' && (current.publisher == null || current.publisher.trim() === '')) {
    updates.push(`publisher = $${idx}`);
    params.push(extracted.publisher_or_agency.trim());
    idx++;
  }
  if (extracted.publication_date != null && current.publication_date == null) {
    updates.push(`publication_date = $${idx}`);
    params.push(extracted.publication_date);
    idx++;
  }

  const taxonomy = await getSectorTaxonomy();
  const updatedScopeTags = upsertSectorSubsectorTags(
    current.scope_tags,
    extracted.sector,
    extracted.subsector,
    taxonomy
  );
  const existingNormalized = normalizeScopeTags(current.scope_tags);
  const differs =
    updatedScopeTags.length !== existingNormalized.length ||
    updatedScopeTags.some((t, i) => existingNormalized[i]?.type !== t.type || existingNormalized[i]?.code !== t.code);
  if (differs) {
    updates.push(`scope_tags = $${idx}::jsonb`);
    params.push(JSON.stringify(updatedScopeTags));
    idx++;
  }

  if (updates.length === 0) return;
  params.push(sourceRegistryId);
  await pool.query(
    `UPDATE public.source_registry SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx}`,
    params
  );
}

/**
 * Apply extracted metadata to corpus_documents (by id).
 * - inferred_title: if null OR title_confidence < 50; set title_confidence = 70 when written.
 * - publisher: only if null.
 * - publication_date: only if null.
 * - citation_short: always write if extracted.synopsis is non-null.
 */
export async function applyExtractedMetadataToCorpusDocument(
  pool: Pool,
  corpusDocumentId: string,
  extracted: ExtractedMetadata
): Promise<void> {
  const row = await pool.query<{ inferred_title: string | null; title_confidence: number | null; publisher: string | null; publication_date: string | null }>(
    `SELECT inferred_title, title_confidence, publisher, publication_date FROM public.corpus_documents WHERE id = $1`,
    [corpusDocumentId]
  );
  if (row.rows.length === 0) return;

  const current = row.rows[0];
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const shouldSetTitle = extracted.title != null && extracted.title.trim() !== '' &&
    (current.inferred_title == null || current.inferred_title.trim() === '' || (current.title_confidence ?? 0) < 50);
  if (shouldSetTitle) {
    updates.push(`inferred_title = $${idx}`);
    params.push(extracted.title!.trim());
    idx++;
    updates.push(`title_confidence = 70`);
  }

  if (extracted.publisher_or_agency != null && extracted.publisher_or_agency.trim() !== '' && (current.publisher == null || current.publisher.trim() === '')) {
    updates.push(`publisher = $${idx}`);
    params.push(extracted.publisher_or_agency.trim());
    idx++;
  }
  if (extracted.publication_date != null && current.publication_date == null) {
    updates.push(`publication_date = $${idx}`);
    params.push(extracted.publication_date);
    idx++;
  }
  if (extracted.synopsis != null && extracted.synopsis.trim() !== '') {
    updates.push(`citation_short = $${idx}`);
    params.push(extracted.synopsis.trim());
    idx++;
  }

  if (updates.length === 0) return;
  params.push(corpusDocumentId);
  await pool.query(
    `UPDATE public.corpus_documents SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx}`,
    params
  );
}
