/**
 * Pre-lint sanitizer for MEASURES: rewrite ONLY explicit checklist fields to declarative form.
 * Do NOT touch criteria / question_text (use criteria_normalize for those).
 */

import { rewriteChecklistItems } from "./checklist_rewrite";

const CHECKLIST_FIELD_NAMES = new Set<string>([
  "checklist",
  "checklist_items",
  "items",
  "measures_checklist",
  "implementation_checklist",
  "validation_checklist",
  "readiness_checklist",
]);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function rewriteChecklistFieldsInPlace(obj: unknown): void {
  if (obj == null || typeof obj !== "object") return;

  const o = obj as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const v = o[key];

    if (CHECKLIST_FIELD_NAMES.has(key) && isStringArray(v)) {
      o[key] = rewriteChecklistItems(v);
      continue;
    }

    if (CHECKLIST_FIELD_NAMES.has(key) && typeof v === "string") {
      const lines = v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      o[key] = rewriteChecklistItems(lines).join("\n");
      continue;
    }

    if (v != null && typeof v === "object") {
      rewriteChecklistFieldsInPlace(v);
    }
  }
}

/**
 * Rewrite only explicit checklist-named fields. Do NOT rewrite criteria/question_text.
 */
export function sanitizeMeasuresBeforeLint(measures: unknown): unknown {
  if (measures == null || typeof measures !== "object") return measures;
  const cloned = Array.isArray(measures) ? [...measures] : { ...measures };
  rewriteChecklistFieldsInPlace(cloned);
  return cloned;
}
