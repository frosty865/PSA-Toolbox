/**
 * Question visibility filtering based on PRA/SLA toggle state.
 * Centralizes gating logic to ensure consistent behavior across all tabs.
 */

export type QuestionLike = {
  id?: string;
  scope?: 'BASELINE' | 'PRA_SLA';
  [key: string]: unknown;
};

/**
 * Filters a question array based on PRA/SLA toggle state.
 * When PRA/SLA toggle is OFF, questions with scope='PRA_SLA' are excluded.
 * When PRA/SLA toggle is ON, all questions are included.
 *
 * @param questions - Array of questions to filter
 * @param praSlaEnabled - Whether the PRA/SLA module is enabled
 * @returns Filtered question array
 */
export function filterQuestionsByScope<T extends QuestionLike>(
  questions: readonly T[],
  praSlaEnabled: boolean
): T[] {
  if (praSlaEnabled) {
    // All questions visible when toggle is ON
    return [...questions];
  }

  // When toggle is OFF, exclude questions with scope='PRA_SLA'
  return questions.filter((q) => q.scope !== 'PRA_SLA');
}

/**
 * Checks if a specific question should be visible based on PRA/SLA state.
 *
 * @param questionId - The ID of the question
 * @param questionScope - The scope of the question
 * @param praSlaEnabled - Whether the PRA/SLA module is enabled
 * @returns true if the question should be visible
 */
export function shouldShowQuestion(
  questionId: string,
  questionScope: string | undefined,
  praSlaEnabled: boolean
): boolean {
  // If PRA/SLA is ON, all questions visible
  if (praSlaEnabled) return true;

  // If PRA/SLA is OFF, only BASELINE questions visible
  return questionScope !== 'PRA_SLA';
}

/**
 * Checks if a question ID is a PRA/SLA-only question.
 * Useful for identifying which questions should trigger PRA/SLA gating.
 *
 * @param questionId - The ID of the question
 * @returns true if the question is PRA/SLA-only
 */
export function isPraSlaQuestion(questionId: string): boolean {
  const PRA_SLA_QUESTION_IDS = new Set([
    'W_Q6', // priority restoration (water)
    'W_Q7', // contingency plan (water)
    'WW_Q6', // priority restoration (wastewater)
    'WW_Q7', // contingency plan (wastewater)
    'E-11', // priority restoration (energy) - if inline
    'CO-7', // priority restoration (comms) - if inline
    'IT-11', // priority restoration (IT) - if inline
  ]);

  return PRA_SLA_QUESTION_IDS.has(questionId);
}
