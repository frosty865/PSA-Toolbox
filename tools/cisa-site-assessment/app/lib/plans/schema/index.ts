/**
 * Schema-first plan pipeline: TOC-preferred derivation, versioned storage, deterministic OFC fallback.
 */

export type {
  PlanDeriveMethod,
  PlanConfidence,
  PlanSourceLocator,
  PlanSchemaElement,
  PlanSchemaSection,
  PlanSchemaSnapshot,
} from "./types";
export { planSchemaHash } from "./hash";
export {
  outlineToSnapshot,
  extractPdfOutline,
  isTocUsable,
  type TocOutlineEntry,
} from "./toc_parser";
export {
  extractNumberedHeadings,
  applyAntiDrift,
  headingsToSnapshot,
  type PageLines,
  type HeadingCandidate,
} from "./headings_parser";
export {
  derivePlanSchemaFromEngine,
  type PlanSchemaEngineMode,
  type DerivePlanSchemaOptions,
} from "./plan_schema_engine";
export {
  getActivePlanSchema,
  insertActivePlanSchema,
  ensureActivePlanSchema,
  type ActivePlanSchemaRow,
} from "./persist";
