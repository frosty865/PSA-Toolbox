/**
 * Review & Export UI Copy
 * 
 * Centralized strings for the Review & Export feature.
 * Ensures consistency across all Review & Export components.
 * No legacy strings or deprecated UI copy.
 */

export const reviewExportCopy = {
  // Page heading
  pageTitle: 'Review & Export',
  pageDescription: 'Preview the narrative assessment output and export the report.',

  // Template status
  templateLabel: 'Template:',
  templateReady: 'Ready',
  templateMissingAnchors: 'Missing anchors',
  templateDetailsLink: 'Details',

  // Section headings
  executiveSummary: 'Executive Summary',
  crossDependencyCascadingRisk: 'Cross-Dependency & Cascading Risk',
  synthesisAnalysis: 'Synthesis & Analysis',
  methodologyAppendices: 'Methodology & Appendices',

  // Export buttons
  exportJsonButton: 'Export JSON (canonical)',
  exportDocxButton: 'Export report (DOCX)',
  exportImportJsonLink: 'Export / Import JSON',
  generatingReport: 'Generating report…',

  // Export status messages
  starting: 'Starting…',
  validating: 'Validating…',
  assembling: 'Assembling…',
  rendering: 'Rendering…',

  // Help & toggles
  showHelp: 'Show help',
  debugPreview: 'Debug preview',

  // Error messages
  reportGenerationFailed: 'Report generation failed',
  vofcGenerationFailed: 'VOFC generation failed',

  // Success states
  reportGenerationComplete: 'Report ready for download',

  // Retry buttons
  retryButton: 'Retry',

  // Accessibility & help text
  previewHelpText: 'These items are generated based on assessed dependency conditions and standardized thresholds. They are not findings or recommendations.',
  praSlaCaption: 'Rows with source "Priority restoration" are from PRA/SLA capture and are not from the VOFC library.',

  // Empty states (modern, not legacy)
  emptyStateNoFindings: 'No findings available for the current assessment.',
  emptyStateNextSteps: 'Complete the dependency assessment tabs to generate findings.',

  // Infrastructure sections (collapsible)
  infrastructureSections: {
    power: 'Electric Power Infrastructure',
    comms: 'Communications Infrastructure',
    it: 'Information Technology Infrastructure',
    water: 'Water Infrastructure',
    wastewater: 'Wastewater Infrastructure',
  },

  // Collapse/expand indicators (visual only, no text)
  expandIndicator: '▼',
  collapseIndicator: '▶',

  // No legacy strings
  // ❌ "Ensure the VOFC library is configured" — REMOVED
  // ❌ "Choose an item." — NOT USED
  // ❌ "Option for Consideration" (table header) — REMOVED
  // ❌ "Source" (as legacy column) — REMOVED
} as const;

/**
 * File naming format for JSON/DOCX exports
 */
export function getExportFilename(createdAt: string | undefined, extension: 'json' | 'docx'): string {
  const dateSlice = createdAt?.slice(0, 10) ?? 'export';
  const ext = extension === 'json' ? 'json' : 'docx';
  return `assessment-${dateSlice}.${ext}`;
}

/**
 * Status badge labels for assessment completion
 */
export const assessmentStatusCopy = {
  completionPercentage: 'Complete',
  dataEntryRequired: 'Data entry required',
  templateReady: 'Template ready',
  exportReady: 'Ready to export',
} as const;
