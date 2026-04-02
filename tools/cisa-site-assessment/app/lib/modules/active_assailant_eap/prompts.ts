/**
 * Active Assailant EAP — uses canonical plan-extract prompt (all plan types).
 * No questions, rationales, or OFCs.
 */

import {
  buildCanonicalPlanExtractUserMessage,
  CANONICAL_PLAN_EXTRACT_SYSTEM_PROMPT,
} from "@/app/lib/modules/plan_extract/canonical";

/** Re-export canonical system prompt (single reusable prompt for ALL plans). */
export const ACTIVE_ASSAILANT_EAP_SYSTEM_PROMPT = CANONICAL_PLAN_EXTRACT_SYSTEM_PROMPT;

/** Plan type name for user message. */
export const ACTIVE_ASSAILANT_EAP_PLAN_TYPE = "Active Assailant Emergency Action Plan";

/**
 * Build user message for Ollama using canonical contract.
 * Prefer chunks that contain table of contents or section headings.
 */
export function buildActiveAssailantEapUserMessage(chunkTexts: string[]): string {
  const sourceText = chunkTexts.map((t, i) => `[Chunk ${i + 1}]\n${t}`).join("\n\n");
  return buildCanonicalPlanExtractUserMessage(ACTIVE_ASSAILANT_EAP_PLAN_TYPE, sourceText);
}
