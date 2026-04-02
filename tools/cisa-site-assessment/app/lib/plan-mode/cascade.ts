/**
 * PLAN Mode — Cascade control when capability_state = ABSENT.
 * Section VI: All checklist items auto-set checked=false, derived_unchecked=true.
 * OFCs MUST still be generated and attached to EACH checklist item.
 * UI: checklist items collapsed by default; parent shows one grouped finding.
 */

import type { PlanCapability } from "./types";

/**
 * When capability_state = ABSENT, set all checklist items to unchecked and derived_unchecked.
 * Does not add or remove OFCs; caller must ensure each item has OFCs (generation rule).
 */
export function applyAbsentCascade(cap: PlanCapability): void {
  if (cap.capability_state !== "ABSENT") return;
  for (const item of cap.checklist_items) {
    item.checked = false;
    item.derived_unchecked = true;
  }
}

/**
 * Return the single grouped finding text for an ABSENT capability (UI/reporting).
 */
export function getAbsentCapabilityFindingText(): string {
  return "Capability is absent; all required elements are missing by default.";
}

/**
 * Whether checklist items should be collapsed/suppressed by default in UI for this capability.
 */
export function shouldCollapseItemsByDefault(cap: PlanCapability): boolean {
  return cap.capability_state === "ABSENT";
}
