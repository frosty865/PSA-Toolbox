/**
 * Citation Guards for OFC Promotion
 * 
 * Hard guards that enforce citation requirements before OFC creation/promotion.
 */

import { validateCitations, type Citation } from './validation';
import { assertSourceKeysExistInCorpus } from './validateSourceKeys';

/**
 * Validate that all citation source_keys exist in source_registry (CORPUS)
 * 
 * @deprecated Use assertSourceKeysExistInCorpus() directly for hard failures
 * This function is kept for backward compatibility with existing callers.
 */
export async function validateCitationSourceKeys(citations: Citation[]): Promise<{ valid: boolean; error?: string; missing_keys?: string[] }> {
  if (!citations || citations.length === 0) {
    return { valid: false, error: 'OFC must have at least one citation' };
  }

  // Extract all source_keys
  const sourceKeys = citations.map(c => c.source_key).filter(Boolean);

  if (sourceKeys.length === 0) {
    return { valid: false, error: 'All citations must have source_key' };
  }

  try {
    await assertSourceKeysExistInCorpus(sourceKeys);
    return { valid: true };
  } catch (error: unknown) {
    const err = error as { message?: string; missing_keys?: string[] };
    return {
      valid: false,
      error: err.message ?? 'Source key validation failed',
      missing_keys: err.missing_keys
    };
  }
}

/**
 * Guard: Reject OFC creation/promotion if citations are missing or invalid
 */
export async function guardOFCRequiresCitations(citations: unknown[]): Promise<{ valid: boolean; error?: string }> {
  // Validate citation structure
  const structureValidation = validateCitations(citations);
  if (!structureValidation.valid) {
    return structureValidation;
  }

  // Validate source_keys exist
  const sourceKeyValidation = await validateCitationSourceKeys(citations as Citation[]);
  if (!sourceKeyValidation.valid) {
    return sourceKeyValidation;
  }

  return { valid: true };
}

/**
 * Guard: Reject if citations array is empty
 */
export function guardCitationsNotEmpty(citations: unknown[]): { valid: boolean; error?: string } {
  if (!citations || !Array.isArray(citations) || citations.length === 0) {
    return { valid: false, error: 'OFC must have at least one citation' };
  }
  return { valid: true };
}
