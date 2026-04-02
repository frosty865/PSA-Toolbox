/**
 * PLAN Mode — Quality gates (Section IX). Hard failures: reject generation or apply if ANY violation.
 * No fallback; fail hard with diagnostic error.
 */

import type { PlanCapability, PlanChecklistItem } from "./types";

export type PlanQualityGateFailure =
  | { code: "CAPABILITY_NA"; message: "Capability has N/A"; capability_key: string }
  | { code: "PARENT_HAS_OFCS"; message: "Parent capability has OFCs"; capability_key: string }
  | { code: "CHECKED_ITEM_HAS_OFCS"; message: "Checked checklist item has OFCs"; item_key: string; capability_key: string }
  | { code: "UNCHECKED_ITEM_ZERO_OFCS"; message: "Unchecked checklist item has zero OFCs"; item_key: string; capability_key: string }
  | { code: "UNCHECKED_ITEM_TOO_MANY_OFCS"; message: "Unchecked item has more than 3 OFCs (cap at 3)"; item_key: string; capability_key: string }
  | { code: "ITEM_LACKS_RATIONALE"; message: "Checklist item lacks rationale"; item_key: string; capability_key: string }
  | { code: "RATIONALE_INSTRUCTIONAL"; message: "Rationale includes instructional or regulatory language"; item_key: string; capability_key: string }
  | { code: "ITEM_IS_QUESTION"; message: "Checklist items are questions or compound statements"; item_key: string; capability_key: string };

const INSTRUCTIONAL_REGULATORY_PATTERNS = [
  /\bshould\b/i,
  /\bmust\b/i,
  /\bbest practice\b/i,
  /\b(?:implement|follow|apply|conduct)\s+(?:these?\s+)?steps?\b/i,
  /\b(?:how to|step\s*\d|first\s*,|then\s*,)\b/i,
  /\b(?:CFR|OSHA|NFPA|ISO|NIST|regulation|regulatory|compliance)\b/i,
];

const QUESTION_PATTERNS = [
  /\?$/,
  /^(?:does|do|is|are|has|have|can|will|should|did)\s+/i,
  /\b(?:and\s+then|;\s*and\s+|\band\s+also\s+)/i, // compound
];

const MAX_OFCS_PER_UNCHECKED_ITEM = 3;

/**
 * Check rationale for instructional or regulatory language. Outcome-oriented only.
 */
function rationaleHasInstructionalOrRegulatory(rationale: string): boolean {
  const t = (rationale || "").trim();
  if (!t) return false;
  return INSTRUCTIONAL_REGULATORY_PATTERNS.some((re) => re.test(t));
}

/**
 * Check statement: must be declarative, not a question or compound.
 */
function statementIsQuestionOrCompound(statement: string): boolean {
  const t = (statement || "").trim();
  if (!t) return true;
  if (QUESTION_PATTERNS.some((re) => re.test(t))) return true;
  return false;
}

/**
 * Validate one checklist item. Returns first failure or null.
 */
function validateChecklistItem(
  item: PlanChecklistItem,
  capability_key: string
): PlanQualityGateFailure | null {
  if (!(item.rationale ?? "").trim()) {
    return { code: "ITEM_LACKS_RATIONALE", message: "Checklist item lacks rationale", item_key: item.item_key, capability_key };
  }
  if (rationaleHasInstructionalOrRegulatory(item.rationale)) {
    return { code: "RATIONALE_INSTRUCTIONAL", message: "Rationale includes instructional or regulatory language", item_key: item.item_key, capability_key };
  }
  if (statementIsQuestionOrCompound(item.statement)) {
    return { code: "ITEM_IS_QUESTION", message: "Checklist items are questions or compound statements", item_key: item.item_key, capability_key };
  }
  const ofcCount = (item.ofcs ?? []).length;
  if (item.checked && ofcCount > 0) {
    return { code: "CHECKED_ITEM_HAS_OFCS", message: "Checked checklist item has OFCs", item_key: item.item_key, capability_key };
  }
  if (!item.checked && !item.is_na && ofcCount === 0) {
    return { code: "UNCHECKED_ITEM_ZERO_OFCS", message: "Unchecked checklist item has zero OFCs", item_key: item.item_key, capability_key };
  }
  if (!item.checked && ofcCount > MAX_OFCS_PER_UNCHECKED_ITEM) {
    return { code: "UNCHECKED_ITEM_TOO_MANY_OFCS", message: "Unchecked item has more than 3 OFCs (cap at 3)", item_key: item.item_key, capability_key };
  }
  return null;
}

/**
 * Validate one capability. Capabilities never have N/A; never have OFCs at parent level.
 */
function validateCapability(cap: PlanCapability): PlanQualityGateFailure[] {
  const failures: PlanQualityGateFailure[] = [];
  if ((cap as unknown as { applicability?: string }).applicability === "N_A") {
    failures.push({ code: "CAPABILITY_NA", message: "Capability has N/A", capability_key: cap.capability_key });
  }
  const parentOfcs = (cap as unknown as { ofcs?: unknown[] }).ofcs;
  if (Array.isArray(parentOfcs) && parentOfcs.length > 0) {
    failures.push({ code: "PARENT_HAS_OFCS", message: "Parent capability has OFCs", capability_key: cap.capability_key });
  }
  for (const item of cap.checklist_items ?? []) {
    const f = validateChecklistItem(item, cap.capability_key);
    if (f) failures.push(f);
  }
  return failures;
}

/**
 * Run all PLAN quality gates on a list of capabilities.
 * Returns array of failures; empty array means valid.
 */
export function validatePlanQualityGates(capabilities: PlanCapability[]): PlanQualityGateFailure[] {
  const all: PlanQualityGateFailure[] = [];
  for (const cap of capabilities) {
    all.push(...validateCapability(cap));
  }
  return all;
}

/**
 * Run quality gates and throw with diagnostic payload if any failure.
 */
export function assertPlanQualityGates(capabilities: PlanCapability[]): void {
  const failures = validatePlanQualityGates(capabilities);
  if (failures.length > 0) {
    const msg = `PLAN quality gate failure: ${failures
      .map((f) => {
        const itemKey = "item_key" in f ? f.item_key : undefined;
        return `${f.code} (${f.capability_key ?? ""}${itemKey ? ` / ${itemKey}` : ""})`;
      })
      .join("; ")}`;
    const err = new Error(msg) as Error & { planQualityFailures: PlanQualityGateFailure[] };
    err.planQualityFailures = failures;
    throw err;
  }
}
