export type QuestionQualityResult = { ok: true } | { ok: false; reasons: string[] };

const BANNED_PHRASES = [
  "is the facility able to",
  "can the facility",
  "how does the facility",
  "identify and respond to behavior",
  "interpersonal violence",
  "targeted grievance",
  "domestic spillover",
  "weapon display",
  "protest civil disturbance",
];

export function validateExistenceQuestion(q: string): QuestionQualityResult {
  const reasons: string[] = [];
  const s = (q || "").trim();

  if (!s) reasons.push("empty");
  if (s.length < 12) reasons.push("too_short");
  if (s.length > 180) reasons.push("too_long");
  if (!s.endsWith("?")) reasons.push("missing_question_mark");

  const lower = s.toLowerCase();
  for (const p of BANNED_PHRASES) {
    if (lower.includes(p)) reasons.push(`banned_phrase:${p}`);
  }

  // Must be existence-only patterns
  const allowedStarts = [
    "does the facility have",
    "is there a",
    "are there",
    "are procedures defined",
    "is a documented",
    "are roles and responsibilities defined",
    "is a capability in place",
    "do facility",
    "are facility",
    "has the facility",
  ];
  if (!allowedStarts.some(a => lower.startsWith(a))) {
    reasons.push("not_existence_only_start");
  }

  // Avoid vague verbs (soft filter)
  if (/\bimprove\b|\benhance\b|\boptimize\b/.test(lower)) reasons.push("vague_improvement_language");

  return reasons.length ? { ok: false, reasons } : { ok: true };
}
