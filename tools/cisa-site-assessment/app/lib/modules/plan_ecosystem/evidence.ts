/**
 * Conservative evidence check for plan elements.
 * Rejects placeholder-heavy content (templates masquerading as implementation).
 * Requires narrative length and optional evidence_terms match.
 */

export function hasImplementationEvidence(args: {
  implementationChunks: Array<{ chunk_text: string }>;
  evidenceTerms?: string[];
}): boolean {
  if (!args.implementationChunks.length) return false;

  const text = args.implementationChunks.map((c) => c.chunk_text).join("\n").toLowerCase();

  if (text.includes("click or tap here") || text.includes("to build out this section")) return false;

  const normalized = text.replace(/\s+/g, " ").trim();
  const hasNarrative = normalized.length >= 800;

  const terms = (args.evidenceTerms || []).map((t) => t.toLowerCase()).filter(Boolean);
  if (!terms.length) return hasNarrative;

  const hits = terms.filter((t) => normalized.includes(t)).length;

  return hits >= 1 && hasNarrative;
}
