/**
 * Convert extracted Active Assailant EAP elements to assessment shape:
 * one gate criterion + checklist items ("The plan includes: <section>.").
 * No OFCs for this module.
 */

import type { ActiveAssailantEapElement } from "./types";

/** Single gate question for Active Assailant EAP module. */
export const ACTIVE_ASSAILANT_EAP_GATE_QUESTION =
  "Does the facility have an Active Assailant Emergency Action Plan?";

/** Prompt shown above the section checklist. */
export const ACTIVE_ASSAILANT_EAP_CHECKLIST_PROMPT =
  "Does it include the following sections?";

/**
 * Checklist item text: declarative, lint-compliant ("The plan includes: ...").
 * No question marks.
 */
export function elementToChecklistItemText(title: string): string {
  const t = (title || "").trim();
  if (!t) return "The plan includes: (section).";
  return t.endsWith(".") ? `The plan includes: ${t}` : `The plan includes: ${t}.`;
}

export interface GateCriterionStub {
  criterion_key: string;
  question_text: string;
  title: string;
}

export interface ChecklistItemStub {
  element_key: string;
  text: string;
  order_index: number;
}

/**
 * Build assessment stubs for storage: one gate criterion + one checklist item per element.
 */
export function elementsToAssessmentStubs(
  elements: ActiveAssailantEapElement[]
): { gate: GateCriterionStub; checklistItems: ChecklistItemStub[] } {
  const gate: GateCriterionStub = {
    criterion_key: "AAEAP_GATE",
    question_text: ACTIVE_ASSAILANT_EAP_GATE_QUESTION,
    title: "Active Assailant EAP (gate)",
  };
  const checklistItems: ChecklistItemStub[] = (elements || []).map((el, i) => ({
    element_key: el.key,
    text: elementToChecklistItemText(el.title),
    order_index: i + 1,
  }));
  return { gate, checklistItems };
}
