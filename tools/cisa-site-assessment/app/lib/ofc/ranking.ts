/**
 * OFC Ranking and Selection Logic
 * 
 * Deterministic ranking function to select the "best 4" OFCs per vulnerability.
 * Prefers foundational capabilities without using cost language.
 */

import { OFC_DOCTRINE, OFC_CLASS_PRIORITY, OfcClass } from "@/app/lib/doctrine/ofc_doctrine";

export type OfcCandidate = {
  id: string;
  ofc_text: string;
  title: string | null;
  discipline_subtype_id: string;
  discipline_id: string | null;
  origin: "CORPUS" | "MODULE";
  status: string;
  approved: boolean;
  ofc_class?: OfcClass;
  source_id?: string | null;
  similarity_score?: number | null;
  citation_bound?: boolean;
};

export type RankingInput = {
  candidate: OfcCandidate;
  question_subtype_id: string;
  question_discipline_id?: string | null;
  layer_compatibility?: "baseline" | "sector" | "subsector";
};

/**
 * Generate redundancy key for deduplication.
 * Normalizes first 8-12 words + subtype + class.
 */
function generateRedundancyKey(candidate: OfcCandidate): string {
  const words = (candidate.ofc_text || "").toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 12)
    .join(" ");
  
  const subtype = candidate.discipline_subtype_id || "";
  const ofcClass = candidate.ofc_class || "FOUNDATIONAL";
  
  return `${words}|${subtype}|${ofcClass}`;
}

/**
 * Rank OFC candidates deterministically.
 * Returns sorted array (best first).
 * 
 * Selection is purely rank-based after filtering and de-duplication.
 * No class balance enforcement - class priority is a ranking input, NOT a quota.
 */
export function rankOfcCandidates(
  candidates: OfcCandidate[],
  question_subtype_id: string,
  _question_discipline_id?: string | null  
): OfcCandidate[] {
  // Step A: Filter - citation_bound must be true (source_id must exist)
  const citationBound = candidates.filter((c) => {
    return c.source_id != null && c.source_id.trim() !== '';
  });

  // Step B: Prefer exact subtype match
  const exactSubtypeMatch = citationBound.filter(
    (c) => c.discipline_subtype_id === question_subtype_id
  );
  const nearSubtypeMatch = citationBound.filter(
    (c) => c.discipline_subtype_id !== question_subtype_id
  );

  // Step C: Sort by similarity score (highest first), then by class priority
  // Note: Class priority is a ranking input, NOT a quota. Selection is rank-based only.
  const sortByRelevance = (ofcs: OfcCandidate[]) => {
    return [...ofcs].sort((a, b) => {
      // First: similarity score (if available)
      const scoreA = a.similarity_score ?? 0;
      const scoreB = b.similarity_score ?? 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }

      // Second: class priority (FOUNDATIONAL first) - ranking input, NOT quota
      const classA = a.ofc_class || "FOUNDATIONAL";
      const classB = b.ofc_class || "FOUNDATIONAL";
      const priorityA = OFC_CLASS_PRIORITY[classA as OfcClass] ?? 999;
      const priorityB = OFC_CLASS_PRIORITY[classB as OfcClass] ?? 999;
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower priority number = higher priority
      }

      // Third: title/ID for deterministic tie-breaking
      const titleA = (a.title || a.id).toLowerCase();
      const titleB = (b.title || b.id).toLowerCase();
      return titleA.localeCompare(titleB);
    });
  };

  const rankedExact = sortByRelevance(exactSubtypeMatch);
  const rankedNear = sortByRelevance(nearSubtypeMatch);

  // Combine: exact matches first, then near matches
  const combined = [...rankedExact, ...rankedNear];

  // Step E: Remove redundancy
  const seen = new Set<string>();
  const deduplicated: OfcCandidate[] = [];
  
  for (const candidate of combined) {
    const key = generateRedundancyKey(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(candidate);
    }
  }

  // Step F: Return top MAX_OFCS_PER_VULN
  return deduplicated.slice(0, OFC_DOCTRINE.MAX_OFCS_PER_VULN);
}

/**
 * Select best OFCs for a question (deterministic).
 * Applies all ranking rules and returns capped result.
 */
export function selectBestOfcs(
  candidates: OfcCandidate[],
  question_subtype_id: string,
  question_discipline_id?: string | null
): OfcCandidate[] {
  return rankOfcCandidates(candidates, question_subtype_id, question_discipline_id);
}
