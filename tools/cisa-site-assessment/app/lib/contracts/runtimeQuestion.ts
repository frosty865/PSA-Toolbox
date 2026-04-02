/**
 * Runtime Question Contract (Meaning Layer Reset)
 *
 * /api/runtime/questions must emit only these shapes. No legacy intent.
 * discipline_subtype_id is the only binding for Help; null allowed when question has no subtype.
 */

const ALLOWED_KEYS = new Set([
  "canon_id",
  "question_code",
  "discipline_code",
  "subtype_code",
  "discipline_subtype_id",
  "question_text",
  "response_enum",
  "layer",
  "subtype_overview",
  "reference_implementation",
]);

const FORBIDDEN_KEY_PATTERNS = [
  /^intent_object$/i,
  /^what_counts_as_yes$/i,
  /^what-counts-as-yes$/i,
  /^evidence/i,
  /^tips$/i,
  /^tip$/i,
  /\btips\b/i,
  /enforcement/i,
  /^field_tip/i,
  /^field_tips/i,
  /^typical_evidence$/i,
  /^what_does_not_count$/i,
  /^meaning_text$/i,
];

const _RESPONSE_ENUM_VALID = ["YES", "NO", "N_A"];
void _RESPONSE_ENUM_VALID;

function isForbiddenKey(k: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((re) => re.test(k));
}

function checkResponseEnum(arr: unknown): boolean {
  if (!Array.isArray(arr) || arr.length !== 3) return false;
  const a = arr as string[];
  return (
    (a[0] === "YES" || a[0] === "NO" || a[0] === "N_A") &&
    (a[1] === "YES" || a[1] === "NO" || a[1] === "N_A") &&
    (a[2] === "YES" || a[2] === "NO" || a[2] === "N_A")
  );
}

/**
 * Validates the questions array from /api/runtime/questions.
 * - Required: canon_id, question_text, response_enum, discipline_subtype_id (null allowed).
 * - No extra keys beyond ALLOWED_KEYS.
 * - No forbidden keys (intent_object, what_counts_as_yes, evidence*, tips*, enforcement*, field*).
 *
 * @param data - { questions: unknown[] } or unknown[] (the list to validate)
 * @throws Error with offending keys or validation reason
 */
export function assertRuntimeQuestionList(data: unknown): void {
  let list: unknown[];

  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object" && "questions" in data && Array.isArray((data as { questions: unknown }).questions)) {
    list = (data as { questions: unknown[] }).questions;
  } else {
    throw new Error("[runtimeQuestion] assertRuntimeQuestionList: expected array or { questions: array }");
  }

  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (!o || typeof o !== "object") {
      throw new Error(`[runtimeQuestion] questions[${i}]: expected object, got ${typeof o}`);
    }

    const obj = o as Record<string, unknown>;

    if (typeof obj.canon_id !== "string") {
      throw new Error(`[runtimeQuestion] questions[${i}]: required canon_id (string)`);
    }
    if (typeof obj.question_text !== "string") {
      throw new Error(`[runtimeQuestion] questions[${i}]: required question_text (string)`);
    }
    if (!checkResponseEnum(obj.response_enum)) {
      throw new Error(`[runtimeQuestion] questions[${i}]: required response_enum ['YES','NO','N_A']`);
    }
    if (!("discipline_subtype_id" in obj)) {
      throw new Error(`[runtimeQuestion] questions[${i}]: required discipline_subtype_id (string | null)`);
    }
    const dsid = obj.discipline_subtype_id;
    if (dsid !== null && dsid !== undefined && typeof dsid !== "string") {
      throw new Error(`[runtimeQuestion] questions[${i}]: discipline_subtype_id must be string | null`);
    }

    const keys = Object.keys(obj);
    const extra: string[] = [];
    const forbidden: string[] = [];

    for (const k of keys) {
      if (!ALLOWED_KEYS.has(k)) {
        extra.push(k);
      }
      if (isForbiddenKey(k)) {
        forbidden.push(k);
      }
    }

    if (forbidden.length > 0) {
      throw new Error(`[runtimeQuestion] questions[${i}]: forbidden keys: ${forbidden.join(", ")}`);
    }
    if (extra.length > 0) {
      throw new Error(`[runtimeQuestion] questions[${i}]: extra keys not allowed: ${extra.join(", ")}`);
    }
  }
}
