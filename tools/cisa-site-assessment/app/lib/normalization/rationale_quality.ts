/**
 * Rationale quality: ban generic filler and self-echo (rationale repeating element text).
 * Use after element generation; if validation fails, replace with stub or re-prompt for rationale only.
 */

const GENERIC = [
  "ensures",
  "supports",
  "enables",
  "keeps the plan current",
  "provides a single reference",
  "ensures someone is responsible",
  "validates readiness",
];

function hasTooMuchGeneric(s: string): boolean {
  const t = (s || "").toLowerCase();
  let hits = 0;
  for (const g of GENERIC) if (t.includes(g)) hits++;
  return hits >= 2;
}

function overlapRatio(a: string, b: string): number {
  const A = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );
  const B = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return A.size ? inter / A.size : 0;
}

/**
 * Validate element rationale: not too thin, does not echo element text, not too generic.
 * @returns List of error codes: RATIONALE_TOO_THIN, RATIONALE_ECHO, RATIONALE_TOO_GENERIC
 */
export function validateElementRationale(
  element_text: string,
  rationale: string
): string[] {
  const errs: string[] = [];
  if (!rationale || rationale.trim().length < 25) errs.push("RATIONALE_TOO_THIN");
  if (overlapRatio(element_text, rationale) > 0.6) errs.push("RATIONALE_ECHO");
  if (hasTooMuchGeneric(rationale)) errs.push("RATIONALE_TOO_GENERIC");
  return errs;
}
