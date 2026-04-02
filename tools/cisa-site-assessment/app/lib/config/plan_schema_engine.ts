/**
 * Plan schema derivation engine: TOC_PREFERRED (deterministic TOC/sub-entries) vs LEGACY (intent + LLM).
 * Env: PLAN_SCHEMA_ENGINE=TOC_PREFERRED | LEGACY (default TOC_PREFERRED).
 */

export type PlanSchemaEngine = "TOC_PREFERRED" | "LEGACY";

const VALID: Set<string> = new Set(["TOC_PREFERRED", "LEGACY"]);
const DEFAULT: PlanSchemaEngine = "TOC_PREFERRED";

/**
 * Read engine from env. Valid values: TOC_PREFERRED, LEGACY. Default TOC_PREFERRED.
 */
export function getPlanSchemaEngineFromEnv(): PlanSchemaEngine {
  const v = (process.env.PLAN_SCHEMA_ENGINE ?? "").trim().toUpperCase();
  return VALID.has(v) ? (v as PlanSchemaEngine) : DEFAULT;
}

/**
 * Alias for admin/config: returns current engine (env only). Use resolvePlanSchemaEngine when param override is needed.
 */
export function getPlanSchemaEngine(): PlanSchemaEngine {
  return getPlanSchemaEngineFromEnv();
}

/**
 * Resolve engine: param overrides env. Used by derive-schema route (query/body engine param).
 */
export function resolvePlanSchemaEngine(param: string | null | undefined): PlanSchemaEngine {
  const v = (param ?? "").trim().toUpperCase();
  if (VALID.has(v)) return v as PlanSchemaEngine;
  return getPlanSchemaEngineFromEnv();
}
