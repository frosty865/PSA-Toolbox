/**
 * Plan gate question: "Does the facility have a/an <program name>?"
 * Deterministic program name from module_code and top_source_label; otherwise falls back to planType.
 */

function needsAn(word: string): boolean {
  const w = (word || "").trim().toLowerCase();
  return /^[aeiou]/.test(w);
}

/**
 * Build the plan gate question text.
 * If module_code includes "ACTIVE_ASSAILANT" or top_source_label includes "Active Assailant",
 * program name is "Active Assailant Emergency Action Plan"; else "Emergency Action Plan".
 */
export function buildPlanGateQuestion(
  planType: string,
  opts?: { moduleCode?: string | null; topSourceLabel?: string | null }
): string {
  const programName =
    (opts?.moduleCode?.toUpperCase().includes("ACTIVE_ASSAILANT")) ||
    (opts?.topSourceLabel?.includes("Active Assailant"))
      ? "Active Assailant Emergency Action Plan"
      : "Emergency Action Plan";
  const article = needsAn(programName) ? "an" : "a";
  return `Does the facility have ${article} ${programName}?`;
}
