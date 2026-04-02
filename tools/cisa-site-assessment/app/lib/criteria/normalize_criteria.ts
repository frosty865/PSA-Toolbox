/**
 * Pre-validation normalizer: rewrite leading What/How into existence-based Yes/No/N/A phrasing.
 * Safety net only; validator remains the authority.
 */

const WHAT_LEAD = /^\s*what\s+/i;
const HOW_LEAD = /^\s*how\s+/i;

/** Trim and collapse internal whitespace to single spaces. */
function clean(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Normalize one criterion. Rewrites leading What/How to existence-based form.
 * @returns { out: normalized string; changed: true if rewritten }
 */
export function normalizeOneCriterion(s: string): { out: string; changed: boolean } {
  const t = clean(s);
  if (!t) return { out: "", changed: false };

  const rest = t.replace(/\?+$/, "").trim();
  if (!rest) return { out: t.endsWith("?") ? t : t + "?", changed: false };

  // What ...
  if (WHAT_LEAD.test(rest)) {
    const afterWhat = clean(rest.replace(WHAT_LEAD, ""));
    if (!afterWhat) return { out: "Is there a defined and documented capability?", changed: true };
    // "What is the purpose of X?" -> "Is there a defined and documented purpose for X?"
    const purposeOf = /^is\s+the\s+purpose\s+of\s+(.+)$/i.exec(afterWhat);
    if (purposeOf) {
      const out = "Is there a defined and documented purpose for " + clean(purposeOf[1]) + "?";
      return { out, changed: true };
    }
    const roleOf = /^is\s+the\s+role\s+of\s+(.+)$/i.exec(afterWhat);
    if (roleOf) {
      const out = "Is there a defined and documented role for " + clean(roleOf[1]) + "?";
      return { out, changed: true };
    }
    // "What is X?" / "What are X?" -> avoid "capability to is X"; strip leading is/are/does/do phrase
    const stripVerb = afterWhat.replace(/^(is|are|does|do)\s+(the\s+)?/i, "").trim() || afterWhat;
    const out = "Is there a defined and documented capability to " + stripVerb + "?";
    return { out, changed: true };
  }

  // How ...
  if (HOW_LEAD.test(rest)) {
    const afterHow = clean(rest.replace(HOW_LEAD, ""));
    if (!afterHow) return { out: "Is there an established capability?", changed: true };
    // "How do you X?" / "How does the facility X?" -> "Is there an established capability to X?"
    const stripHowDo = afterHow
      .replace(/^do\s+you\s+/i, "")
      .replace(/^does\s+(the\s+)?(facility|site|organization)\s+/i, "")
      .replace(/^do\s+(we|they)\s+/i, "")
      .trim();
    const tail = stripHowDo || afterHow;
    const out = "Is there an established capability to " + tail + "?";
    return { out, changed: true };
  }

  // Ensure ends with ?
  const out = t.endsWith("?") ? t : t + "?";
  return { out, changed: false };
}

export interface NormalizeCriteriaListResult {
  normalized: string[];
  rewrites: { from: string; to: string }[];
}

/**
 * Normalize a list of criteria. Rewrites any leading What/How; records rewrites.
 */
export function normalizeCriteriaList(criteria: string[]): NormalizeCriteriaListResult {
  const normalized: string[] = [];
  const rewrites: { from: string; to: string }[] = [];
  for (const c of criteria ?? []) {
    const { out, changed } = normalizeOneCriterion(typeof c === "string" ? c : "");
    normalized.push(out);
    if (changed && (c ?? "").trim()) {
      rewrites.push({ from: clean((c ?? "").trim()), to: out });
    }
  }
  return { normalized, rewrites };
}
