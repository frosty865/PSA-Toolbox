/**
 * Coerce unknown values to number or null for numeric form fields.
 * Use at ingestion (e.g. progress import) so string values like "00015" become 15.
 */
export function toNumOrNull(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const n = Number(String(x).trim());
  return Number.isFinite(n) ? n : null;
}

const CATEGORY_NUMERIC_KEYS = new Set([
  "time_to_impact_hours",
  "loss_fraction_no_backup",
  "backup_duration_hours",
  "loss_fraction_with_backup",
  "recovery_time_hours",
]);

const AGREEMENTS_NUMERIC_KEYS = new Set(["sla_hours"]);

const PRIORITY_RESTORATION_NUMERIC_KEYS = new Set(["sla_mttr_max_hours"]);

function normalizeObj(obj: Record<string, unknown>, numericKeys: Set<string>): void {
  for (const key of numericKeys) {
    if (!(key in obj)) continue;
    const v = toNumOrNull(obj[key]);
    obj[key] = v;
  }
}

function normalizeAgreements(agreements: unknown): void {
  if (agreements == null || typeof agreements !== "object" || Array.isArray(agreements)) return;
  const o = agreements as Record<string, unknown>;
  normalizeObj(o, AGREEMENTS_NUMERIC_KEYS);
}

function normalizePriorityRestorationTopic(topic: unknown): void {
  if (topic == null || typeof topic !== "object" || Array.isArray(topic)) return;
  const o = topic as Record<string, unknown>;
  normalizeObj(o, PRIORITY_RESTORATION_NUMERIC_KEYS);
}

function normalizeCategoryInput(data: unknown): void {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return;
  const o = data as Record<string, unknown>;
  normalizeObj(o, CATEGORY_NUMERIC_KEYS);
  const agreements = o.agreements;
  if (agreements != null && typeof agreements === "object" && !Array.isArray(agreements)) {
    normalizeAgreements(agreements);
  }
}

/**
 * Mutates assessment so numeric fields are numbers (or null), not strings.
 * Call before passing to AssessmentSchema.safeParse when loading from JSON/file.
 */
export function normalizeAssessmentNumericFields(assessment: Record<string, unknown>): void {
  const categories = assessment.categories;
  if (categories != null && typeof categories === "object" && !Array.isArray(categories)) {
    for (const cat of Object.values(categories)) {
      normalizeCategoryInput(cat);
    }
  }
  const pr = assessment.priority_restoration;
  if (pr != null && typeof pr === "object" && !Array.isArray(pr)) {
    const o = pr as Record<string, unknown>;
    for (const topic of Object.values(o)) {
      normalizePriorityRestorationTopic(topic);
    }
  }
}
