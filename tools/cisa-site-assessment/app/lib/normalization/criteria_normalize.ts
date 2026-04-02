/**
 * Normalize criteria (question_text) for SCO generation.
 * - PLAN mode (EAP): "Plan element exists: …" or "Procedure exists: …" (see eap_criteria_prompt_rules.ts).
 * - OBJECT mode: no plan vocabulary; keep existence/YES-NO questions as-is (prefer no prefix).
 * Do NOT use checklist rewriter on criteria; never output "The topic is …".
 */

export type CriteriaNormalizeMode = "OBJECT" | "PLAN";

const LEADING_Q = /^(what|how|when|why|should)\b/i;

function clean(s: string): string {
  return (s || "").replace(/\?+$/g, "").trim().replace(/\s+/g, " ");
}

/** OBJECT: no "Plan element exists"; keep question form, ensure ends with ?. */
function questionToObjectCriterion(q: string): string {
  let s = (q || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  // Strip any existing plan/procedure prefix so we never emit it for OBJECT
  s = s.replace(/^plan element exists:\s*/i, "").replace(/^procedure exists:\s*/i, "").trim();
  if (!s) return "Measure exists?";
  if (!s.endsWith("?")) s = s.replace(/\.+$/, "").trim() + "?";
  return s;
}

/** PLAN (EAP): normalize to "Plan element exists: …" or "Procedure exists: …". */
function questionToPlanElement(q: string): string {
  const s = clean(q);

  let m = s.match(/^what is the first step to take if\s+(.+)$/i);
  if (m) return `Plan element exists: Initial actions for ${m[1].trim()}.`;

  m = s.match(/^should you respond if\s+(.+)$/i);
  if (m) return `Plan element exists: Response procedures for ${m[1].trim()}.`;

  m = s.match(/^what should you do if\s+(.+)$/i);
  if (m) return `Plan element exists: Response procedures for ${m[1].trim()}.`;

  m = s.match(/^what are the levels of\s+(.+)$/i);
  if (m) return `Plan element exists: Levels and definitions for ${m[1].trim()}.`;

  m = s.match(/^what are the different types of\s+(.+)$/i);
  if (m) return `Plan element exists: Types and examples of ${m[1].trim()}.`;

  if (LEADING_Q.test(s)) {
    const tail = s.replace(LEADING_Q, "").trim();
    return tail ? `Plan element exists: ${tail}.` : "Plan element exists: Required element.";
  }

  if (/^plan element exists:/i.test(s)) return s.endsWith(".") ? s : s + ".";
  if (/^procedure exists:/i.test(s)) return s.endsWith(".") ? s : s + ".";

  return `Plan element exists: ${s.endsWith(".") ? s.slice(0, -1) : s}.`;
}

/**
 * Normalize criteria by mode.
 * - mode "OBJECT": existence/YES-NO questions only; no "Plan element exists" (facility/measure/control phrasing allowed).
 * - mode "PLAN": "Plan element exists: …" / "Procedure exists: …".
 */
export function normalizeCriteria<T extends { question_text?: string; text?: string }>(
  criteria: T[],
  options?: { mode?: CriteriaNormalizeMode }
): T[] {
  const mode = (options?.mode ?? "PLAN") as CriteriaNormalizeMode;
  const normalizeOne = mode === "OBJECT" ? questionToObjectCriterion : questionToPlanElement;
  return (criteria || []).map((c) => {
    const raw = (c.question_text ?? c.text ?? "").trim();
    const normalized = raw ? normalizeOne(raw) : raw;
    if ("question_text" in c && c.question_text !== undefined) {
      return { ...c, question_text: normalized };
    }
    return { ...c, text: normalized };
  });
}

const TOPIC_PLACEHOLDER = /the topic is/i;
const PLAN_ELEMENT_PREFIX = /^plan element exists:/i;
const PROCEDURE_PREFIX = /^procedure exists:/i;
const OBJECT_QUESTION_SUFFIX = /\?$/;

/**
 * Validate criteria shape.
 * - PLAN: no "The topic is …", must start with "Plan element exists" or "Procedure exists".
 * - OBJECT: no "The topic is …", must be question form (end with ?); must NOT start with "Plan element exists".
 */
export function validateCriteriaShape(
  criteria: Array<{ question_text?: string; text?: string }>,
  options?: { mode?: CriteriaNormalizeMode }
): string[] {
  const mode = (options?.mode ?? "PLAN") as CriteriaNormalizeMode;
  const errs: string[] = [];
  for (const c of criteria || []) {
    const s = (c.question_text ?? c.text ?? "").trim();
    if (!s) continue;
    if (TOPIC_PLACEHOLDER.test(s)) {
      errs.push(`CRITERION_TOPIC_PLACEHOLDER: "${s.slice(0, 80)}…"`);
    }
    if (mode === "PLAN") {
      if (!PLAN_ELEMENT_PREFIX.test(s) && !PROCEDURE_PREFIX.test(s)) {
        errs.push(`CRITERION_NOT_PLAN_ELEMENT: "${s.slice(0, 80)}…"`);
      }
    } else {
      if (PLAN_ELEMENT_PREFIX.test(s)) {
        errs.push(`CRITERION_PLAN_PREFIX_FOR_OBJECT: "${s.slice(0, 80)}…"`);
      }
      if (!OBJECT_QUESTION_SUFFIX.test(s)) {
        errs.push(`CRITERION_NOT_QUESTION_FORM: "${s.slice(0, 80)}…"`);
      }
    }
  }
  return errs;
}
