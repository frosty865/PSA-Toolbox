/**
 * Knowledge gaps: information gaps identified from questionnaire answers.
 * Separate from structural findings (themes)—never phrased as failure, just information gap.
 */

export type KnowledgeGap = {
  id: string; // stable id e.g. "COMMS_PROVIDER_UNKNOWN"
  title: string; // short
  description: string; // 1 sentence
  question_ids: string[]; // supporting question ids
  severity: 'HIGH' | 'MEDIUM' | 'LOW'; // simple triage; no scoring math
};

export type GapResolverInput = {
  category: 'ENERGY' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER';
  answers: Record<string, unknown>;
  /** Category object from assessment (e.g. supply.sources) for traceable provider checks. */
  categoryInput?: {
    supply?: { sources?: Array<{ provider_name?: string; service_provider?: string }> };
    IT_1_service_providers?: unknown[] | Record<string, unknown>;
  } & Record<string, unknown>;
};
