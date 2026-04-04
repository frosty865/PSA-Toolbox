/**
 * Shared types for theme-based findings.
 * Replaces raw "one trigger = one vulnerability" with 2–3 themed findings per dependency.
 */

export type EvidenceItem = {
  question_id: string; // e.g., "CO-3", "IT-8"
  answer?: string | boolean; // optional raw value
};

export type ThemedFinding = {
  id: string; // stable theme id e.g., "COMMS_DIVERSITY"
  title: string; // short title
  narrative: string; // 1–3 sentences, plain language
  evidence: EvidenceItem[]; // contributing answers (IDs only + optional value)
  /** OFC text for this theme; one OFC per themed finding. */
  ofcText?: string;
  /** Human-readable reference lines (title + URL) from curated citation mapping. */
  references?: string[];
};

export type ThemeResolverInput = {
  category: 'ENERGY' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER';
  answers: Record<string, unknown>; // questionnaire answers map (E-*, CO-*, IT-*, etc.)
  categoryInput?: unknown; // Assessment.categories[code] (curve + agreements etc.)
  derived?: unknown; // optional existing derived (if present)
  praSlaEnabled?: boolean; // whether PRA/SLA module is enabled; defaults to false (safe)
};

export type ThemeResolver = (input: ThemeResolverInput) => ThemedFinding[];
