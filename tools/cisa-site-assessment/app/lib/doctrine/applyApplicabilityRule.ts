/**
 * Deterministic applicability: attributes + applicability_rule => APPLIES | N_A.
 * Used only for module doctrine generation. No baseline, no canon_id.
 *
 * Rule shapes (v1):
 * - {} or missing → APPLIES
 * - { "requires": { "ATTR_K": "V" } } → APPLIES only if attributes[ATTR_K] === "V" (all keys must match)
 * - { "n_a_if": { "ATTR_K": "V" } } → N_A when attributes[ATTR_K] === "V" (any match → N_A), else APPLIES
 */

export type ApplicabilityRule = {
  requires?: Record<string, string | boolean | number>;
  n_a_if?: Record<string, string | boolean | number>;
};

export function applyApplicabilityRule(
  attributes: Record<string, unknown>,
  rule: ApplicabilityRule | null | undefined
): "APPLIES" | "N_A" {
  const r = rule || {};

  // n_a_if: any matching attribute makes N_A
  if (r.n_a_if && typeof r.n_a_if === "object") {
    for (const [k, v] of Object.entries(r.n_a_if)) {
      const av = attributes[k];
      if (av === v || String(av) === String(v)) return "N_A";
    }
  }

  // requires: all must match; if any mismatch → N_A
  if (r.requires && typeof r.requires === "object") {
    for (const [k, v] of Object.entries(r.requires)) {
      const av = attributes[k];
      if (av !== v && String(av) !== String(v)) return "N_A";
    }
  }

  return "APPLIES";
}
