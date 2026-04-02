/**
 * Plan Impact Statements — frozen schemas, validation, postprocess, two-pass prompts.
 * Plans = gate + checklist + optional impacts. No stakeholder-facing OFCs.
 */

export {
  normalizeImpactOutput,
  normalizeImpactSentence,
} from "./impact_postprocess";
export { validateImpactPair } from "./impact_quality";
export {
  buildImpactPassAUserMessage,
  buildImpactPassBUserMessage,
  IMPACT_PASS_A_OUTPUT_SCHEMA,
  IMPACT_PASS_A_SYSTEM_PROMPT,
  IMPACT_PASS_B_OUTPUT_SCHEMA,
  IMPACT_PASS_B_RETRY_INSTRUCTION,
  IMPACT_PASS_B_SYSTEM_PROMPT,
} from "./prompts";
export type {
  ChecklistItemPayload,
  EvidenceBullet,
  EvidenceBulletsOutput,
  GateQuestion,
  ImpactCitation,
  ImpactOnlyOutput,
  ImpactStatementOutput,
  ImpactStatementPayload,
  PlanAssessmentPayload,
  PlanStructure,
  PlanStructureElement,
} from "./types";
