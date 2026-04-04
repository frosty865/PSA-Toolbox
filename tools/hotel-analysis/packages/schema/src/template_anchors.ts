/**
 * Authoritative list of DOCX template anchors. Used for validation and export.
 * All anchors must appear exactly once in the template.
 *
 * ADA REPORT v2 - February 2026
 * Part I: Executive Risk Posture, Snapshot Table, Section C Operational Capability Curves (CHART_* only), Synthesis, Priority Actions.
 * Part II – TECHNICAL ANNEX (federal-style): TABLE_DEPENDENCY_SUMMARY, STRUCTURAL_PROFILE_SUMMARY, VULNERABILITY_COUNT_SUMMARY,
 * VULNERABILITY_BLOCKS, CROSS_INFRA_ANALYSIS. Annex ends with CROSS-INFRASTRUCTURE ANALYSIS. Hard page break before Part II.
 */
export const REQUIRED_TEMPLATE_ANCHORS = [
  // Part I - Executive Dependency Risk Brief + Operational Capability Curves (charts only)
  '[[SNAPSHOT_POSTURE]]',
  '[[SNAPSHOT_SUMMARY]]',
  '[[SNAPSHOT_DRIVERS]]',
  '[[SNAPSHOT_MATRIX]]',
  '[[SNAPSHOT_CASCADE]]',
  '[[CHART_ELECTRIC_POWER]]',
  '[[CHART_COMMUNICATIONS]]',
  '[[CHART_INFORMATION_TECHNOLOGY]]',
  '[[CHART_WATER]]',
  '[[CHART_WASTEWATER]]',
  '[[SYNTHESIS]]',
  '[[PRIORITY_ACTIONS]]',

  // Part II – TECHNICAL ANNEX (federal-style anchor map; no MODELED DISRUPTION CURVES section)
  '[[TABLE_DEPENDENCY_SUMMARY]]',
  '[[STRUCTURAL_PROFILE_SUMMARY]]',
  '[[VULNERABILITY_COUNT_SUMMARY]]',
  '[[VULNERABILITY_BLOCKS]]',
  '[[CROSS_INFRA_ANALYSIS]]',
] as const;

export type TemplateAnchor = (typeof REQUIRED_TEMPLATE_ANCHORS)[number];

/**
 * Deprecated anchors removed in ADA Report v2 (do not add back to template).
 * Part II now uses TABLE_DEPENDENCY_SUMMARY, STRUCTURAL_PROFILE_SUMMARY, VULNERABILITY_*, CROSS_INFRA_ANALYSIS.
 */
export const LEGACY_ANCHORS_TO_REMOVE = [
  '[[TABLE_SUMMARY]]',
  '[[TABLE_VOFC]]',
  '[[DEP_SUMMARY_TABLE]]',
  '[[VULN_NARRATIVE]]',
  '[[VISUALIZATION_START]]',
  '[[EXECUTIVE_SUMMARY_START]]',
  '[[EXEC_SUMMARY]]',
  '[[APPENDIX_INDEX]]',
  '[[SAFE_*]]',
  '[[LEGACY_*]]',
  '[[INFRA_ENERGY]]',
  '[[INFRA_COMMS]]',
  '[[INFRA_IT]]',
  '[[INFRA_WATER]]',
  '[[INFRA_WASTEWATER]]',
] as const;
