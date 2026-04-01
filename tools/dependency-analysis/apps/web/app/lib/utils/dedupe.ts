/**
 * Deduplication utilities for array data.
 * 
 * Ensures deterministic, order-preserving uniqueness by key.
 */

/**
 * Deduplicate array items by a key function.
 * 
 * Keeps first occurrence of each unique key, drops subsequent duplicates.
 * Preserves original order of first occurrences.
 * 
 * @param items Array of items to deduplicate
 * @param key Function to extract unique key from each item
 * @returns Deduplicated array maintaining original order
 * 
 * @example
 * ```ts
 * const items = [
 *   { id: 'a', name: 'Alice' },
 *   { id: 'b', name: 'Bob' },
 *   { id: 'a', name: 'Alice (duplicate)' },
 * ];
 * const unique = dedupeByKey(items, item => item.id);
 * // Result: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }]
 * ```
 */
export function dedupeByKey<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }

  return result;
}
