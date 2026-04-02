/**
 * OFC quality: detect generic boilerplate, enforce succinct text + evidence-grounded reason.
 * Use after OFC generation or rewrite step to reject/downgrade generic OFCs.
 */

const GENERIC_PHRASES = [
  "establish and maintain",
  "capability for",
  "(e.g.",
  "is documented",
  "is identified",
  "is defined",
  "is addressed",
  "is maintained",
  "plan review and update cycle",
];

/** Max words for "already succinct" PLAN-style OFCs; these skip phrase-count generic check. */
const SUCCINCT_MAX_WORDS = 16;

export function isTooGeneric(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t) return true;
  if (t.includes("establish and maintain")) return true;
  if (t.includes("capability for")) return true;
  const wordCount = t.split(/\s+/).length;
  if (wordCount > 20) return true;
  // Short requirement text (e.g. "Exercise schedule (e.g., annual) is documented.") is valid; don't flag "(e.g." alone.
  if (wordCount <= SUCCINCT_MAX_WORDS) return false;
  let hits = 0;
  for (const p of GENERIC_PHRASES) {
    if (t.includes(p)) hits++;
  }
  if (hits >= 3) return true;
  return false;
}

export interface EnforceQualityOptions {
  /** If true, require non-empty reason with min length (default true when reasons are expected). */
  requireReason?: boolean;
  /** Min length for reason in chars (default 30). */
  minReasonLength?: number;
}

export function enforceQuality(
  ofcs: Array<{ text?: string; ofc_text?: string; reason?: string; ofc_reason?: string }>,
  opts: EnforceQualityOptions = {}
): string[] {
  const errs: string[] = [];
  const requireReason = opts.requireReason ?? false;
  const minLen = opts.minReasonLength ?? 30;

  for (const o of ofcs ?? []) {
    const text = (o.text ?? o.ofc_text ?? "").trim();
    const reason = (o.reason ?? o.ofc_reason ?? "").trim();

    if (isTooGeneric(text)) {
      errs.push(`OFC too generic: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`);
    }
    if (requireReason && (!reason || reason.length < minLen)) {
      errs.push(`Reason too thin for OFC: "${text.slice(0, 60)}…"`);
    }
  }

  return errs;
}
