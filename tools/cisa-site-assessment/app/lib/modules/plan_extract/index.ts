/**
 * Canonical plan extraction — single reusable Ollama prompt + frozen JSON schema.
 * Use for ALL plan types. Only plan type and source text vary.
 */

export {
  buildCanonicalPlanExtractUserMessage,
  CANONICAL_PLAN_EXTRACT_SCHEMA_JSON,
  CANONICAL_PLAN_EXTRACT_SYSTEM_PROMPT,
  type CanonicalPlanElement,
  type CanonicalPlanExtract,
} from "./canonical";
