export type { CategoryInput, CategoryCode } from 'schema';
export {
  buildCurve,
  buildCurveWorkbookAligned,
  getCurveLegendLabels,
  hasBackupGenerator,
  type CurvePoint,
} from './curve';
export { buildSummary, type SummaryRow } from './summary';
export { loadVofcLibrary, getVofcLibraryPath } from './vofc/library';
export { generateVOFCs, type InjectedRule } from './vofc/generate';
export { assertMAPCompliance } from './vofc/map_guard';
export { explainCalibration } from './vofc/explain_calibration';
export { assertExportReady, REQUIRED_ANCHORS } from './export/export_guard';
export {
  fullAssessmentForExport,
  epNoBackupShortTtiHighLoss,
  waterLongRecovery,
  criticalProductsSingleSource,
} from './vofc/__fixtures__/assessments';
export { MINIMAL_VOFC_RULES } from './vofc/__fixtures__/rules_minimal';
