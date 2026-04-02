/**
 * Doctrinal guard: validates baseline question language.
 * Use before write-back or migration. Throws on failure.
 */

const FORBIDDEN_ABSTRACTIONS = [
  /\bcapability\b/i,
  /\bimplemented\b/i,
  /\boperationalized\b/i,
  /\bprogrammatic\b/i,
];

const CHECKLIST_LANGUAGE = [
  /\bincluding\s+but\s+not\s+limited\s+to\b/i,
  /\bsuch\s+as\b/i,
  /\be\.g\.\b/i,
];

const SECTOR_POPULATION_ASSUMPTIONS = [
  /\bstudents\b/i,
  /\bpatients\b/i,
  /\bfamily\b/i,
  /\bguardians\b/i,
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates baseline question text against doctrine.
 * Use when intent source is not provided to allow sector terms that appear in intent.
 * If intentExcerpt is provided and contains a sector term, that term is allowed in questionText.
 */
export function validateBaselineQuestionLanguage(
  questionText: string,
  intentExcerpt?: string
): ValidationResult {
  const errors: string[] = [];
  const t = questionText.trim();
  if (!t) {
    return { valid: false, errors: ["Question text is empty."] };
  }

  for (const re of FORBIDDEN_ABSTRACTIONS) {
    if (re.test(t)) {
      errors.push(
        `Forbidden abstraction in baseline question: "${t.match(re)?.[0] ?? "match"}". Remove: capability, implemented, operationalized, programmatic.`
      );
    }
  }

  for (const re of CHECKLIST_LANGUAGE) {
    if (re.test(t)) {
      errors.push(
        `Checklist language not allowed in baseline questions: "${t.match(re)?.[0] ?? "match"}". Avoid: including but not limited to, such as, e.g.`
      );
    }
  }

  const intentLower = (intentExcerpt ?? "").toLowerCase();
  for (const re of SECTOR_POPULATION_ASSUMPTIONS) {
    if (re.test(t)) {
      const term = t.match(re)?.[0] ?? "";
      if (!intentLower.includes(term.toLowerCase())) {
        errors.push(
          `Sector-specific population assumption without intent support: "${term}". Avoid: students, patients, family, guardians unless explicitly in intent.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates and throws with a clear message if invalid. Use before write-back or migration.
 */
export function assertBaselineQuestionLanguage(
  questionText: string,
  intentExcerpt?: string
): void {
  const result = validateBaselineQuestionLanguage(questionText, intentExcerpt);
  if (!result.valid) {
    throw new Error(
      `Baseline question language validation failed: ${result.errors.join(" ")}`
    );
  }
}
