/**
 * VOFC language normalization and validation.
 * Aligns with map_doctrine NORMALIZATION rules: neutral, observational language only.
 */

import type { VOFC } from "schema";

/** Forbidden phrases (case-insensitive). VOFC must not contain these after auto-fix. */
const FORBIDDEN_PHRASES = [
  "should",
  "must",
  "recommend",
  "install",
  "purchase",
  "deploy",
  "ensure",
  "$",
  "cost",
  "budget",
  "vendor",
] as const;

/** Auto-fix: replace prescriptive phrasing with neutral. Applied before forbidden check. */
const AUTO_FIXES: [RegExp, string][] = [
  [/\bshould\s+consider\b/gi, "may consider"],
  [/\brecommended\b/gi, "identified as an option for consideration"],
];

function normalizeWhitespaceAndPunctuation(s: string): string {
  let t = s.trim();
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\s+([.,;:!?])/g, "$1");
  t = t.replace(/([.,;:!?])([^\s])/g, "$1 $2");
  return t.trim();
}

function applyAutoFixes(s: string): string {
  let t = s;
  for (const [re, replacement] of AUTO_FIXES) {
    t = t.replace(re, replacement);
  }
  return t;
}

/** Returns the first forbidden phrase found, or null. Exported for dev warnings. */
export function findForbiddenToken(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

function containsForbidden(text: string): string | null {
  return findForbiddenToken(text);
}

/** Validate vulnerability is factual (present/past), not conditional/prescriptive. */
function validateVulnerabilityTense(text: string): void {
  const lower = text.toLowerCase();
  if (lower.includes("may consider") || lower.includes("could consider")) {
    throw new Error(
      "VOFC normalization failed: vulnerability must be factual (present/past), not conditional; use conditional language only in option_for_consideration"
    );
  }
}

/** Validate option_for_consideration uses conditional/neutral language. */
function validateOptionTense(text: string): void {
  const lower = text.toLowerCase();
  if (/\bmust\b/.test(lower) || /\bshould\b/.test(lower)) {
    throw new Error(
      "VOFC normalization failed: option_for_consideration must use conditional language (e.g. may consider, could be evaluated), not prescriptive (should, must)"
    );
  }
}

function normalizeField(value: string): string {
  const step1 = normalizeWhitespaceAndPunctuation(value);
  const step2 = applyAutoFixes(step1);
  return normalizeWhitespaceAndPunctuation(step2);
}

/** Trim and collapse whitespace only. Used for SOURCE-origin text (no forbidden-language check). */
function sanitizeText(value: string): string {
  return normalizeWhitespaceAndPunctuation(value);
}

/**
 * Normalizes and validates a single VOFC for doctrine-compliant language.
 * - GENERATED: applies auto-fixes, rejects remaining forbidden phrases, validates tense.
 * - SOURCE: only sanitizes text (trim, collapse whitespace); no forbidden-language check.
 *
 * @throws if forbidden language cannot be normalized safely (GENERATED only)
 */
export function normalizeVOFC(vofc: VOFC): VOFC {
  const isGenerated = (vofc.origin ?? "GENERATED") === "GENERATED";

  if (isGenerated) {
    const title = normalizeField(vofc.title);
    const vulnerability = normalizeField(vofc.vulnerability);
    const impact = vofc.impact != null ? normalizeField(vofc.impact) : null;
    const option_for_consideration = normalizeField(vofc.option_for_consideration);

    const fieldsToCheck: [string, string][] = [
      ["title", title],
      ["vulnerability", vulnerability],
      ["option_for_consideration", option_for_consideration],
    ];
    if (impact != null) fieldsToCheck.push(["impact", impact]);

    for (const [field, text] of fieldsToCheck) {
      const phrase = containsForbidden(text);
      if (phrase != null) {
        throw new Error(
          `VOFC normalization failed: "${field}" contains forbidden language: "${phrase}". Use neutral, observational wording (e.g. may, can, could, is not documented, was not identified).`
        );
      }
    }

    validateVulnerabilityTense(vulnerability);
    validateOptionTense(option_for_consideration);

    return {
      ...vofc,
      title,
      vulnerability,
      impact,
      option_for_consideration,
    };
  }

  /* SOURCE-origin: no forbidden-language check. Basic sanitization only. */
  const title = sanitizeText(vofc.title);
  const vulnerability = sanitizeText(vofc.vulnerability);
  const impact = vofc.impact != null ? sanitizeText(vofc.impact) : null;
  const option_for_consideration = sanitizeText(vofc.option_for_consideration);

  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    const forbidden = findForbiddenToken(option_for_consideration);
    if (forbidden != null) {
      console.warn("[vofc] source-origin contains directive verb (allowed)", {
        forbidden,
        source_registry_id: (vofc as { source_registry_id?: string | null }).source_registry_id,
        vofc_id: vofc.vofc_id,
      });
    }
  }

  return {
    ...vofc,
    title,
    vulnerability,
    impact,
    option_for_consideration,
  };
}
