/**
 * PLAN Mode Assessment Model — Authoritative.
 * Three-level structure: Capability (parent) → Checklist Items (atomic) → OFCs (only on unchecked).
 * See PLAN_MODE_MODEL.md for full spec. PSA scope only.
 */

export type {
  CapabilityState,
  PlanRollUpStatus,
  PlanChecklistItem,
  PlanOFC,
  PlanCapability,
  PlanModeAssessment,
} from "./types";

export {
  getApplicableItems,
  getCheckedApplicableCount,
  computeCompletionRatio,
  computeRollUpStatus,
  applyRollUpToCapability,
} from "./rollup";

export {
  applyAbsentCascade,
  getAbsentCapabilityFindingText,
  shouldCollapseItemsByDefault,
} from "./cascade";

export {
  validatePlanQualityGates,
  assertPlanQualityGates,
  type PlanQualityGateFailure,
} from "./qualityGates";
