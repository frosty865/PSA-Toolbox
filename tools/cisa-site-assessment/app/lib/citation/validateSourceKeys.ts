/**
 * Centralized Source Key Validation (CORPUS Database Only)
 * 
 * Hard guard: Throws if any source_key does not exist in CORPUS source_registry.
 * Used by all citation write operations to ensure referential integrity.
 */

import { getCorpusPool } from '@/app/lib/db/corpus_client';

/**
 * Assert that all source_keys exist in CORPUS source_registry.
 * 
 * @param sourceKeys Array of source_key strings to validate
 * @throws Error with status 400 if any keys are missing
 */
export async function assertSourceKeysExistInCorpus(sourceKeys: string[]): Promise<void> {
  if (!sourceKeys || sourceKeys.length === 0) {
    throw new Error('No source_keys provided');
  }

  // Deduplicate keys
  const uniqueKeys = [...new Set(sourceKeys.filter(Boolean))];

  if (uniqueKeys.length === 0) {
    throw new Error('No valid source_keys provided');
  }

  const corpusPool = getCorpusPool();

  // Query CORPUS source_registry for all keys at once
  // Use ANY($1::text[]) for efficient array matching
  const result = await corpusPool.query(
    `SELECT source_key FROM public.source_registry WHERE source_key = ANY($1::text[])`,
    [uniqueKeys]
  );

  const foundKeys = new Set(result.rows.map((r: Record<string, unknown>) => r.source_key as string));
  const missingKeys = uniqueKeys.filter(key => !foundKeys.has(key));

  if (missingKeys.length > 0) {
    const error = new Error(
      `Citations reference unknown source_keys: ${missingKeys.join(', ')}`
    ) as Error & { status?: number; missing_keys?: string[] };
    error.status = 400;
    error.missing_keys = missingKeys;
    throw error;
  }
}
