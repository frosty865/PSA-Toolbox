/**
 * Validate checklist items against declarative rules (mirrors normalizedLint).
 * Run after rewriteChecklistItems and before normalization lint.
 */

const STARTS_WITH_THE = /^the\s+/i;
const HAS_IS_ARE = /\s(is|are)\s/i;
const HAS_EXISTS_EXIST = /\b(exists|exist)\b/i;
const LEADING_INTERROGATIVES = /^(what|how|when|why|should)\b/i;

/**
 * Returns error messages for items that fail declarative rules.
 * Aligns with normalizedLint: allow "The …", " is "/" are ", or "exists/exist".
 */
export function validateChecklistItems(items: string[]): string[] {
  const errs: string[] = [];
  for (const raw of items || []) {
    const s = (raw || "").trim();
    if (!s) continue;
    if (s.includes("?")) errs.push(`CHECKLIST_QUESTION: "${s}"`);
    if (LEADING_INTERROGATIVES.test(s)) errs.push(`CHECKLIST_QUESTION: "${s}"`);
    const declarative =
      STARTS_WITH_THE.test(s) || HAS_IS_ARE.test(s) || HAS_EXISTS_EXIST.test(s);
    if (!declarative) errs.push(`CHECKLIST_NOT_DECLARATIVE: "${s}"`);
  }
  return errs;
}
