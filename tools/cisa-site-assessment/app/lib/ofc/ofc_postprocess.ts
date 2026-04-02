/**
 * OFC post-processor: dedupe verb variants, canonicalize stem, cap per criterion.
 * Use after any pipeline that emits OFCs (PLAN, MEASURES) so output stays within
 * max OFCs per criterion and uses a single canonical verb stem.
 */

export type OfcLike = {
  id?: string;
  criterionId?: string;
  criterion_key?: string;
  vulnerabilityId?: string;
  text?: string;
  ofc_text?: string;
  template_key?: string;
  checklist_item_id?: string;
  order_index?: number;
  rationale?: string;
  citations?: unknown[];
  [k: string]: unknown;
};

const MAX_OFCS_PER_CRITERION_DEFAULT = 4;

/** Canonicalize common verb variants into one stem. Bias toward "Establish and maintain ..." */
const VERB_VARIANTS: Array<{ re: RegExp; replace: string }> = [
  {
    re: /^Document and maintain a capability for\s+/i,
    replace: "Establish and maintain a capability for ",
  },
  {
    re: /^Provide and maintain a capability for\s+/i,
    replace: "Establish and maintain a capability for ",
  },
];

function getContent(o: OfcLike): string {
  return ((o.text ?? o.ofc_text) ?? "").trim();
}

function setContent(o: OfcLike, value: string): OfcLike {
  const out = { ...o };
  if ("ofc_text" in o && o.ofc_text !== undefined) out.ofc_text = value;
  else out.text = value;
  return out;
}

/** Normalize whitespace and punctuation minimally; canonicalize verb. */
function normalizeText(s: string): string {
  let t = (s || "").trim();
  for (const v of VERB_VARIANTS) t = t.replace(v.re, v.replace);
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\.+$/g, "");
  return t;
}

/** Extract element key for distinct checks: (e.g., ...) or fallback to capability phrase. */
function elementKey(normalized: string): string {
  const m = normalized.match(/\(e\.g\.,\s*(.+?)\)\s*$/i);
  if (m?.[1]) return m[1].toLowerCase().trim();
  return normalized
    .toLowerCase()
    .replace(/^establish and maintain a capability for\s+/i, "")
    .trim();
}

function getGroupId(o: OfcLike): string {
  return (o.criterionId ?? o.criterion_key ?? o.vulnerabilityId ?? "UNSCOPED").trim();
}

/** Prefer OFCs that already use the canonical stem. */
function canonicalPreferenceScore(originalText: string): number {
  const t = (originalText ?? "").trim().toLowerCase();
  if (t.startsWith("establish and maintain a capability for ")) return 3;
  if (t.startsWith("document and maintain a capability for ")) return 2;
  if (t.startsWith("provide and maintain a capability for ")) return 1;
  return 0;
}

export function postprocessOfcs(
  ofcs: OfcLike[],
  opts?: { maxPerCriterion?: number }
): OfcLike[] {
  const maxPer = opts?.maxPerCriterion ?? MAX_OFCS_PER_CRITERION_DEFAULT;

  const byGroup = new Map<string, Array<OfcLike & { _norm: string; _ek: string }>>();

  for (const o of ofcs ?? []) {
    if (!o) continue;
    const raw = getContent(o);
    if (!raw) continue;
    const gid = getGroupId(o);
    const norm = normalizeText(raw);
    const ek = elementKey(norm);
    const withNorm = setContent(o, norm) as OfcLike & { _norm: string; _ek: string };
    withNorm._norm = norm;
    withNorm._ek = ek;
    const arr = byGroup.get(gid) ?? [];
    arr.push(withNorm);
    byGroup.set(gid, arr);
  }

  const out: OfcLike[] = [];

  for (const [, items] of byGroup.entries()) {
    const bestByElement = new Map<string, (typeof items)[number]>();

    for (const it of items) {
      const existing = bestByElement.get(it._ek);
      if (!existing) {
        bestByElement.set(it._ek, it);
        continue;
      }
      const origIt = getContent(it);
      const origEx = getContent(existing);
      if (canonicalPreferenceScore(origIt) > canonicalPreferenceScore(origEx)) {
        bestByElement.set(it._ek, it);
      }
    }

    const unique = Array.from(bestByElement.values());

    unique.sort((a, b) => {
      const aLen = a._ek.length;
      const bLen = b._ek.length;
      if (bLen !== aLen) return bLen - aLen;
      return canonicalPreferenceScore(getContent(b)) - canonicalPreferenceScore(getContent(a));
    });

    const kept = unique.slice(0, maxPer);
    for (const k of kept) {
      const { _norm, _ek, ...rest } = k;
      out.push(rest as OfcLike);
    }
  }

  return out;
}
