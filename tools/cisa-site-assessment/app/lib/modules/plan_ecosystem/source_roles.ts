/**
 * Plan source role classification: REQUIREMENT (templates/guides) vs IMPLEMENTATION.
 * Hard rule: REQUIREMENT sources NEVER satisfy plan elements.
 */

export type SourceRole = "REQUIREMENT" | "IMPLEMENTATION";

const REQUIREMENT_TITLE_SIGNALS = ["template", "instructional guide", "guide", "sample"];
const REQUIREMENT_TEXT_SIGNALS = [
  "to build out this section",
  "click or tap here",
  "select date",
  "[insert",
];

function placeholderDensity(s: string): number {
  const t = s.toLowerCase();
  let hits = 0;
  for (const sig of REQUIREMENT_TEXT_SIGNALS) if (t.includes(sig)) hits++;
  const clickCount = (t.match(/click or tap/g) || []).length;
  return hits + Math.min(10, clickCount);
}

/**
 * Classify a plan source as REQUIREMENT (template/guide) or IMPLEMENTATION.
 * Used to partition chunks: requirement chunks define expectations and provide citations;
 * only implementation chunks can satisfy elements.
 */
export function classifyPlanSourceRole(args: { title?: string; chunkSample?: string }): SourceRole {
  const title = (args.title || "").toLowerCase();
  const sample = (args.chunkSample || "").toLowerCase();
  if (REQUIREMENT_TITLE_SIGNALS.some((x) => title.includes(x))) return "REQUIREMENT";
  if (placeholderDensity(sample) >= 2) return "REQUIREMENT";
  return "IMPLEMENTATION";
}
