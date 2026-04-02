/**
 * PSA OFC Doctrine V1 - Single Source of Truth
 * 
 * Central flags used by API + UI + pipeline entry points.
 * These are kill-switches for doctrine enforcement.
 */

export const OFC_DOCTRINE = {
  VERSION: "V1",
  // Non-negotiables
  DISALLOW_OFC_AUTOMINING: true,
  DISALLOW_DOCUMENT_DERIVED_OFC_TEXT: true,
  REQUIRE_SUBTYPE_MATCH: true,
  REQUIRE_DISCIPLINE_MATCH_WHEN_PRESENT: true,
  DISALLOW_CROSS_SUBTYPE_MATCHING: true,
  REQUIRE_OFC_APPROVED_FOR_ATTACHMENT: true,
  STRICT_CORPUS_MODULE_SEPARATION: true,
  // Presentation limits
  MAX_OFCS_PER_VULN: 4, // Maximum OFCs shown per vulnerability (question answered NO)
} as const;

export type OfcOrigin = "CORPUS" | "MODULE";
export type OfcStatus = "PENDING" | "REVIEWED" | "PROMOTED" | "REJECTED";
export type OfcClass = "FOUNDATIONAL" | "OPERATIONAL" | "PHYSICAL";

// PROMOTED = approved for attachment
export const APPROVED_STATUSES: OfcStatus[] = ["PROMOTED"];

// OFC class priority for ranking (lower number = higher priority)
export const OFC_CLASS_PRIORITY: Record<OfcClass, number> = {
  FOUNDATIONAL: 1, // Highest priority (governance/plans/procedures)
  OPERATIONAL: 2,  // Medium priority (processes/assurance)
  PHYSICAL: 3,     // Lower priority (physical controls)
};
