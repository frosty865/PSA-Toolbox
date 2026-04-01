/**
 * Sanitizer guard: ban raw internal key names in report output.
 * Use for QC: fail export if narrative contains key-like patterns.
 */

/** Patterns that indicate internal field keys leaked into narrative. */
const RAW_KEY_PATTERNS = [
  /[A-Z]{1,4}_[A-Z0-9_]{1,}/g,           // W_Q8_alternate_source
  /[A-Z]{1,4}-\d+[_\w]*/g,               // E-3, IT-1_can_identify, CO-11_restoration
  /\b[A-Z]{1,4}_[a-z_]+_?[a-z0-9_]*\s*=\s*(yes|no|UNKNOWN)/gi,  // key = yes/no/UNKNOWN
];

/**
 * Returns first match (key-like substring) found in text, or null if none.
 */
export function findRawKeyLeak(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  for (const re of RAW_KEY_PATTERNS) {
    const m = text.match(re);
    if (m && m[0]) return m[0];
  }
  return null;
}

/**
 * QC: collect all key-like leaks in text. Returns array of offending substrings.
 */
export function collectRawKeyLeaks(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set<string>();
  for (const re of RAW_KEY_PATTERNS) {
    const matches = text.matchAll(re);
    for (const m of matches) {
      if (m[0]) seen.add(m[0]);
    }
  }
  return [...seen];
}

/**
 * Assert no raw keys in narrative. Use in export QC; throws with message listing leaks.
 */
export function assertNoRawKeysInNarrative(text: string, context?: string): void {
  const leaks = collectRawKeyLeaks(text);
  if (leaks.length > 0) {
    const ctx = context ? ` (${context})` : '';
    throw new Error(`Report narrative contains internal key-like text${ctx}: ${leaks.join(', ')}`);
  }
}
