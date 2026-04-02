/**
 * Deterministic rewrite of baseline existence questions using intent only.
 * No model calls. Pattern selection + light phrase extraction.
 * Used by tools/rewrite_baseline_questions.ts.
 */

import { getDisciplinePattern } from "./discipline_language_patterns";

const MAX_LENGTH = 180;
const FORBIDDEN_TERMS = [
  /\bcapability\b/i,
  /\bimplemented\b/i,
  /\bprogrammatic\b/i,
  /\boperationalized\b/i,
];

export type RewriteBasisSource =
  | "meaning_text"
  | "clarification"
  | "what_right_looks_like"
  | "fallback";

export type SkipReason =
  | "same_text"
  | "empty_intent"
  | "forbidden_terms"
  | "too_long"
  | "invalid_output";

export type RewriteStatus =
  | {
      status: "UPDATED";
      rewritten: string;
      intentSource: RewriteBasisSource;
      intentSnippet: string;
    }
  | {
      status: "SKIPPED";
      rewritten: string;
      intentSource: RewriteBasisSource;
      intentSnippet: string;
      reason: SkipReason;
    };

export interface RewriteBasis {
  source: RewriteBasisSource;
  snippet: string;
}

export interface RewriteBaselineQuestionArgs {
  /** Current question_text from baseline_spines_runtime */
  current_question_text: string;
  /** Intent string (authority order already applied by caller) */
  intent_text: string;
  /** Source of intent (caller must set from authority order) */
  intent_source: RewriteBasisSource;
  /** First 160 chars of the chosen intent source */
  intent_snippet: string;
  /** Discipline code for doctrine pattern (optional; used when intent_source === "fallback") */
  discipline_code?: string | null;
  /** Subtype code; when present with fallback, discipline pattern may apply */
  subtype_code?: string | null;
}

export interface RewriteBaselineQuestionResult {
  rewritten: string;
  basis: RewriteBasis;
}

/**
 * Returns true if the text contains any forbidden pattern.
 */
export function containsForbiddenPattern(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return FORBIDDEN_TERMS.some((re) => re.test(t));
}

/**
 * Normalize for equality check: trim, collapse whitespace, case-insensitive.
 */
function normalizeForCompare(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Collapse spaces, trim.
 */
function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Add '?' if missing at end.
 */
function ensureQuestionMark(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (t.endsWith("?")) return t;
  return t.replace(/[.!]$/, "") + "?";
}

/**
 * Normalize for fallback: trim, collapse spaces, ensure single trailing ?.
 */
function normalizeFallback(s: string): string {
  return ensureQuestionMark(normalizeWhitespace(s));
}

const MIN_FALLBACK_LENGTH = 12;

/**
 * Deterministic fallback rewrite when intent is empty or candidate would be current text.
 * Removes/rewrites "capability" and "implemented" so output can pass forbidden-term check.
 * Returns transformed string; if RULE E yields too short a result, returns empty to signal invalid_output.
 */
function applyFallbackTransforms(current: string): string {
  const raw = normalizeWhitespace(current);
  if (!raw) return raw;

  // RULE A — "Is a/an <X> capability implemented?"
  const ruleA = /^is\s+(a|an)\s+(.+?)\s+capability\s+implemented\??$/i.exec(raw);
  if (ruleA) {
    const x = ruleA[2].trim();
    const cap = x.length > 0 ? x[0].toUpperCase() + x.slice(1) : x;
    return `Is there ${cap} in place?`;
  }

  // RULE B — "Is <X> capability implemented?"
  const ruleB = /^is\s+(.+?)\s+capability\s+implemented\??$/i.exec(raw);
  if (ruleB) {
    const x = ruleB[1].trim();
    const cap = x.length > 0 ? x[0].toUpperCase() + x.slice(1) : x;
    return `Is there ${cap} in place?`;
  }

  // RULE C — "Is there a defined <X> capability for the facility?"
  const ruleC = /^is\s+there\s+a\s+defined\s+(.+?)\s+capability\s+for\s+the\s+facility\??$/i.exec(raw);
  if (ruleC) {
    const x = ruleC[1].trim();
    const cap = x.length > 0 ? x[0].toUpperCase() + x.slice(1) : x;
    return `Is there an established ${cap} approach for the facility?`;
  }

  // RULE D — "Is there a/an <X> capability?"
  const ruleD = /^is\s+there\s+(a|an)\s+(.+?)\s+capability\??$/i.exec(raw);
  if (ruleD) {
    const x = ruleD[2].trim();
    const cap = x.length > 0 ? x[0].toUpperCase() + x.slice(1) : x;
    return `Is there an established ${cap} process?`;
  }

  // RULE E — Generic cleanup
  let e = raw;
  e = e.replace(/\bcapability\s+implemented\b/gi, "in place");
  e = e.replace(/\bcapability\b/gi, "");
  e = e.replace(/\bimplemented\b/gi, "");
  e = normalizeWhitespace(e);
  e = ensureQuestionMark(e);
  if (e.length < MIN_FALLBACK_LENGTH) return "";
  return e;
}

function isQuestionLike(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.endsWith("?")) return true;
  if (t.length <= 80 && /\b(is|are|do|does|can|has|have)\b/i.test(t)) return true;
  return false;
}

/**
 * Extract a short phrase from intent for filling a pattern slot.
 * Prefer first 12 words, strip trailing period, capitalize first letter.
 */
function extractPhrase(intent: string, maxWords: number = 12): string {
  const trimmed = intent.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).slice(0, maxWords);
  let phrase = words.join(" ").replace(/[.,;:]$/, "").trim();
  if (phrase && phrase[0]) {
    phrase = phrase[0].toUpperCase() + phrase.slice(1);
  }
  return phrase;
}

/**
 * Try to extract "X" from patterns like "procedure(s) for X", "process to X", "method exists to X".
 */
function extractProcedureOrProcessTopic(intent: string): string | null {
  const m =
    /(?:procedure(?:s)?\s+for|process\s+to|method\s+exists\s+to|defined\s+method\s+exists\s+to)\s+(.+?)(?:\.|$)/i.exec(
      intent
    ) ||
    /(?:process|procedure(?:s)?)\s+for\s+(.+?)(?:\.|$)/i.exec(intent);
  if (m) {
    const phrase = m[1].trim().replace(/\s+/g, " ");
    if (phrase.length > 5 && phrase.length < 100) {
      return phrase[0].toUpperCase() + phrase.slice(1);
    }
  }
  return null;
}

/**
 * Try to extract designated thing: "designated X", "X area(s)", "X location(s)", "assembly area", etc.
 */
function extractDesignatedThing(intent: string): string | null {
  const m =
    /designated\s+([^.?]+?)(?:\.|$)/i.exec(intent) ||
    /(assembly\s+areas?|evacuation\s+routes?|shelter[- ]?in[- ]?place\s+(?:locations?|areas?)|(?:primary\s+)?egress\s+routes?)/i.exec(
      intent
    ) ||
    /(\w+(?:\s+\w+)?)\s+(?:areas?|locations?)\s+(?:within|in|at)/i.exec(intent);
  if (m) {
    const phrase = m[1].trim().replace(/\s+/g, " ");
    if (phrase.length > 2 && phrase.length < 80) {
      return phrase[0].toUpperCase() + phrase.slice(1);
    }
  }
  return null;
}

/**
 * Try to extract action for "Can occupants X when required?"
 */
function extractAbilityAction(intent: string): string | null {
  const m =
    /(?:can|ability\s+to)\s+(.+?)(?:\s+when\s+required|\.|$)/i.exec(intent) ||
    /(?:occupants?|staff|personnel)\s+(?:can\s+)?(.+?)(?:\s+when\s+required|\.|$)/i.exec(
      intent
    );
  if (m) {
    let phrase = m[1].trim().replace(/\s+/g, " ");
    if (phrase.length > 3 && phrase.length < 80) {
      phrase = phrase[0].toLowerCase() + phrase.slice(1);
      return phrase;
    }
  }
  return null;
}

function capLength(s: string): string {
  if (s.length <= MAX_LENGTH) return s;
  let t = s.slice(0, MAX_LENGTH - 1).trim();
  const last = t.search(/\s+\S+$/);
  if (last > 0) t = t.slice(0, last);
  if (!t.endsWith("?")) t += "?";
  return t;
}

/**
 * Fallback candidate: apply deterministic transforms to current text (removes capability/implemented).
 * Returns "" when RULE E yields too short (caller will treat as invalid_output).
 */
function fallbackRewritten(current_question_text: string): string {
  const transformed = applyFallbackTransforms(current_question_text);
  if (!transformed.trim()) return "";
  return capLength(ensureQuestionMark(normalizeWhitespace(transformed)));
}

/**
 * When intentSource === "fallback" and discipline is known: align to doctrine pattern if safe.
 * Only applies to "Is there X in place?" form. Does not add "designated", adjectives, or change existence.
 */
function applyDisciplinePattern(
  rewritten: string,
  disciplineCode: string | null | undefined,
  originalText: string
): string {
  if (!disciplineCode?.trim()) return rewritten;
  const pattern = getDisciplinePattern(disciplineCode);
  if (!pattern) return rewritten;

  const match = /^is\s+there\s+(.+?)\s+in\s+place\??$/i.exec(normalizeWhitespace(rewritten));
  if (!match) return rewritten;

  const nounPhrase = match[1].trim();
  if (!nounPhrase) return rewritten;

  const nounLower = nounPhrase.toLowerCase();
  const isPlural =
    (nounLower.endsWith("s") && !nounLower.endsWith("ss")) || /\band\b/i.test(nounPhrase);
  const subject = nounLower;
  const verbPhrase = pattern.defaultVerb;
  const candidate = isPlural
    ? `Are ${subject} ${verbPhrase}?`
    : `Is ${subject} ${verbPhrase}?`;
  const capped = candidate[0].toUpperCase() + candidate.slice(1);

  if (capped.length > MAX_LENGTH || containsForbiddenPattern(capped)) return rewritten;
  if (!/designated|identified/i.test(originalText) && /designated|identified/i.test(capped))
    return rewritten;
  return capLength(capped);
}

/**
 * Compute candidate rewritten text from intent (or fallback). Does not set status/skip reason.
 * Forbidden-term check is NOT applied to input; only the final rewritten output is checked by caller.
 */
function computeCandidate(
  current_question_text: string,
  intent: string
): string {
  const currentNorm = current_question_text.trim().replace(/\s+/g, " ");
  const fallbackResult = () => fallbackRewritten(current_question_text);

  if (!intent) return fallbackResult();
  if (intent === currentNorm || intent === current_question_text.trim()) return fallbackResult();

  // 1) Procedures / process pattern (forbidden check only on final rewritten output)
  const procedureTopic = extractProcedureOrProcessTopic(intent);
  if (procedureTopic) {
    const withProcess = `Is there an established process to ${procedureTopic}?`;
    if (withProcess.length <= MAX_LENGTH) return withProcess;
    const withProcedures = `Are there documented procedures for ${procedureTopic}?`;
    if (withProcedures.length <= MAX_LENGTH) return withProcedures;
  }

  if (/\b(?:procedure|process|method|defined)\b/i.test(intent)) {
    const topic = procedureTopic || extractPhrase(intent, 8);
    if (topic) {
      const q = `Are there documented procedures for ${topic}?`;
      if (q.length <= MAX_LENGTH) return capLength(q);
    }
  }

  // 2) Designated locations/areas
  const designated = extractDesignatedThing(intent);
  if (designated) {
    const q = `Are there designated ${designated} within the facility?`;
    if (q.length <= MAX_LENGTH) return q;
  }

  if (
    /\b(?:designated|area|location|shelter|evacuation|assembly|egress|route)\b/i.test(intent)
  ) {
    const thing = designated || extractPhrase(intent, 6);
    if (thing) {
      const q = `Are there designated ${thing} within the facility?`;
      if (q.length <= MAX_LENGTH) return capLength(q);
    }
  }

  // 3) Ability pattern
  const action = extractAbilityAction(intent);
  if (action) {
    const q = `Can occupants ${action} when required?`;
    if (q.length <= MAX_LENGTH) return q;
  }

  if (/\b(?:can|ability|when required)\b/i.test(intent)) {
    const act = action || extractPhrase(intent, 6);
    if (act) {
      const q = `Can occupants ${act} when required?`;
      if (q.length <= MAX_LENGTH) return capLength(q);
    }
  }

  // 4) Generic existence from first sentence of intent
  const genericPhrase = extractPhrase(intent, 10);
  if (genericPhrase) {
    const q = `Is there an established process for ${genericPhrase}?`;
    if (q.length <= MAX_LENGTH) return capLength(q);
  }

  return fallbackResult();
}

/**
 * Rewrite baseline question; returns structured status (UPDATED or SKIPPED with reason).
 * Always returns a candidate "rewritten" string.
 */
export function rewriteBaselineQuestion(args: RewriteBaselineQuestionArgs): RewriteStatus {
  const {
    current_question_text,
    intent_text,
    intent_source,
    intent_snippet,
    discipline_code,
    subtype_code,
  } = args;
  const intent = intent_text.trim();
  let rewritten = computeCandidate(current_question_text, intent);

  if (
    intent_source === "fallback" &&
    subtype_code != null &&
    subtype_code !== "" &&
    subtype_code.toUpperCase() !== "N/A"
  ) {
    rewritten = applyDisciplinePattern(rewritten, discipline_code, current_question_text);
  }

  const normalizedRewritten = normalizeForCompare(rewritten);
  const normalizedCurrent = normalizeForCompare(current_question_text);

  // invalid_output: blank or not question-like
  if (!rewritten.trim()) {
    return {
      status: "SKIPPED",
      rewritten: capLength(normalizeFallback(current_question_text)),
      intentSource: intent_source,
      intentSnippet: intent_snippet,
      reason: "invalid_output",
    };
  }
  if (!isQuestionLike(rewritten)) {
    return {
      status: "SKIPPED",
      rewritten,
      intentSource: intent_source,
      intentSnippet: intent_snippet,
      reason: "invalid_output",
    };
  }

  // forbidden_terms
  if (containsForbiddenPattern(rewritten)) {
    return {
      status: "SKIPPED",
      rewritten,
      intentSource: intent_source,
      intentSnippet: intent_snippet,
      reason: "forbidden_terms",
    };
  }

  // too_long
  if (rewritten.length > MAX_LENGTH) {
    return {
      status: "SKIPPED",
      rewritten: capLength(rewritten),
      intentSource: intent_source,
      intentSnippet: intent_snippet,
      reason: "too_long",
    };
  }

  // same_text or empty_intent (intent empty and result equals current)
  if (normalizedRewritten === normalizedCurrent) {
    return {
      status: "SKIPPED",
      rewritten,
      intentSource: intent_source,
      intentSnippet: intent_snippet,
      reason: intent === "" ? "empty_intent" : "same_text",
    };
  }

  return {
    status: "UPDATED",
    rewritten,
    intentSource: intent_source,
    intentSnippet: intent_snippet,
  };
}

/**
 * Legacy result shape for callers that only need rewritten + basis.
 */
export function rewriteBaselineQuestionLegacy(
  args: Omit<RewriteBaselineQuestionArgs, "intent_source" | "intent_snippet"> & {
    intent_source?: RewriteBasisSource;
    intent_snippet?: string;
  }
): RewriteBaselineQuestionResult {
  const full: RewriteBaselineQuestionArgs = {
    ...args,
    intent_source: args.intent_source ?? "fallback",
    intent_snippet: args.intent_snippet ?? args.intent_text.slice(0, 160),
  };
  const out = rewriteBaselineQuestion(full);
  return {
    rewritten: out.rewritten,
    basis: { source: out.intentSource, snippet: out.intentSnippet },
  };
}
