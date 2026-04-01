/**
 * VOFC MAP DEFINITIONS (Doctrine)
 *
 * Formal rules for Mapping, Applicability, and Prioritization of
 * Vulnerabilities and Options for Consideration. All VOFC handling in the
 * engine must conform to this doctrine.
 */

// =============================================================================
// M — MAP (Trigger Mapping)
// =============================================================================
// - A VOFC must be tied to one or more observable assessment conditions.
// - Mapping must be deterministic (no probabilistic or narrative inference).
// - If a condition cannot be evaluated from assessment inputs, the VOFC is invalid.
// =============================================================================

// =============================================================================
// A — APPLICABILITY
// =============================================================================
// - CONFIRMED:
//   - The condition is explicitly stated by user input.
//   - Example: has_backup=false.
// - POTENTIAL:
//   - The condition is inferred from thresholds or combinations.
//   - Example: recovery_time_hours >= 72 AND no redundancy indicated.
// - Applicability is NOT optional; every VOFC must have exactly one.
// =============================================================================

/** Applicability order for prioritization: CONFIRMED before POTENTIAL. */
export const APPLICABILITY_ORDER = ["CONFIRMED", "POTENTIAL"] as const;

// =============================================================================
// P — PRIORITIZATION
// =============================================================================
// - Severity is intrinsic to the VOFC (from library), not user-editable.
// - Output must be capped at 4 VOFCs per category.
// - Ordering rules:
//   1) Severity (HIGH → MODERATE → LOW)
//   2) Applicability (CONFIRMED before POTENTIAL)
//   3) vofc_id (stable sort)
// =============================================================================

/** Maximum VOFCs per category in output (drop lowest priority beyond this). */
export const MAX_VOFC_PER_CATEGORY = 4;

/** Severity order for prioritization: HIGH first, then MODERATE, then LOW. */
export const SEVERITY_ORDER = ["HIGH", "MODERATE", "LOW"] as const;

// =============================================================================
// NORMALIZATION (Non-negotiable)
// =============================================================================
// - Language must be neutral and observational.
// - No cost, vendor, schedule, or prescriptive implementation language.
// - No "should", "must", "recommend", "consider implementing".
// - Use "may", "can", "could", "is not documented", "was not identified".
// =============================================================================
