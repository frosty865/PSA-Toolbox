/**
 * Sector/Subsector Expansion Validation Helpers
 * 
 * Hard guardrails to prevent baseline contamination and ensure expansion isolation.
 */

/**
 * Valid profile status values
 */
export const VALID_PROFILE_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export type ProfileStatus = typeof VALID_PROFILE_STATUSES[number];

/**
 * Valid question status values
 */
export const VALID_QUESTION_STATUSES = ['ACTIVE', 'RETIRED'] as const;
export type QuestionStatus = typeof VALID_QUESTION_STATUSES[number];

/**
 * Validates that a profile status is in the allowed set
 */
export function isValidProfileStatus(status: string): status is ProfileStatus {
  return VALID_PROFILE_STATUSES.includes(status as ProfileStatus);
}

/**
 * Validates that a question status is in the allowed set
 */
export function isValidQuestionStatus(status: string): status is QuestionStatus {
  return VALID_QUESTION_STATUSES.includes(status as QuestionStatus);
}

/**
 * Validates that a response value is in the question's allowed enum
 */
export function isValidResponseForQuestion(
  response: string,
  responseEnum: string[]
): boolean {
  return responseEnum.includes(response);
}

/**
 * Baseline question ID patterns that must be rejected
 */
const BASELINE_ID_PATTERNS = [
  /^BASE-\d+$/i,  // BASE-000, BASE-001, etc.
  /^baseline/i,   // baseline_*
];

/**
 * Baseline field names that must not appear in expansion payloads
 */
const BASELINE_FIELDS = [
  'element_id',
  'element_code',
  'capability_dimension',
  'mapped_gate',
  'gate_triggered_by',
  'baseline_version',
];

/**
 * Asserts that a payload does not contain baseline-only fields or IDs
 * Throws an error if baseline contamination is detected
 */
export function assertNoBaselineContamination(payload: unknown): void {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  const p = payload as Record<string, unknown>;

  // Check for baseline question IDs
  if (p.question_id || p.question_ids) {
    const ids = Array.isArray(p.question_ids) 
      ? p.question_ids 
      : [p.question_id];
    
    for (const id of ids) {
      if (typeof id === 'string') {
        for (const pattern of BASELINE_ID_PATTERNS) {
          if (pattern.test(id)) {
            throw new Error(
              `Baseline contamination detected: question_id "${id}" matches baseline pattern. ` +
              `Expansion routes must not accept baseline question IDs.`
            );
          }
        }
      }
    }
  }

  // Check for baseline field names
  for (const field of BASELINE_FIELDS) {
    if (field in p) {
      throw new Error(
        `Baseline contamination detected: field "${field}" is baseline-only. ` +
        `Expansion routes must not accept baseline fields.`
      );
    }
  }

  // Check nested objects (e.g., responses array)
  if (Array.isArray(p.responses)) {
    for (const response of p.responses) {
      if (response && typeof response === 'object') {
        assertNoBaselineContamination(response);
      }
    }
  }
}

/**
 * Checks if an assessment is a test assessment
 * Test marker rule: qa_flag=true OR test_run_id IS NOT NULL OR name LIKE '[QA]%' OR name contains 'test'
 */
export function isTestAssessment(assessment: {
  qa_flag?: boolean | null;
  test_run_id?: string | null;
  facility_name?: string | null;
  name?: string | null;
}): boolean {
  const name = assessment.facility_name || assessment.name || '';
  return (
    assessment.qa_flag === true ||
    assessment.test_run_id !== null ||
    name.startsWith('[QA]') ||
    name.toLowerCase().includes('test')
  );
}

/**
 * Asserts that an assessment is not a test assessment
 * Throws an error if it is a test assessment (unless explicitly allowed)
 */
export function assertNotTestAssessment(
  assessment: {
    qa_flag?: boolean | null;
    test_run_id?: string | null;
    facility_name?: string | null;
    name?: string | null;
  },
  allowTest: boolean = false
): void {
  if (!allowTest && isTestAssessment(assessment)) {
    throw new Error(
      'Cannot perform expansion operations on test assessments. ' +
      'Test assessments are identified by: qa_flag=true, test_run_id set, name starts with [QA], or name contains "test".'
    );
  }
}

/**
 * Validates that a version number is positive
 */
export function isValidVersion(version: number): boolean {
  return Number.isInteger(version) && version > 0;
}

