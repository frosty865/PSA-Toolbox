/**
 * Block scenario/hazard phrasing in criteria. Criteria MUST be EAP plan elements only.
 * Wire this right after criteria generation; if errors exist, stop and show them (do not proceed to OFCs).
 */

const FORBIDDEN = [
  /\bwhat to do\b/i,
  /\binitial actions?\b/i,
  /\bactive shooter\b/i,
  /\btornado\b/i,
  /\blightning\b/i,
  /\bemergency siren\b/i,
  /\bwarning or sighting\b/i,
];

/**
 * Validates that each criterion is a plan element in the format "Plan element exists: …"
 * and does not contain scenario/hazard language.
 * @returns List of error messages (CRITERIA_FORMAT or CRITERIA_SCENARIO_NOT_ALLOWED).
 */
export function validateCriteriaArePlanElements(criteria: string[]): string[] {
  const errs: string[] = [];
  for (const c of criteria || []) {
    if (!/^Plan element exists:\s+/i.test(c)) {
      errs.push(`CRITERIA_FORMAT: "${c}"`);
      continue;
    }
    for (const re of FORBIDDEN) {
      if (re.test(c)) {
        errs.push(`CRITERIA_SCENARIO_NOT_ALLOWED: "${c}"`);
        break;
      }
    }
  }
  return errs;
}
