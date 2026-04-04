/**
 * Generic session snapshot types for dependency questionnaire persistence.
 * Keys match CategoryCode (assessment.categories).
 */

export type DependencySessionSnapshot = {
  answers: Record<string, unknown>;
  derived?: {
    themedFindings?: unknown[];
    knowledgeGaps?: unknown[];
    vulnerabilities?: unknown[];
    ofcs?: unknown[];
    reportBlocks?: unknown[];
    [k: string]: unknown;
  };
  saved_at_iso: string;
};

/** CategoryCode keys: ELECTRIC_POWER, COMMUNICATIONS, WATER, WASTEWATER, INFORMATION_TECHNOLOGY */
export type DependencySessionsMap = Partial<
  Record<
    | 'ELECTRIC_POWER'
    | 'COMMUNICATIONS'
    | 'WATER'
    | 'WASTEWATER'
    | 'INFORMATION_TECHNOLOGY',
    DependencySessionSnapshot
  >
>;
