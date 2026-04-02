/**
 * PLAN Mode Assessment Model — TypeScript types.
 * Authoritative structure: Capability (parent) → Checklist Items (atomic) → OFCs (only on unchecked).
 * See PLAN_MODE_MODEL.md for full spec. PSA scope only; no regulatory/cyber language.
 */

/** Capability state: PRESENT = plan element exists; ABSENT = does not exist. Capabilities NEVER have N/A. */
export type CapabilityState = "PRESENT" | "ABSENT";

/**
 * Roll-up status (computed from capability_state + checklist).
 * ABSENT → ABSENT; PRESENT+100% checked → COMPLETE; PRESENT+partial → PARTIAL; PRESENT+0% → DEFICIENT.
 */
export type PlanRollUpStatus = "ABSENT" | "COMPLETE" | "PARTIAL" | "DEFICIENT";

/**
 * Checklist item: binary checked/unchecked, declarative (not a question).
 * N/A only in rare context-specific cases; N/A items do not count toward completion ratio.
 */
export interface PlanChecklistItem {
  /** Stable key (e.g. Q001_01). */
  item_key: string;
  /** Declarative statement — ONE atomic requirement, no conjunctions. */
  statement: string;
  /** Mandatory: 1–2 sentences, outcome-oriented; why element exists, function during incident. No instructions/regulatory. */
  rationale: string;
  /** Binary: true = condition met. */
  checked: boolean;
  /** True when item is N/A (rare). Excluded from completion_ratio. */
  is_na?: boolean;
  /** When capability_state=ABSENT, all items auto unchecked; UI may show derived_unchecked. */
  derived_unchecked?: boolean;
  /** 1–3 OFCs; ONLY on unchecked items. Empty when checked or N/A. */
  ofcs: PlanOFC[];
  order_index: number;
}

/**
 * OFC: option for consideration — WHAT capability should exist. Attached ONLY to unchecked checklist items.
 * 1–3 OFCs per unchecked item. No HOW, steps, technologies, vendors, costs, timelines.
 */
export interface PlanOFC {
  ofc_id: string;
  ofc_text: string;
  order_index: number;
}

/**
 * Capability (parent). Never has N/A; never has OFCs attached directly.
 * Children = checklist items; OFCs only on unchecked items.
 */
export interface PlanCapability {
  /** Stable key (e.g. CAP_001 or criterion_key). */
  capability_key: string;
  /** Display title (e.g. Emergency Communications). */
  title: string;
  capability_state: CapabilityState;
  /** 3–8 checklist items per capability; each with mandatory rationale. */
  checklist_items: PlanChecklistItem[];
  /** Computed: completion_ratio → ABSENT | COMPLETE | PARTIAL | DEFICIENT. */
  roll_up_status: PlanRollUpStatus;
  /** completion_ratio = checked_items / applicable_items (excludes N/A). Only when capability_state=PRESENT. */
  completion_ratio?: number;
  order_index: number;
}

/** Full PLAN-mode assessment: list of capabilities. */
export interface PlanModeAssessment {
  standard_key: string;
  capabilities: PlanCapability[];
}
