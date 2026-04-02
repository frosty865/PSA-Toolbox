/**
 * Plan Structure Trust: human-controlled mode for how plan sections are derived.
 * Applies only to PLAN schema derivation.
 */

export type PlanStructureTrust =
  | "INFERRED"   // headings only
  | "BALANCED"   // TOC + guarded headings (DEFAULT)
  | "TOC";       // TOC only

export const DEFAULT_PLAN_STRUCTURE_TRUST: PlanStructureTrust = "BALANCED";

const VALID_TRUST: Set<string> = new Set(["INFERRED", "BALANCED", "TOC"]);

export function parsePlanStructureTrust(value: string | null | undefined): PlanStructureTrust {
  const v = (value ?? "").trim().toUpperCase();
  return VALID_TRUST.has(v) ? (v as PlanStructureTrust) : DEFAULT_PLAN_STRUCTURE_TRUST;
}
