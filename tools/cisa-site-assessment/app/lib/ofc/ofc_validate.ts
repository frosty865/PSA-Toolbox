/**
 * OFC validation: max per criterion, canonical verb only.
 * Use after postprocessOfcs to hard-fail or warn in admin mode.
 */

import type { OfcLike } from "./ofc_postprocess";

export function validateOfcsHardRules(
  ofcs: OfcLike[],
  maxPerCriterion = 4
): string[] {
  const errs: string[] = [];
  const groups = new Map<string, number>();

  for (const o of ofcs ?? []) {
    const gid = (o.criterionId ?? o.criterion_key ?? o.vulnerabilityId ?? "UNSCOPED").trim();
    groups.set(gid, (groups.get(gid) ?? 0) + 1);

    const t = ((o.text ?? o.ofc_text) ?? "").toLowerCase();
    if (t.startsWith("document and maintain a capability for ")) {
      errs.push(`Non-canonical verb found: ${gid}`);
    }
    if (t.startsWith("provide and maintain a capability for ")) {
      errs.push(`Non-canonical verb found: ${gid}`);
    }
  }

  for (const [gid, n] of groups.entries()) {
    if (n > maxPerCriterion) {
      errs.push(`Too many OFCs for ${gid}: ${n} > ${maxPerCriterion}`);
    }
  }

  return errs;
}
