/**
 * Deterministic rewrite of checklist items from question form to declarative.
 * Run before normalization lint so output conforms to CHECKLIST_NOT_DECLARATIVE / CHECKLIST_QUESTION rules.
 */

const LEADING_INTERROGATIVES = /^(what|how|when|why|should)\b/i;

function stripQuestionMark(s: string): string {
  return (s || "").replace(/\?+$/g, "").trim();
}

function ensurePeriod(s: string): string {
  const t = (s || "").trim();
  if (!t) return t;
  if (/[.!]$/.test(t)) return t;
  return t + ".";
}

/**
 * Rewrite common question patterns into declarative form.
 * Goal is compliance + reasonable meaning preservation, not perfect English.
 */
function rewriteQuestionToDeclarative(q: string): string {
  let s = stripQuestionMark(q).trim();

  s = s.replace(/\s+/g, " ");

  let m = s.match(/^what is the purpose of (this|the)\s+(.+)$/i);
  if (m) {
    const obj = m[2].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The purpose of the ${obj} is defined`);
  }

  m = s.match(/^what are the (different|various)\s+levels of\s+(.+)$/i);
  if (m) {
    const obj = m[2].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The levels of ${obj} are defined`);
  }

  m = s.match(/^what are the (different|various)\s+types of\s+(.+?)\s+events$/i);
  if (m) {
    const obj = m[2].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The types of ${obj} events are defined`);
  }

  m = s.match(/^what are the (different|various)\s+types of\s+(.+)$/i);
  if (m) {
    const obj = m[2].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The types of ${obj} are defined`);
  }

  m = s.match(/^what are the procedures for\s+(.+)$/i);
  if (m) {
    const obj = m[1].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The procedures for ${obj} are documented`);
  }

  m = s.match(/^how are\s+(.+?)\s+handled$/i);
  if (m) {
    const obj = m[1].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The procedures for handling ${obj} are documented`);
  }

  m = s.match(/^should\s+(.+)$/i);
  if (m) {
    const rest = m[1].trim().replace(/\.+$/g, "");
    return ensurePeriod(`The requirement is that ${rest}`);
  }

  if (LEADING_INTERROGATIVES.test(s.toLowerCase())) {
    const tail = s.replace(LEADING_INTERROGATIVES, "").trim();
    if (tail) return ensurePeriod(`The topic is ${tail}`);
    return "The requirement is defined.";
  }

  const hasThe = /^the\s+/i.test(s);
  const hasIsAre = /\s(is|are)\s/i.test(s);
  if (!hasThe || !hasIsAre) {
    return ensurePeriod(`The requirement is ${s.replace(/\.+$/g, "")}`);
  }

  return ensurePeriod(s);
}

/**
 * Rewrite checklist item strings to declarative form, then ensure trailing period.
 * Note: filters out empty strings; use rewriteChecklistItem for 1:1 mapping.
 */
export function rewriteChecklistItems(items: string[]): string[] {
  return (items || [])
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .map((x) =>
      /[?]$/.test(x) || LEADING_INTERROGATIVES.test(x) ? rewriteQuestionToDeclarative(x) : x
    )
    .map((x) => ensurePeriod(x));
}

/**
 * Rewrite a single checklist item (1:1, no length change). Use before lint when you need to preserve order.
 */
export function rewriteChecklistItem(text: string): string {
  const t = (text || "").trim();
  if (!t) return t;
  const rewritten = rewriteChecklistItems([t]);
  return rewritten[0] ?? ensurePeriod(t);
}
