/**
 * Optional "where should this anchor go?" guidance for each required template anchor.
 * Used by template:check and template-readiness UX when anchors are missing.
 *
 * ADA REPORT v2 - February 2026
 */
export const TEMPLATE_ANCHOR_GUIDANCE: Record<string, string> = {
  // Part I - Executive Risk Posture
  '[[SNAPSHOT_POSTURE]]':
    'Place where overall risk classification should appear (e.g., "ACCEPTABLE", "CONDITIONAL", "UNACCEPTABLE").',
  '[[SNAPSHOT_SUMMARY]]':
    'Place where one-sentence posture summary should appear.',
  '[[SNAPSHOT_DRIVERS]]':
    'Place where key risk drivers list should appear (3-6 items, deterministic order).',
  '[[SNAPSHOT_MATRIX]]':
    'Place where dependency snapshot table should appear (Sector | Time to Severe Impact | % Functional Loss | Backup Duration | Structural Posture).',
  '[[SNAPSHOT_CASCADE]]':
    'Place where cascading risk paragraph appears (only when cross-dependency enabled and edges exist; otherwise empty).',

  // Part I - Section C Operational Capability Curves (charts only; no sector subheadings or INFRA_* in Part I)
  '[[CHART_ELECTRIC_POWER]]':
    'Place in Section C (Operational Capability Curves) where Electric Power dependency chart should appear. Reporter inserts Heading 3 label + image.',
  '[[CHART_COMMUNICATIONS]]':
    'Place in Section C where Communications dependency chart should appear.',
  '[[CHART_INFORMATION_TECHNOLOGY]]':
    'Place in Section C where Information Technology dependency chart should appear.',
  '[[CHART_WATER]]':
    'Place in Section C where Water dependency chart should appear.',
  '[[CHART_WASTEWATER]]':
    'Place in Section C where Wastewater dependency chart should appear.',

  // Part I - Synthesis and Priority Actions
  '[[SYNTHESIS]]':
    'Place under Cross-Infrastructure Synthesis where cascade pathways, shared corridor exposure, redundancy illusion analysis should appear.',
  '[[PRIORITY_ACTIONS]]':
    'Place where ranked 1-5 cross-sector priority actions should appear.',

  // Part II – TECHNICAL ANNEX (federal-style; hard page break before Part II)
  '[[TABLE_DEPENDENCY_SUMMARY]]':
    'Place under DEPENDENCY SUMMARY heading. Dependency summary table (Category | Provider | Backup | Time to Impact | Recovery | Notes).',
  '[[STRUCTURAL_PROFILE_SUMMARY]]':
    'Place under STRUCTURAL RISK PROFILE. Short paragraph (1–3 sentences) summarizing structural sensitivity and main drivers.',
  '[[VULNERABILITY_COUNT_SUMMARY]]':
    'Place under INFRASTRUCTURE VULNERABILITIES. 2–3 lines: count of findings and number HIGH/ELEVATED/MODERATE.',
  '[[VULNERABILITY_BLOCKS]]':
    'Place under INFRASTRUCTURE VULNERABILITIES. Full rendered vulnerability blocks (federal-style format; options cap 4).',
  '[[CROSS_INFRA_ANALYSIS]]':
    'Place under CROSS-INFRASTRUCTURE ANALYSIS. Existing cross-infrastructure synthesis content. Annex ends here.',
};
