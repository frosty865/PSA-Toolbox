/**
 * MAP compliance guard: validates VOFCCollection before return or export.
 * Throws a single aggregated error if any violation exists.
 */

import type { VOFC, VOFCCollection } from "schema";
import { CALIBRATION_REASON_MAX_LENGTH } from "schema";
import { MAX_VOFC_PER_CATEGORY } from "./map_doctrine";

const VALID_CATEGORIES = new Set<string>([
  "ELECTRIC_POWER",
  "COMMUNICATIONS",
  "INFORMATION_TECHNOLOGY",
  "WATER",
  "WASTEWATER",
  "CRITICAL_PRODUCTS",
]);

const VALID_SEVERITIES = new Set<string>(["HIGH", "MODERATE", "LOW"]);

const VALID_APPLICABILITY = new Set<string>(["CONFIRMED", "POTENTIAL"]);

const SEVERITY_RANK: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

function allowDowngrade(): boolean {
  return process.env.VOFC_ALLOW_DOWNGRADE === "1";
}

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
];

function containsForbidden(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

function checkTextFields(vofc: VOFC): string[] {
  const violations: string[] = [];
  const isGenerated = (vofc.origin ?? "GENERATED") === "GENERATED";
  if (!isGenerated) return violations;
  const fields: [string, string | null][] = [
    ["title", vofc.title],
    ["vulnerability", vofc.vulnerability],
    ["option_for_consideration", vofc.option_for_consideration],
  ];
  if (vofc.impact != null) fields.push(["impact", vofc.impact]);
  for (const [field, value] of fields) {
    if (value == null) continue;
    const phrase = containsForbidden(value);
    if (phrase != null) {
      violations.push(`vofc_id=${vofc.vofc_id} "${field}" contains forbidden language: "${phrase}"`);
    }
  }
  return violations;
}

/**
 * Asserts that the VOFC collection satisfies MAP rules.
 * - No more than MAX_VOFC_PER_CATEGORY per category
 * - Every VOFC has applicability (CONFIRMED or POTENTIAL)
 * - No forbidden language in text fields
 * - Severity is valid enum (HIGH, MODERATE, LOW)
 * - Category is valid CategoryCode
 *
 * @throws Error with all violations concatenated if any check fails
 */
export function assertMAPCompliance(vofcs: VOFCCollection): void {
  const errors: string[] = [];
  const items = vofcs.items ?? [];

  const byCategory = new Map<string, number>();
  for (const v of items) {
    const n = (byCategory.get(v.category) ?? 0) + 1;
    byCategory.set(v.category, n);
  }
  for (const [cat, count] of byCategory) {
    if (count > MAX_VOFC_PER_CATEGORY) {
      errors.push(`Category "${cat}" has ${count} VOFCs (max ${MAX_VOFC_PER_CATEGORY})`);
    }
  }

  for (const v of items) {
    const app = (v as { applicability?: string }).applicability;
    if (app == null || app === "") {
      errors.push(`vofc_id=${v.vofc_id} missing applicability`);
    } else if (!VALID_APPLICABILITY.has(app)) {
      errors.push(`vofc_id=${v.vofc_id} invalid applicability "${app}"`);
    }
    if (!VALID_SEVERITIES.has(v.base_severity)) {
      errors.push(`vofc_id=${v.vofc_id} invalid base_severity "${v.base_severity}"`);
    }
    if (!VALID_SEVERITIES.has(v.calibrated_severity)) {
      errors.push(`vofc_id=${v.vofc_id} invalid calibrated_severity "${v.calibrated_severity}"`);
    }
    if (v.calibration_reason != null && v.calibration_reason.length > CALIBRATION_REASON_MAX_LENGTH) {
      errors.push(`vofc_id=${v.vofc_id} calibration_reason length exceeds ${CALIBRATION_REASON_MAX_LENGTH}`);
    }
    if (!VALID_CATEGORIES.has(v.category)) {
      errors.push(`vofc_id=${v.vofc_id} invalid category "${v.category}"`);
    }
    const baseRank = SEVERITY_RANK[v.base_severity] ?? -1;
    const calRank = SEVERITY_RANK[v.calibrated_severity] ?? -1;
    if (calRank < baseRank && !allowDowngrade()) {
      errors.push(`vofc_id=${v.vofc_id} calibrated_severity (${v.calibrated_severity}) lower than base_severity (${v.base_severity}) without VOFC_ALLOW_DOWNGRADE=1`);
    }
    if (v.base_severity !== v.calibrated_severity && (v.calibration_reason == null || v.calibration_reason === "")) {
      errors.push(`vofc_id=${v.vofc_id} calibration_reason required when calibrated_severity differs from base_severity`);
    }
    if (v.base_severity === v.calibrated_severity && v.calibration_reason != null && v.calibration_reason !== "") {
      errors.push(`vofc_id=${v.vofc_id} calibration_reason must be null when base_severity equals calibrated_severity`);
    }
    errors.push(...checkTextFields(v));
  }

  if (errors.length > 0) {
    throw new Error(`MAP compliance failed:\n${errors.join("\n")}`);
  }
}
