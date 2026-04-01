/**
 * Analytical Considerations - Type Definitions
 * 
 * Replaces VOFC tables with citation-backed narrative analysis.
 * Each consideration provides decision-quality context without prescriptive commands.
 * 
 * HARD RULES:
 * - Max 4 considerations per vulnerability (enforced by verifier)
 * - Non-prescriptive language only (may/can/could/is not documented/was not identified)
 * - No forbidden verbs: install, must, should, upgrade, deploy, implement
 * - All claims backed by parenthetical inline citations
 */

/**
 * Analytical Consideration
 * 
 * A reusable narrative block that:
 * - Has a unique ID (AC_EP_001, AC_CO_001, etc.)
 * - Provides 1-2 short paragraphs of non-prescriptive analysis
 * - Cites authoritative sources for all factual claims
 * - Focuses on decision-quality context, not commands
 */
export type AnalyticalConsideration = {
  id: string; // e.g., AC_EP_001
  heading?: string; // No numbering in output (new format)
  title?: string; // Legacy format
  narrative?: string; // Legacy single-paragraph format
  citations?: string[]; // Legacy citation list
  /** When true, this consideration is shown only when PRA/SLA toggle is enabled. */
  requiresPRA?: boolean;
  paragraphs?: Array<{
    text: string; // Narrative, non-prescriptive
    citations: string[]; // Citation keys from registry (e.g., 'FEMA_CGC', 'NFPA_110')
  }>;
};

/**
 * Hydrated consideration (runtime output)
 * 
 * Used in report composition to render considerations with formatted citations.
 */
export type HydratedConsideration = AnalyticalConsideration & {
  formatted_paragraphs: Array<{
    text_with_citations: string; // Text + inline citation string
  }>;
};
