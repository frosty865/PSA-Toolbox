/**
 * PLAN Mode — Roll-up status and completion ratio.
 * Section II & VII: ABSENT → ABSENT; PRESENT+100% → COMPLETE; PRESENT+partial → PARTIAL; PRESENT+0% → DEFICIENT.
 * Partial scoring enabled ONLY when capability_state = PRESENT.
 */

import type { PlanRollUpStatus } from "./types";
import type { PlanCapability, PlanChecklistItem } from "./types";

/**
 * Compute applicable items (excludes N/A). Used for completion_ratio.
 */
export function getApplicableItems(items: PlanChecklistItem[]): PlanChecklistItem[] {
  return items.filter((i) => !i.is_na);
}

/**
 * Count checked applicable items.
 */
export function getCheckedApplicableCount(items: PlanChecklistItem[]): number {
  const applicable = getApplicableItems(items);
  return applicable.filter((i) => i.checked).length;
}

/**
 * completion_ratio = checked_items / applicable_items.
 * Only meaningful when capability_state = PRESENT. Returns 0 when no applicable items.
 */
export function computeCompletionRatio(items: PlanChecklistItem[]): number {
  const applicable = getApplicableItems(items);
  if (applicable.length === 0) return 0;
  const checked = applicable.filter((i) => i.checked).length;
  return checked / applicable.length;
}

/**
 * Roll-up status from capability_state and checklist.
 * ABSENT → ABSENT; PRESENT + 100% checked → COMPLETE; PRESENT + >0% and <100% → PARTIAL; PRESENT + 0% → DEFICIENT.
 */
export function computeRollUpStatus(
  capabilityState: "PRESENT" | "ABSENT",
  items: PlanChecklistItem[]
): PlanRollUpStatus {
  if (capabilityState === "ABSENT") return "ABSENT";
  const applicable = getApplicableItems(items);
  if (applicable.length === 0) return "DEFICIENT";
  const checked = applicable.filter((i) => i.checked).length;
  const ratio = checked / applicable.length;
  if (ratio >= 1) return "COMPLETE";
  if (ratio > 0) return "PARTIAL";
  return "DEFICIENT";
}

/**
 * Apply roll-up and completion_ratio to a capability (mutates in place).
 */
export function applyRollUpToCapability(cap: PlanCapability): void {
  cap.completion_ratio =
    cap.capability_state === "PRESENT" ? computeCompletionRatio(cap.checklist_items) : undefined;
  cap.roll_up_status = computeRollUpStatus(cap.capability_state, cap.checklist_items);
}
