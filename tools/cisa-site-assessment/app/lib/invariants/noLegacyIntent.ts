/**
 * No Legacy Intent Invariant (Meaning Layer Reset)
 *
 * Recursively checks for forbidden keys/phrases. Use at API and UI boundaries.
 */

const FORBIDDEN_KEYS = [
  "intent_object",
  "what_counts_as_yes",
  "what-counts-as-yes",
  "evidence_tips",
  "field_tips",
  "enforcement",
  "typical_evidence",
  "what_does_not_count",
  "field_tip",
  "meaning_text",
];

const FORBIDDEN_PATTERNS = [/^evidence/i, /\btips\b/i, /enforcement/i, /^field_tip/i];

function keyForbidden(k: string): boolean {
  const lower = k.toLowerCase();
  if (FORBIDDEN_KEYS.some((f) => lower === f.toLowerCase())) return true;
  return FORBIDDEN_PATTERNS.some((re) => re.test(k));
}

function walk(obj: unknown, path: string, found: string[]): void {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => walk(item, `${path}[${i}]`, found));
    return;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      if (keyForbidden(k)) {
        found.push(`${path}.${k}`);
      }
      walk((obj as Record<string, unknown>)[k], `${path}.${k}`, found);
    }
  }
}

/**
 * Throws if any forbidden legacy intent key is present in obj.
 *
 * @param obj - payload or state (object or array)
 * @param context - e.g. "GET /api/runtime/questions" or "loadQuestions"
 */
export function assertNoLegacyIntent(obj: unknown, context: string): void {
  const found: string[] = [];
  walk(obj, "<root>", found);
  if (found.length > 0) {
    throw new Error(`[assertNoLegacyIntent] ${context}: forbidden keys: ${found.join(", ")}`);
  }
}
