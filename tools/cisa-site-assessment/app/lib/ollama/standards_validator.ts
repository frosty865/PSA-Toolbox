export type StandardType = "plan" | "object";

export type StandardsGenOptions = {
  forbidCadence?: boolean;
  forbidImplementationDetails?: boolean; // primarily PLAN
  forbidCyberConfig?: boolean; // primarily OBJECT
  forbidScenarioSpecific?: boolean; // primarily OBJECT
};

export type PlanStandard = {
  standard_type: "plan";
  standard_title: string;
  required_elements: Array<{
    element_title: string;
    criteria: string[];
    evidence_examples: string[];
  }>;
};

export type ObjectStandard = {
  standard_type: "object";
  standard_title: string;
  required_elements: Array<{
    element_title: string;
    criteria: string[];
    field_checks: string[];
  }>;
};

export type AnyStandard = PlanStandard | ObjectStandard;

export type ValidationFailure = {
  code:
    | "JSON_PARSE"
    | "TYPE_MISMATCH"
    | "MISSING_TITLE"
    | "ELEMENT_COUNT"
    | "ELEMENT_SHAPE"
    | "PLACEHOLDER"
    | "CADENCE"
    | "IMPLEMENTATION_DETAIL"
    | "CYBER_CONFIG"
    | "SCENARIO_SPECIFIC"
    | "WEAK_CRITERIA"
    | "DUPLICATE_CRITERIA"
    | "DUPLICATE_ELEMENTS"
    | "LOW_DIVERSITY";
  message: string;
  path?: string;
};

export type StandardQualityMetrics = {
  lexicalDiversity: number;
  avgCriterionTokens: number;
  minCriterionTokens: number;
  totalCriterionTokens: number;
  duplicateCriteriaPairs: number;
  duplicateElementTitles: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "within",
  "must",
  "should",
  "can",
  "will",
  "this",
  "these",
  "those",
]);

export function normalizeText(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the first balanced JSON object from arbitrary text.
 * - Finds first '{'
 * - Brace-counts until matching '}'
 * - Returns substring; throws if not found/balanced
 */
export function extractFirstJsonObject(text: string): string {
  const s = text ?? "";
  const start = s.indexOf("{");
  if (start < 0) throw new Error("No JSON object start '{' found.");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      return s.slice(start, i + 1);
    }
  }

  throw new Error("Unbalanced JSON braces; could not extract first object.");
}

function tokenizeMeaningful(s: string): string[] {
  const normalized = normalizeText(s).replace(/[^a-z0-9\s]+/g, " ");
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function countNearDuplicatePairs(values: string[], similarityThreshold: number): number {
  const tokenized = values.map((value) => tokenizeMeaningful(value));
  let pairs = 0;
  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const similarity = jaccardSimilarity(tokenized[i], tokenized[j]);
      if (similarity >= similarityThreshold) pairs += 1;
    }
  }
  return pairs;
}

function hasAnyPlaceholderToken(s: string): boolean {
  const n = normalizeText(s);
  return (
    n.includes("<string>") ||
    n.includes("...") ||
    n.includes("<obj_") ||
    n.includes("<plan_") ||
    n.includes("<") ||
    n.includes(">")
  );
}

function containsCadence(s: string): boolean {
  const n = normalizeText(s);
  // Block: annual/quarterly/monthly/weekly/daily/every/within X days/24 hours/30 days/retained for
  return (
    /\bannual(ly)?\b/.test(n) ||
    /\bquarter(ly)?\b/.test(n) ||
    /\bmonth(ly)?\b/.test(n) ||
    /\bweek(ly)?\b/.test(n) ||
    /\bdaily\b/.test(n) ||
    /\bevery\b/.test(n) ||
    /\bwithin\s+\d+\s+(day|days|week|weeks|month|months|year|years)\b/.test(n) ||
    /\b\d+\s+(day|days|week|weeks|month|months|year|years)\b/.test(n) ||
    /\b24\s*hours?\b/.test(n) ||
    /\b30\s*days?\b/.test(n) ||
    /\bretained?\s+for\b/.test(n)
  );
}

function containsImplementationDetail(s: string): boolean {
  const n = normalizeText(s);
  // Not cyber; just implementation/tech specificity that you don't want in standards.
  return (
    /\bmobile\b/.test(n) ||
    /\bapp\b/.test(n) ||
    /\bweb\b/.test(n) ||
    /\bonline\b/.test(n) ||
    /\bintranet\b/.test(n) ||
    /\bemail\b/.test(n) ||
    /\bsoftware\b/.test(n) ||
    /\bweb-based\b/.test(n)
  );
}

function containsCyberConfig(s: string): boolean {
  const n = normalizeText(s);
  return (
    /\bip address\b/.test(n) ||
    /\bip\b/.test(n) ||
    /\bport\b/.test(n) ||
    /\binternet\b/.test(n) ||
    /\bnetwork\b/.test(n) ||
    /\bvlan\b/.test(n) ||
    /\bfirewall\b/.test(n) ||
    /\bfirmware\b/.test(n) ||
    /\bpassword\b/.test(n) ||
    /\bcredential\b/.test(n) ||
    /\brouter\b/.test(n) ||
    /\bswitch\b/.test(n)
  );
}

function containsScenarioSpecific(s: string): boolean {
  const n = normalizeText(s);
  return /\blicense plate\b/.test(n) || /\bparking enforcement\b/.test(n);
}

function criterionLooksWeak(s: string): boolean {
  const n = normalizeText(s);
  if (n.length < 8) return true;

  // Must include a verb-ish anchor to be testable.
  const hasVerb =
    /\bis\b/.test(n) ||
    /\bare\b/.test(n) ||
    /\bhas\b/.test(n) ||
    /\bhave\b/.test(n) ||
    /\bincludes\b/.test(n) ||
    /\bidentifies\b/.test(n) ||
    /\bdefines\b/.test(n) ||
    /\bdocuments\b/.test(n) ||
    /\bprovides\b/.test(n) ||
    /\bexists\b/.test(n) ||
    /\bmaintains\b/.test(n) ||
    /\brequires\b/.test(n) ||
    /\bdescribes?\b/.test(n) ||
    /\bdemonstrates?\b/.test(n) ||
    /\bmaps?\b/.test(n);

  const vaguePhrase =
    /\bappropriate\b/.test(n) ||
    /\badequate\b/.test(n) ||
    /\beffective\s+measures\b/.test(n) ||
    /\bgood\s+practice\b/.test(n) ||
    /\bas\s+needed\b/.test(n) ||
    /\bwhere\s+possible\b/.test(n);

  // Disallow single-word "criteria" and ultra-generic tokens
  const ultraGeneric = ["exists", "visible", "accessible", "clear", "enabled"].includes(n);

  return !hasVerb || ultraGeneric || vaguePhrase;
}

function slugifyTitle(title: string): string {
  return normalizeText(title)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function gatherCriteria(standard: AnyStandard): string[] {
  const criteria: string[] = [];
  for (const element of standard.required_elements || []) {
    for (const criterion of element.criteria || []) {
      if (typeof criterion === "string") criteria.push(criterion);
    }
  }
  return criteria;
}

export function measureStandardQuality(standard: AnyStandard): StandardQualityMetrics {
  const criteria = gatherCriteria(standard);
  const allCriterionTokens = criteria.flatMap((criterion) => tokenizeMeaningful(criterion));
  const uniqueCriterionTokens = new Set(allCriterionTokens);
  const lexicalDiversity = allCriterionTokens.length === 0 ? 0 : uniqueCriterionTokens.size / allCriterionTokens.length;

  const criterionTokenCounts = criteria.map((criterion) => tokenizeMeaningful(criterion).length);
  const totalCriterionTokens = criterionTokenCounts.reduce((sum, count) => sum + count, 0);
  const avgCriterionTokens = criterionTokenCounts.length === 0 ? 0 : totalCriterionTokens / criterionTokenCounts.length;
  const minCriterionTokens = criterionTokenCounts.length === 0 ? 0 : Math.min(...criterionTokenCounts);

  const duplicateCriteriaPairs = countNearDuplicatePairs(criteria, 0.84);

  const titleCounts = new Map<string, number>();
  for (const element of standard.required_elements || []) {
    const title = normalizeText(element.element_title || "");
    if (!title) continue;
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  }
  let duplicateElementTitles = 0;
  for (const count of titleCounts.values()) {
    if (count > 1) duplicateElementTitles += count - 1;
  }

  return {
    lexicalDiversity,
    avgCriterionTokens,
    minCriterionTokens,
    totalCriterionTokens,
    duplicateCriteriaPairs,
    duplicateElementTitles,
  };
}

export function applyDeterministicCodes<T extends AnyStandard>(
  standard: T
): T & {
  standard_code: string;
  required_elements: Array<
    T["required_elements"][number] & { element_code: string }
  >;
} {
  const slug = slugifyTitle(standard.standard_title || "STANDARD") || "STANDARD";
  const prefix = standard.standard_type === "plan" ? "PLAN" : "OBJ";
  const standard_code = `${prefix}_${slug}`;

  const required_elements = standard.required_elements.map((el, idx) => {
    const nn = String(idx + 1).padStart(2, "0");
    const element_code = `${prefix}_EL_${slug}_${nn}`;
    return { ...el, element_code };
  });

  return { ...(standard as T), standard_code, required_elements };
}

export function validateStandard(
  standard: AnyStandard,
  expectedType: StandardType,
  opts: StandardsGenOptions
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (!standard || typeof standard !== "object") {
    failures.push({ code: "JSON_PARSE", message: "Parsed JSON is not an object." });
    return failures;
  }

  if (standard.standard_type !== expectedType) {
    failures.push({
      code: "TYPE_MISMATCH",
      message: `standard_type must be '${expectedType}' but got '${(standard as AnyStandard).standard_type}'.`,
      path: "standard_type",
    });
    // Continue to surface additional failures if present
  }

  if (!standard.standard_title || !String(standard.standard_title).trim()) {
    failures.push({ code: "MISSING_TITLE", message: "standard_title is required.", path: "standard_title" });
  }

  const elems: Array<Record<string, unknown>> = Array.isArray((standard as AnyStandard).required_elements)
    ? ((standard as AnyStandard).required_elements as unknown[] as Array<Record<string, unknown>>)
    : [];

  if (elems.length < 8 || elems.length > 12) {
    failures.push({
      code: "ELEMENT_COUNT",
      message: `required_elements must be 8-12 items; got ${elems.length}.`,
      path: "required_elements",
    });
  }

  // Walk all strings to enforce global bans
  const allStrings: Array<{ value: string; path: string }> = [];
  const pushString = (value: unknown, path: string) => {
    if (typeof value === "string") allStrings.push({ value, path });
  };

  pushString((standard as AnyStandard).standard_type, "standard_type");
  pushString((standard as AnyStandard).standard_title, "standard_title");

  const elementTitleCounts = new Map<string, number>();
  const allCriteriaAcrossElements: string[] = [];

  elems.forEach((el, i) => {
    const elementTitle = typeof el?.element_title === "string" ? el.element_title : "";
    pushString(elementTitle, `required_elements[${i}].element_title`);

    const normalizedTitle = normalizeText(elementTitle);
    if (normalizedTitle) {
      elementTitleCounts.set(normalizedTitle, (elementTitleCounts.get(normalizedTitle) || 0) + 1);
    }

    const criteria = Array.isArray(el?.criteria) ? (el.criteria as unknown[]) : [];
    criteria.forEach((c, j) => {
      if (typeof c === "string") {
        pushString(c, `required_elements[${i}].criteria[${j}]`);
        allCriteriaAcrossElements.push(c);
      }
    });

    const localCriteriaStrings = criteria.filter((c): c is string => typeof c === "string");
    const localDuplicatePairs = countNearDuplicatePairs(localCriteriaStrings, 0.88);
    if (localDuplicatePairs > 0) {
      failures.push({
        code: "DUPLICATE_CRITERIA",
        message: `Element has near-duplicate criteria (${localDuplicatePairs} duplicate pair${localDuplicatePairs > 1 ? "s" : ""}).`,
        path: `required_elements[${i}].criteria`,
      });
    }

    if (expectedType === "plan") {
      (Array.isArray(el?.evidence_examples) ? (el.evidence_examples as unknown[]) : []).forEach((e, j) =>
        pushString(e, `required_elements[${i}].evidence_examples[${j}]`)
      );
    } else {
      (Array.isArray(el?.field_checks) ? (el.field_checks as unknown[]) : []).forEach((f, j) =>
        pushString(f, `required_elements[${i}].field_checks[${j}]`)
      );
    }
  });

  for (const [title, count] of elementTitleCounts.entries()) {
    if (count > 1) {
      failures.push({
        code: "DUPLICATE_ELEMENTS",
        message: `Duplicate element_title detected: '${title}' appears ${count} times.`,
        path: "required_elements",
      });
      break;
    }
  }

  const crossElementDuplicates = countNearDuplicatePairs(allCriteriaAcrossElements, 0.91);
  if (crossElementDuplicates > 0) {
    failures.push({
      code: "DUPLICATE_CRITERIA",
      message: `Near-duplicate criteria found across elements (${crossElementDuplicates} duplicate pair${crossElementDuplicates > 1 ? "s" : ""}).`,
      path: "required_elements",
    });
  }

  for (const s of allStrings) {
    if (hasAnyPlaceholderToken(s.value)) {
      failures.push({ code: "PLACEHOLDER", message: "Placeholder token found.", path: s.path });
      break;
    }
  }

  if (opts.forbidCadence) {
    for (const s of allStrings) {
      if (containsCadence(s.value)) {
        failures.push({ code: "CADENCE", message: "Cadence/frequency/duration found but forbidden.", path: s.path });
        break;
      }
    }
  }

  if (opts.forbidImplementationDetails) {
    for (const s of allStrings) {
      if (containsImplementationDetail(s.value)) {
        failures.push({ code: "IMPLEMENTATION_DETAIL", message: "Implementation/technology reference found but forbidden.", path: s.path });
        break;
      }
    }
  }

  if (opts.forbidCyberConfig) {
    for (const s of allStrings) {
      if (containsCyberConfig(s.value)) {
        failures.push({ code: "CYBER_CONFIG", message: "Cyber/IT configuration detail found but forbidden.", path: s.path });
        break;
      }
    }
  }

  if (opts.forbidScenarioSpecific) {
    for (const s of allStrings) {
      if (containsScenarioSpecific(s.value)) {
        failures.push({ code: "SCENARIO_SPECIFIC", message: "Scenario-specific content found but forbidden.", path: s.path });
        break;
      }
    }
  }

  // Element shape checks
  elems.forEach((el, i) => {
    const titleOk = typeof el?.element_title === "string" && el.element_title.trim().length > 0;
    const criteriaArr: unknown[] = Array.isArray(el?.criteria) ? (el.criteria as unknown[]) : [];

    if (!titleOk) {
      failures.push({ code: "ELEMENT_SHAPE", message: "element_title is required.", path: `required_elements[${i}].element_title` });
    }

    if (criteriaArr.length < 2 || criteriaArr.length > 4) {
      failures.push({
        code: "ELEMENT_SHAPE",
        message: `criteria must be 2-4 items; got ${criteriaArr.length}.`,
        path: `required_elements[${i}].criteria`,
      });
    }

    // Weak criteria heuristic
    for (let j = 0; j < criteriaArr.length; j++) {
      const c = criteriaArr[j];
      if (typeof c === "string" && criterionLooksWeak(c)) {
        failures.push({
          code: "WEAK_CRITERIA",
          message: "Criterion is too weak/vague; must be a testable statement.",
          path: `required_elements[${i}].criteria[${j}]`,
        });
        break;
      }
    }

    if (expectedType === "plan") {
      const ev: unknown[] = Array.isArray(el?.evidence_examples) ? (el.evidence_examples as unknown[]) : [];
      if (ev.length < 2 || ev.length > 4) {
        failures.push({
          code: "ELEMENT_SHAPE",
          message: `evidence_examples must be 2-4 items; got ${ev.length}.`,
          path: `required_elements[${i}].evidence_examples`,
        });
      }
    } else {
      const fc: unknown[] = Array.isArray(el?.field_checks) ? (el.field_checks as unknown[]) : [];
      if (fc.length < 2 || fc.length > 4) {
        failures.push({
          code: "ELEMENT_SHAPE",
          message: `field_checks must be 2-4 items; got ${fc.length}.`,
          path: `required_elements[${i}].field_checks`,
        });
      }
    }
  });

  const metrics = measureStandardQuality(standard);
  if (metrics.totalCriterionTokens >= 40 && metrics.lexicalDiversity < 0.24) {
    failures.push({
      code: "LOW_DIVERSITY",
      message: `Criteria lexical diversity too low (${metrics.lexicalDiversity.toFixed(2)}). Expand vocabulary and reduce repeated phrasing.`,
      path: "required_elements",
    });
  }

  return failures;
}

export function parseAndValidateStandardFromModelText(
  modelText: string,
  expectedType: StandardType,
  opts: StandardsGenOptions
): { ok: true; standard: AnyStandard } | { ok: false; failures: ValidationFailure[]; rawFirstJson?: string } {
  let jsonText: string;
  try {
    jsonText = extractFirstJsonObject(modelText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, failures: [{ code: "JSON_PARSE", message: `Could not extract JSON: ${message}` }] };
  }

  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, failures: [{ code: "JSON_PARSE", message: `JSON.parse failed: ${message}` }], rawFirstJson: jsonText };
  }

  const failures = validateStandard(obj as AnyStandard, expectedType, opts);
  if (failures.length > 0) return { ok: false, failures, rawFirstJson: jsonText };

  return { ok: true, standard: obj as AnyStandard };
}
