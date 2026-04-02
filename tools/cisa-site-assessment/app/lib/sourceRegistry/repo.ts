import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { SourceRegistryCreateInput, SourceRegistryUpdateInput, mapCreateToDb, mapUpdateToDb, extractStatusFromNotes } from './schema';

/**
 * Database repository for source_registry
 * Maps API schema to DB schema
 */

export async function createSourceRegistryRow(data: SourceRegistryCreateInput) {
  const pool = getCorpusPoolForAdmin();
  const dbData = mapCreateToDb(data);

  // Check if source_key already exists
  const existingCheck = await pool.query(
    `SELECT source_key FROM public.source_registry WHERE source_key = $1`,
    [dbData.source_key]
  );

  if (existingCheck.rows.length > 0) {
    throw new Error(`Source with source_key "${dbData.source_key}" already exists`);
  }

  // Insert new source
  const result = await pool.query(
    `INSERT INTO public.source_registry (
      source_key,
      publisher,
      tier,
      title,
      publication_date,
      source_type,
      canonical_url,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      dbData.source_key,
      dbData.publisher,
      dbData.tier,
      dbData.title,
      dbData.publication_date,
      dbData.source_type,
      dbData.canonical_url,
      dbData.notes
    ]
  );

  return result.rows[0];
}

export async function updateSourceRegistryRow(sourceKey: string, data: SourceRegistryUpdateInput) {
  const pool = getCorpusPoolForAdmin();

  // Check if source exists and get current notes to preserve status if not being updated
  const existingCheck = await pool.query(
    `SELECT source_key, notes FROM public.source_registry WHERE source_key = $1`,
    [sourceKey]
  );

  if (existingCheck.rows.length === 0) {
    throw new Error('Source not found');
  }

  // Reject if source_key is being changed
  if ('source_key' in data && (data as { source_key?: string }).source_key !== sourceKey) {
    throw new Error('source_key is immutable and cannot be changed');
  }

  const existingNotes = existingCheck.rows[0].notes;
  const existingStatus = extractStatusFromNotes(existingNotes);

  // If status is not being updated, preserve existing status
  const dataWithStatus = {
    ...data,
    status: data.status !== undefined ? data.status : existingStatus,
  };

  const dbData = mapUpdateToDb(dataWithStatus);

  // Build update query dynamically
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const allowedFields = ['publisher', 'tier', 'title', 'publication_date', 'source_type', 'canonical_url', 'notes', 'scope_tags'];

  const isTechnologyLibrary = dbData.is_technology_library === true;

  for (const field of allowedFields) {
    if (field in dbData) {
      const val = dbData[field as keyof typeof dbData];
      if (field === 'scope_tags') {
        updates.push(`scope_tags = $${paramIndex}::jsonb`);
        const arr = Array.isArray(val) ? val : [];
        if (isTechnologyLibrary) {
          values.push(JSON.stringify({ display: arr, tags: { library: 'technology' } }));
        } else {
          values.push(JSON.stringify(arr));
        }
      } else {
        updates.push(`${field} = $${paramIndex}`);
        values.push(val ?? null);
      }
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(sourceKey);

  const result = await pool.query(
    `UPDATE public.source_registry
     SET ${updates.join(', ')}
     WHERE source_key = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}
