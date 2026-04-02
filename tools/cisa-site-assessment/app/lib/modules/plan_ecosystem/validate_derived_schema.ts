/**
 * Validate derived plan schema: JSON contract + style guards (locked doctrine).
 * Throw with offending fields listed if any guard fails.
 */

export interface DerivedElement {
  element_title: string;
  element_key: string;
  observation: string;
  ofc: string;
  impact: string;
  evidence_terms?: string[];
  is_vital?: boolean;
}

export interface DerivedSection {
  section_title: string;
  section_key: string;
  elements: DerivedElement[];
}

export interface DerivedPlanSchemaJson {
  sections: DerivedSection[];
}

const OBSERVATION_VALID_ENDINGS = ["is not documented.", "is not specified.", "are not documented.", "are not specified."];
const OBSERVATION_FORBIDDEN = [
  "failed",
  "unable",
  "could not",
  "did not",
  "noncompliant",
  "deficient",
  "inadequate",
  "refused",
  "neglected",
];

/** Result when disallowed cost/timeline/regulatory/vendor language is found. */
export type DisallowedLanguageHit = { hit: string; excerpt: string };

/**
 * Targeted check for cost/timeline/regulatory/vendor language. Avoids false positives on normal plan words
 * (e.g. "annual", "review", "maintenance", "implementation", "program").
 */
export function containsDisallowedCostTimelineRegulatoryVendorLanguage(s: string): DisallowedLanguageHit | null {
  const t = (s ?? "").toLowerCase();

  const costPatterns: Array<[RegExp, string]> = [
    [/\b(tier|tiers)\b/, "cost-tier"],
    [/\b(\$|usd|dollars?)\b/, "cost-currency"],
    [/\b(cost|costs|budget|funding|funded|capex|opex)\b/, "cost-budget"],
    [/\b(return on investment|roi)\b/, "cost-roi"],
  ];

  const timePatterns: Array<[RegExp, string]> = [
    [/\b(in\s+\d+\s+(day|days|week|weeks|month|months|year|years))\b/, "time-in-N"],
    [/\b(within\s+\d+\s+(day|days|week|weeks|month|months|year|years))\b/, "time-within-N"],
    [/\b(by\s+q[1-4]|quarter|fiscal year|fy\d{2,4})\b/, "time-fy-q"],
    [/\b(deadline|timeline|roadmap)\b/, "time-deadline"],
  ];

  const regulatoryPatterns: Array<[RegExp, string]> = [
    [/\b(noncompliant|regulation|mandated|mandate)\b/, "regulatory-compliance"],
    [/\bregulatory\s+compliance\b/, "regulatory-compliance"],
    [/\b(standard\s+\w+|iso\s*\d+|nist|hipaa|pci|sox)\b/, "regulatory-standards"],
    [/\b(cfr|usc|code of federal regulations|federal register)\b/, "regulatory-cfr"],
  ];

  const vendorPatterns: Array<[RegExp, string]> = [
    [/\b(contact\s+\w+\s+for\s+a\s+quote)\b/, "vendor-quote"],
    [/\b(recommended vendor|preferred vendor)\b/, "vendor-preferred"],
  ];

  const all: Array<[RegExp, string]> = [...costPatterns, ...timePatterns, ...regulatoryPatterns, ...vendorPatterns];
  for (const [re, label] of all) {
    const match = re.exec(t);
    if (match) {
      const excerpt = (match[0] ?? "").slice(0, 80);
      return { hit: label, excerpt: excerpt || s.slice(0, 80) };
    }
  }
  return null;
}

function slugSafe(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Validate one observation: must end with allowed ending and must not contain forbidden words.
 */
function validateObservation(observation: string, path: string): string[] {
  const errs: string[] = [];
  const o = (observation ?? "").trim();
  const endsOk = OBSERVATION_VALID_ENDINGS.some((e) => o.endsWith(e));
  if (!endsOk) {
    errs.push(`${path}.observation must end with "is/are not documented." or "is/are not specified." (got: "${o.slice(-60)}")`);
  }
  const lower = o.toLowerCase();
  for (const word of OBSERVATION_FORBIDDEN) {
    if (lower.includes(word)) {
      errs.push(`${path}.observation must not contain "${word}"`);
    }
  }
  return errs;
}

/**
 * Validate ofc: single statement, no cost/timeline/regulatory/vendor (targeted patterns), no pipe or numbered list.
 */
function validateOfc(ofc: string, path: string): string[] {
  const errs: string[] = [];
  const o = (ofc ?? "").trim();
  if (!o) {
    errs.push(`${path}.ofc is required and must be exactly one statement`);
    return errs;
  }
  if (o.includes("|")) {
    errs.push(`${path}.ofc must not contain pipe characters`);
  }
  if (/\d+\.\s+[A-Z]/.test(o)) {
    errs.push(`${path}.ofc must not be a numbered list`);
  }
  const disallowed = containsDisallowedCostTimelineRegulatoryVendorLanguage(o);
  if (disallowed) {
    errs.push(`${path}.ofc contains disallowed language: ${disallowed.hit} (excerpt: "${disallowed.excerpt}")`);
  }
  return errs;
}

/**
 * Validate impact: non-empty, short (operational, neutral), no cost/timeline/regulatory/vendor (targeted patterns).
 */
function validateImpact(impact: string, path: string): string[] {
  const errs: string[] = [];
  const i = (impact ?? "").trim();
  if (!i) {
    errs.push(`${path}.impact is required`);
    return errs;
  }
  if (i.length > 400) {
    errs.push(`${path}.impact must be 1-2 sentences (max 400 chars)`);
  }
  const disallowed = containsDisallowedCostTimelineRegulatoryVendorLanguage(i);
  if (disallowed) {
    errs.push(`${path}.impact contains disallowed language: ${disallowed.hit} (excerpt: "${disallowed.excerpt}")`);
  }
  return errs;
}

/**
 * Validate full derived schema JSON and style guards. Throws if invalid.
 */
export function validateDerivedSchema(data: unknown): asserts data is DerivedPlanSchemaJson {
  if (data === null || typeof data !== "object") {
    throw new Error("Derived plan schema must be a JSON object");
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.sections)) {
    throw new Error("Derived plan schema must have 'sections' array");
  }
  const allErrors: string[] = [];
  let totalElements = 0;

  for (let sIdx = 0; sIdx < obj.sections.length; sIdx++) {
    const sec = obj.sections[sIdx];
    if (sec === null || typeof sec !== "object") {
      allErrors.push(`sections[${sIdx}] must be an object`);
      continue;
    }
    const s = sec as Record<string, unknown>;
    const section_title = typeof s.section_title === "string" ? s.section_title.trim() : "";
    const section_key = typeof s.section_key === "string" ? slugSafe(s.section_key) || `section_${sIdx + 1}` : "";
    if (!section_title) allErrors.push(`sections[${sIdx}].section_title is required`);
    if (!section_key) allErrors.push(`sections[${sIdx}].section_key is required`);

    const elements = Array.isArray(s.elements) ? s.elements : [];
    if (elements.length < 1) allErrors.push(`sections[${sIdx}] must have at least one element`);
    totalElements += elements.length;
    for (let eIdx = 0; eIdx < elements.length; eIdx++) {
      const el = elements[eIdx];
      const path = `sections[${sIdx}].elements[${eIdx}]`;
      if (el === null || typeof el !== "object") {
        allErrors.push(`${path} must be an object`);
        continue;
      }
      const e = el as Record<string, unknown>;
      const observation = typeof e.observation === "string" ? e.observation : "";
      const ofc = typeof e.ofc === "string" ? e.ofc : "";
      const impact = typeof e.impact === "string" ? e.impact : "";
      if (!(typeof e.element_title === "string" && e.element_title.trim())) allErrors.push(`${path}.element_title is required`);
      if (!(typeof e.element_key === "string" && slugSafe(e.element_key))) allErrors.push(`${path}.element_key is required`);

      allErrors.push(...validateObservation(observation, path));
      allErrors.push(...validateOfc(ofc, path));
      allErrors.push(...validateImpact(impact, path));
    }
  }

  if (obj.sections.length > 0 && totalElements < obj.sections.length) {
    allErrors.push(`Total elements (${totalElements}) must be at least the number of sections (${obj.sections.length})`);
  }

  if (allErrors.length > 0) {
    const err = new Error(`Plan schema validation failed:\n${allErrors.join("\n")}`);
    (err as Error & { validationErrors?: string[] }).validationErrors = allErrors;
    throw err;
  }
}
