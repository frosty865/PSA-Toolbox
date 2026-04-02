/**
 * Deterministic post-process for impact output: normalize sentence punctuation and spacing.
 * No hallucinated ROI; keep one sentence each.
 */

export function normalizeImpactSentence(s: string): string {
  let t = (s || "").trim().replace(/\s+/g, " ");
  if (t && !t.endsWith(".")) t += ".";
  return t;
}

export function normalizeImpactOutput<T extends { if_missing?: string; if_present?: string }>(
  o: T
): T {
  if (!o) return o;
  const out = { ...o };
  if (typeof (out as { if_missing?: string }).if_missing === "string") {
    (out as { if_missing: string }).if_missing = normalizeImpactSentence(
      (out as { if_missing: string }).if_missing
    );
  }
  if (typeof (out as { if_present?: string }).if_present === "string") {
    (out as { if_present: string }).if_present = normalizeImpactSentence(
      (out as { if_present: string }).if_present
    );
  }
  return out;
}
