/**
 * Universal Normalization + Lint for Standard generate (PLAN and MEASURES/OBJECT).
 * Authoritative: no content may ship unless it passes this lint.
 * PSA scope only: physical security, governance, planning, operations.
 */

export type LintMode = "PLAN" | "MEASURES";

export interface LintResult {
  pass: boolean;
  violated_rule_ids: string[];
  samples: string[];
  failure_reason?: string;
}

/** Rule IDs for API response violated_rule_ids */
export const RULE_IDS = {
  FORBIDDEN_PHRASE: "FORBIDDEN_PHRASE",
  CHECKLIST_QUESTION: "CHECKLIST_QUESTION",
  CHECKLIST_NOT_DECLARATIVE: "CHECKLIST_NOT_DECLARATIVE",
  RATIONALE_INSTRUCTIONAL_VERB: "RATIONALE_INSTRUCTIONAL_VERB",
  OFC_NOT_CAPABILITY_PHRASE: "OFC_NOT_CAPABILITY_PHRASE",
  OFC_STEPS_OR_PROCEDURE: "OFC_STEPS_OR_PROCEDURE",
  PLAN_WHAT_SHOULD: "PLAN_WHAT_SHOULD",
  MEASURES_NUMERIC_OR_SPEC: "MEASURES_NUMERIC_OR_SPEC",
} as const;

/** Human-readable fix guidance for each rule (for API/UI). */
export const RULE_DESCRIPTIONS: Record<string, string> = {
  [RULE_IDS.FORBIDDEN_PHRASE]:
    "Remove forbidden phrases (e.g. 'what should', 'ensure that', 'best practice', 'in order to', 'must'). Use plain-language alternatives.",
  [RULE_IDS.CHECKLIST_QUESTION]:
    "Checklist items must be declarative, not questions. Avoid starting with What/How/When/Why/Should or ending with '?'.",
  [RULE_IDS.CHECKLIST_NOT_DECLARATIVE]:
    "Checklist items must be declarative: start with 'The …' or use ' is ' / ' are ' (e.g. 'The plan is …', 'Procedures are …').",
  [RULE_IDS.RATIONALE_INSTRUCTIONAL_VERB]:
    "Rationale must not use instructional verbs: install, train, conduct, deploy, implement, configure, procure, purchase. Describe capability, not steps.",
  [RULE_IDS.OFC_NOT_CAPABILITY_PHRASE]:
    "OFC must start with a capability phrase: 'establish and maintain', 'designate and maintain', 'document and maintain', or 'provide and maintain'.",
  [RULE_IDS.OFC_STEPS_OR_PROCEDURE]:
    "OFC must describe a capability, not steps/procedures or tools/vendors/design specs. Avoid 'step to', 'procedure for', 'tool', 'vendor'.",
  [RULE_IDS.PLAN_WHAT_SHOULD]:
    "Capability/checklist must not start with 'what should'. Use declarative phrasing.",
  [RULE_IDS.MEASURES_NUMERIC_OR_SPEC]:
    "Criteria must not contain numeric thresholds, distances, ratings, or design specs (e.g. feet, %, level 1–5, within N).",
};

/** Forbidden phrases (Section II). Case-insensitive; reject if ANY text contains. Word-boundary where needed. */
const FORBIDDEN_PHRASES: Array<{ phrase: string; wordBoundary?: boolean }> = [
  { phrase: "what should" },
  { phrase: "ensure that" },
  { phrase: "best practice" },
  { phrase: "in order to" },
  { phrase: "explicitly considered and managed" },
  { phrase: "considerations are identified" },
  { phrase: "there is a means to" },
  { phrase: "identified and documented" },
  { phrase: "regular basis" },
  // "must" as standalone obligation (allow "document" / "maintain")
  { phrase: " must ", wordBoundary: false },
  { phrase: " must.", wordBoundary: false },
  { phrase: " must,", wordBoundary: false },
];

/** Auto-normalization map (Section VII). Apply before re-lint. */
const AUTO_NORMALIZE: Array<{ from: RegExp; to: string }> = [
  { from: /\bis explicitly considered and managed\b/gi, to: "is addressed" },
  { from: /\bconsiderations are identified\b/gi, to: "is addressed" },
  { from: /\bthere is a means to\b/gi, to: "a capability exists to" },
  { from: /\bidentified and documented\b/gi, to: "defined" },
  { from: /\bto ensure\b/gi, to: "to support" },
];

/** Rationale: reject if contains these instructional verbs (Section IV). */
const RATIONALE_FORBIDDEN_VERBS = /\b(install|train|conduct|deploy|implement|configure|procure|purchase)\b/i;

/** OFC must start with one of these capability verb phrases (Section V). */
const OFC_CAPABILITY_PREFIXES = [
  "establish and maintain",
  "designate and maintain",
  "document and maintain",
  "provide and maintain",
];

/** OFC reject: steps/procedures or tools/vendors/design specs (Section V). Allow "system" in capability sense (e.g. notification system). */
const OFC_REJECT_PATTERNS = [
  /\b(step|procedure)\s+(to|for)\s+/i,
  /\b(tool|vendor|design\s+spec)\b/i,
];

/** MEASURES: reject numeric thresholds, distances, ratings, design specs (Section VI). */
const MEASURES_NUMERIC_SPEC = [
  /\b\d+\s*(ft|feet|m|meter|mile|km)\b/i,
  /\b(rating|score)\s*(of|:)\s*\d/i,
  /\b(level|tier)\s*[1-5]\b/i,
  /\b(percent|%)\s*\d+/i,
  /\bwithin\s+\d+/i,
];

const MAX_SAMPLES = 5;

function collectSamples(arr: string[], max: number = MAX_SAMPLES): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const t = (s || "").trim().slice(0, 120);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Apply auto-normalization to text (Section VII). Then caller must re-lint.
 */
export function autoNormalizeText(text: string): string {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const { from, to } of AUTO_NORMALIZE) {
    out = out.replace(from, to);
  }
  return out;
}

function checkForbiddenPhrases(text: string): { violated: boolean; phrase?: string } {
  const lower = text.toLowerCase();
  for (const { phrase } of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) return { violated: true, phrase };
  }
  return { violated: false };
}

function checkOfcStartsWithCapabilityPhrase(ofcText: string): boolean {
  const t = (ofcText || "").trim().toLowerCase();
  return OFC_CAPABILITY_PREFIXES.some((p) => t.startsWith(p));
}

function checkOfcStepsOrProcedure(ofcText: string): boolean {
  return OFC_REJECT_PATTERNS.some((re) => re.test(ofcText || ""));
}

function checkChecklistDeclarative(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  // Reject question starters (Section III)
  if (/^(what|how|when|why|should|do you|does the|is there|have you|can the)\s+/i.test(t)) return false;
  // Pass: starts with "The …", contains declarative " is " / " are ", or declarative "exists/exist"
  if (/^the\s+/i.test(t)) return true;
  if (/\s(is|are)\s/.test(t)) return true;
  if (/\b(exists|exist)\b/i.test(t)) return true;
  return false;
}

/**
 * Lint a single snippet (capability title, checklist item, rationale, or OFC).
 * Used by plan and measures linters.
 */
export function lintSnippet(
  text: string,
  role: "capability_title" | "checklist_item" | "rationale" | "ofc",
  mode: LintMode
): { violated_rule_ids: string[]; sample: string } {
  const violated: string[] = [];
  const t = (text || "").trim();
  const sample = t.slice(0, 120);

  if (!t) return { violated_rule_ids: violated, sample: "" };

  const normalized = autoNormalizeText(t);
  const forbidden = checkForbiddenPhrases(normalized);
  if (forbidden.violated) violated.push(RULE_IDS.FORBIDDEN_PHRASE);

  if (role === "capability_title" || role === "checklist_item") {
    if (t.toLowerCase().startsWith("what should")) violated.push(RULE_IDS.PLAN_WHAT_SHOULD);
    if (t.includes("?")) violated.push(RULE_IDS.CHECKLIST_QUESTION);
    if (role === "checklist_item" && !checkChecklistDeclarative(normalized)) {
      violated.push(RULE_IDS.CHECKLIST_NOT_DECLARATIVE);
    }
  }

  if (role === "rationale") {
    if (RATIONALE_FORBIDDEN_VERBS.test(normalized)) violated.push(RULE_IDS.RATIONALE_INSTRUCTIONAL_VERB);
  }

  if (role === "ofc") {
    if (!checkOfcStartsWithCapabilityPhrase(normalized)) violated.push(RULE_IDS.OFC_NOT_CAPABILITY_PHRASE);
    if (checkOfcStepsOrProcedure(normalized)) violated.push(RULE_IDS.OFC_STEPS_OR_PROCEDURE);
  }

  if (mode === "MEASURES" && (role === "checklist_item" || role === "capability_title")) {
    if (MEASURES_NUMERIC_SPEC.some((re) => re.test(normalized))) violated.push(RULE_IDS.MEASURES_NUMERIC_OR_SPEC);
  }

  return { violated_rule_ids: violated, sample };
}

/**
 * Lint PLAN output: capabilities (titles), checklist items (text + rationale), OFCs.
 * Run after auto-normalizing all text; this does NOT auto-normalize internally for bulk output.
 */
export function lintPlanOutput(
  capabilities: Array<{ title?: string }>,
  items: Array<{ text?: string; rationale?: string }>,
  ofcs: Array<{ ofc_text?: string }>
): LintResult {
  const violatedRuleIds = new Set<string>();
  const samples: string[] = [];

  for (const c of capabilities) {
    const title = (c.title ?? "").trim();
    if (!title) continue;
    const normalized = autoNormalizeText(title);
    const { violated_rule_ids, sample } = lintSnippet(normalized, "capability_title", "PLAN");
    violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (violated_rule_ids.length && sample) samples.push(sample);
    const forbidden = checkForbiddenPhrases(normalized);
    if (forbidden.violated) {
      violatedRuleIds.add(RULE_IDS.FORBIDDEN_PHRASE);
      if (sample && !samples.includes(sample)) samples.push(sample);
    }
  }

  for (const i of items) {
    const text = autoNormalizeText(i.text ?? "");
    const rationale = autoNormalizeText(i.rationale ?? "");
    const itemResult = lintSnippet(text, "checklist_item", "PLAN");
    itemResult.violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (itemResult.violated_rule_ids.length && itemResult.sample) samples.push(itemResult.sample);
    const ratResult = lintSnippet(rationale, "rationale", "PLAN");
    ratResult.violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (ratResult.violated_rule_ids.length && ratResult.sample) samples.push(ratResult.sample);
  }

  for (const o of ofcs) {
    const ofcText = autoNormalizeText(o.ofc_text ?? "");
    const ofcResult = lintSnippet(ofcText, "ofc", "PLAN");
    ofcResult.violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (ofcResult.violated_rule_ids.length && ofcResult.sample) samples.push(ofcResult.sample);
  }

  const violated = [...violatedRuleIds];
  const pass = violated.length === 0;
  return {
    pass,
    violated_rule_ids: violated,
    samples: collectSamples(samples),
    failure_reason: pass ? undefined : "NORMALIZATION_LINT_FAILED",
  };
}

/**
 * Lint MEASURES output: question_text (criteria) and ofc_text.
 * @deprecated Prefer normalizeCriteria + validateCriteriaShape for criteria, and lintMeasuresOfcsOnly for OFCs.
 */
export function lintMeasuresOutput(
  questions: Array<{ question_text?: string }>,
  ofcs: Array<{ ofc_text?: string }>
): LintResult {
  const violatedRuleIds = new Set<string>();
  const samples: string[] = [];

  for (const q of questions) {
    const text = autoNormalizeText(q.question_text ?? "");
    const result = lintSnippet(text, "checklist_item", "MEASURES");
    result.violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (result.violated_rule_ids.length && result.sample) samples.push(result.sample);
  }

  for (const o of ofcs) {
    const ofcText = autoNormalizeText(o.ofc_text ?? "");
    const result = lintSnippet(ofcText, "ofc", "MEASURES");
    result.violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (result.violated_rule_ids.length && result.sample) samples.push(result.sample);
  }

  const violated = [...violatedRuleIds];
  const pass = violated.length === 0;
  return {
    pass,
    violated_rule_ids: violated,
    samples: collectSamples(samples),
    failure_reason: pass ? undefined : "NORMALIZATION_LINT_FAILED",
  };
}

/**
 * Lint only OFCs (MEASURES). Use when criteria are normalized separately and must not get checklist rules.
 */
export function lintMeasuresOfcsOnly(ofcs: Array<{ ofc_text?: string }>): LintResult {
  const violatedRuleIds = new Set<string>();
  const samples: string[] = [];

  for (const o of ofcs) {
    const ofcText = autoNormalizeText(o.ofc_text ?? "");
    const result = lintSnippet(ofcText, "ofc", "MEASURES");
    result.violated_rule_ids.forEach((id) => violatedRuleIds.add(id));
    if (result.violated_rule_ids.length && result.sample) samples.push(result.sample);
  }

  const violated = [...violatedRuleIds];
  const pass = violated.length === 0;
  return {
    pass,
    violated_rule_ids: violated,
    samples: collectSamples(samples),
    failure_reason: pass ? undefined : "NORMALIZATION_LINT_FAILED",
  };
}

/**
 * Apply auto-normalization to PLAN output text fields in place.
 * Call before lintPlanOutput if generator output may contain fixable phrases.
 */
export function autoNormalizePlanOutput(
  capabilities: Array<{ title?: string }>,
  items: Array<{ text?: string; rationale?: string }>,
  ofcs: Array<{ ofc_text?: string }>
): void {
  for (const c of capabilities) {
    if (c.title) c.title = autoNormalizeText(c.title);
  }
  for (const i of items) {
    if (i.text) i.text = autoNormalizeText(i.text);
    if (i.rationale) i.rationale = autoNormalizeText(i.rationale);
  }
  for (const o of ofcs) {
    if (o.ofc_text) o.ofc_text = autoNormalizeText(o.ofc_text);
  }
}
