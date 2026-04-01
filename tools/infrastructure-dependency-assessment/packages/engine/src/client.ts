/**
 * Client-safe exports only (no Node.js fs/path or xlsx).
 * Use this from client components; use the main entry from API routes.
 */
export type { CategoryInput, CategoryCode } from 'schema';
export {
  buildCurve,
  buildCurveWorkbookAligned,
  getCurveLegendLabels,
  hasBackupGenerator,
  type CurvePoint,
} from './curve';
export { explainCalibration } from './vofc/explain_calibration';
export { generateVOFCsFromEntries } from './vofc/generate_core';
export type { InternalVofcEntry } from './vofc/library_types';
