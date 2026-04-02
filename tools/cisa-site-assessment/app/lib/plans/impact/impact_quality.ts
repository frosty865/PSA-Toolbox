/**
 * Impact statement validation: one sentence each, non-prescriptive, no forbidden tokens.
 * Use after PASS B; if validation fails, re-prompt once or drop impacts for that section.
 */

const FORBIDDEN = [
  /\bshould\b/i,
  /\bmust\b/i,
  /\bimplement\b/i,
  /\bdeploy\b/i,
  /\binstall\b/i,
  /\bpurchase\b/i,
  /\btrain\b/i,
  /\bcost\b/i,
  /\bbudget\b/i,
  /\bwithin\s+\d+\s+(days|weeks|months)\b/i,
  /\bpriority\b/i,
  /\brecommended\b/i,
];

function oneSentence(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  const periods = (t.match(/\./g) || []).length;
  return periods === 1 && t.endsWith(".");
}

/**
 * Validate if_missing and if_present pair.
 * @returns List of error codes (IF_MISSING_PREFIX, IF_PRESENT_PREFIX, IF_MISSING_NOT_ONE_SENTENCE, IF_PRESENT_NOT_ONE_SENTENCE, FORBIDDEN_TOKEN_*, DUPLICATE_IMPACT_SENTENCES).
 */
export function validateImpactPair(
  ifMissing: string,
  ifPresent: string
): string[] {
  const errs: string[] = [];
  if (!(ifMissing ?? "").trim().startsWith("If missing,")) errs.push("IF_MISSING_PREFIX");
  if (!(ifPresent ?? "").trim().startsWith("If present,")) errs.push("IF_PRESENT_PREFIX");
  if (!oneSentence(ifMissing ?? "")) errs.push("IF_MISSING_NOT_ONE_SENTENCE");
  if (!oneSentence(ifPresent ?? "")) errs.push("IF_PRESENT_NOT_ONE_SENTENCE");

  for (const re of FORBIDDEN) {
    if (re.test(ifMissing ?? "")) errs.push(`FORBIDDEN_TOKEN_IN_IF_MISSING`);
    if (re.test(ifPresent ?? "")) errs.push(`FORBIDDEN_TOKEN_IN_IF_PRESENT`);
  }

  const nm = (ifMissing ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  const np = (ifPresent ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  if (nm === np) errs.push("DUPLICATE_IMPACT_SENTENCES");

  return errs;
}
