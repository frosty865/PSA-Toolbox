/**
 * Pre-export integrity gate. Fails hard with aggregated messages if assessment,
 * summary, VOFCs, or chart inputs are not export-ready.
 */

import type { Assessment, VOFCCollection } from "schema";
import { AssessmentSchema, REQUIRED_TEMPLATE_ANCHORS } from "schema";
import type { SummaryRow } from "../summary";
import { buildCurve } from "../curve";
import { assertMAPCompliance } from "../vofc/map_guard";
import { MAX_VOFC_PER_CATEGORY } from "../vofc/map_doctrine";

const SUPPORTED_CATEGORIES = [
  "ELECTRIC_POWER",
  "COMMUNICATIONS",
  "INFORMATION_TECHNOLOGY",
  "WATER",
  "WASTEWATER",
  "CRITICAL_PRODUCTS",
] as const;

const CHART_CATEGORIES = [
  "ELECTRIC_POWER",
  "COMMUNICATIONS",
  "INFORMATION_TECHNOLOGY",
  "WATER",
  "WASTEWATER",
] as const;

/** Re-export from schema (single source of truth). */
export const REQUIRED_ANCHORS = REQUIRED_TEMPLATE_ANCHORS;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function curvePointsValid(
  points: Array<{ t_hours: number; capacity_without_backup: number; capacity_with_backup: number }>
): boolean {
  for (const p of points) {
    if (
      !isFiniteNumber(p.t_hours) ||
      !isFiniteNumber(p.capacity_without_backup) ||
      !isFiniteNumber(p.capacity_with_backup)
    ) {
      return false;
    }
    if (
      p.capacity_without_backup < 0 ||
      p.capacity_without_backup > 100 ||
      p.capacity_with_backup < 0 ||
      p.capacity_with_backup > 100
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Asserts that assessment, summary, VOFCs, and required anchors are export-ready.
 * - Assessment schema validates
 * - Summary has exactly one row per supported category
 * - VOFC MAP guard passes (assertMAPCompliance)
 * - Per-category VOFC cap enforced
 * - For chart-required categories with requires_service=true, curve points build without NaN and within bounds
 * - requiredAnchors is non-empty and contains all REQUIRED_ANCHORS
 *
 * @throws Error with all violations concatenated
 */
export function assertExportReady(args: {
  assessment: Assessment;
  summary: SummaryRow[];
  vofcs: VOFCCollection;
  requiredAnchors: string[];
}): void {
  const errors: string[] = [];
  const { assessment, summary, vofcs, requiredAnchors } = args;

  try {
    AssessmentSchema.parse(assessment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Assessment validation failed: ${msg}`);
  }

  if (summary.length !== SUPPORTED_CATEGORIES.length) {
    errors.push(
      `Summary must have exactly one row per supported category (expected ${SUPPORTED_CATEGORIES.length}, got ${summary.length})`
    );
  }
  const summaryCategories = new Set(summary.map((r) => r.category));
  for (const cat of SUPPORTED_CATEGORIES) {
    if (!summaryCategories.has(cat)) {
      errors.push(`Summary missing category: ${cat}`);
    }
  }
  const uniqueSummaryCategories = new Set(summary.map((r) => r.category)).size;
  if (uniqueSummaryCategories !== SUPPORTED_CATEGORIES.length) {
    errors.push(
      `Summary must have exactly one row per supported category (duplicate or missing categories)`
    );
  }

  try {
    assertMAPCompliance(vofcs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`VOFC MAP compliance failed: ${msg}`);
  }

  const vofcByCategory = new Map<string, number>();
  for (const v of vofcs.items ?? []) {
    vofcByCategory.set(v.category, (vofcByCategory.get(v.category) ?? 0) + 1);
  }
  for (const [cat, count] of vofcByCategory) {
    if (count > MAX_VOFC_PER_CATEGORY) {
      errors.push(
        `VOFC cap exceeded for ${cat}: ${count} (max ${MAX_VOFC_PER_CATEGORY})`
      );
    }
  }

  const categories = assessment.categories ?? {};
  for (const cat of CHART_CATEGORIES) {
    const input = categories[cat];
    if (input && input.requires_service === true) {
      try {
        const points = buildCurve(input);
        if (!curvePointsValid(points)) {
          errors.push(
            `Curve for ${cat}: invalid points (NaN or out of bounds 0–100)`
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Curve build failed for ${cat}: ${msg}`);
      }
    }
  }

  if (requiredAnchors.length === 0) {
    errors.push("requiredAnchors must be non-empty (server-provided list)");
  }
  const anchorSet = new Set(requiredAnchors);
  for (const anchor of REQUIRED_ANCHORS) {
    if (!anchorSet.has(anchor)) {
      errors.push(`Missing required anchor: ${anchor}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Export not ready:\n${errors.join("\n")}`);
  }
}
