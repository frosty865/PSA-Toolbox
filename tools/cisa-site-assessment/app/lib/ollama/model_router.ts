/**
 * Central model selection and routing for Ollama.
 * - Metadata: PSA_METADATA_MODEL only (title/publisher/date/synopsis extraction).
 * - Standards: OLLAMA_PLAN_STANDARD_MODEL / OLLAMA_OBJECT_STANDARD_MODEL (fallback PSA_*) — never metadata/base llama.
 * - General: healthcheck, non-standards inference.
 */

/** Model for metadata extraction only (publisher, title, date, synopsis, sector, subsector). Do not use for standards. */
export function getMetadataModel(): string {
  return (process.env.PSA_METADATA_MODEL || 'PSA_Ollama_Model:latest').trim() || 'PSA_Ollama_Model:latest';
}

/**
 * Single resolver for plan/object standards generation. Prefer OLLAMA_* env, then PSA_*, then locked defaults.
 * Never falls back to PSA_Ollama_Model or base llama unless explicitly set in env.
 */
export function resolveStandardsModel(standardType: 'plan' | 'object'): string {
  if (standardType === 'plan') {
    const v = (process.env.OLLAMA_PLAN_STANDARD_MODEL ?? process.env.PSA_PLAN_STANDARD_MODEL ?? 'psa-plan-standard:latest').trim();
    return v || 'psa-plan-standard:latest';
  }
  if (standardType === 'object') {
    const v = (process.env.OLLAMA_OBJECT_STANDARD_MODEL ?? process.env.PSA_OBJECT_STANDARD_MODEL ?? 'psa-object-standard:latest').trim();
    return v || 'psa-object-standard:latest';
  }
  return (process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2:latest').trim() || 'llama3.2:latest';
}

/** Model for PLAN standard generation (deterministic JSON: required_elements, criteria, evidence_examples). */
export function getPlanStandardModel(): string {
  return resolveStandardsModel('plan');
}

/** Model for OBJECT standard generation (deterministic JSON: required_elements, criteria, field_checks). */
export function getObjectStandardModel(): string {
  return resolveStandardsModel('object');
}

/** Model for general inference (healthcheck, non-standards). Do not use for metadata or standards. */
export function getGeneralModel(): string {
  return (process.env.PSA_GENERAL_MODEL || 'llama3.2:latest').trim() || 'llama3.2:latest';
}

/** Embedding model (e.g. RAG). */
export function getEmbedModel(): string {
  return (process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text:latest').trim() || 'nomic-embed-text:latest';
}

/**
 * Model for module chunk comprehension (signals, priority, supports_question_generation).
 * Used by run_module_comprehension.ts and comprehension build route.
 * Prefer OLLAMA_COMPREHENSION_MODEL, then PSA_* / MODULE_*, then default.
 */
export function getComprehensionModel(): string {
  const v = (
    process.env.OLLAMA_COMPREHENSION_MODEL ??
    process.env.PSA_COMPREHENSION_MODEL ??
    process.env.MODULE_COMPREHENSION_MODEL ??
    'llama3.1:8b-instruct'
  ).trim();
  return v || 'llama3.1:8b-instruct';
}

/** Select standards model by standard type. Never returns metadata model. */
export function modelForStandardType(standardType: 'plan' | 'object'): string {
  return resolveStandardsModel(standardType);
}

export type StandardType = 'plan' | 'object';

/**
 * Validate parsed standard JSON from Ollama (plan/object standard schema).
 * Fail fast with clear error including model name.
 */
export function validateStandardSchema(
  parsed: unknown,
  expectedType: StandardType,
  modelName: string
): asserts parsed is { standard_type: string; required_elements: unknown[] } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `Standards response is not a JSON object (model=${modelName}). Expected object with standard_type and required_elements.`
    );
  }
  const obj = parsed as Record<string, unknown>;
  const st = obj.standard_type;
  if (typeof st !== 'string' || !st.trim()) {
    throw new Error(
      `Standards response missing or invalid standard_type (model=${modelName}). Got: ${JSON.stringify(st)}.`
    );
  }
  const normalized = st.trim().toLowerCase();
  const expected = expectedType === 'plan' ? 'plan' : 'object';
  if (normalized !== expected) {
    throw new Error(
      `Standards response standard_type mismatch (model=${modelName}). Expected "${expected}", got "${normalized}".`
    );
  }
  const elements = obj.required_elements;
  if (!Array.isArray(elements) || elements.length < 1) {
    throw new Error(
      `Standards response must have required_elements array with at least 1 item (model=${modelName}). Got: ${Array.isArray(elements) ? elements.length : typeof elements}.`
    );
  }
  if (elements.length < 8 || elements.length > 12) {
    throw new Error(
      `Standards response required_elements must have 8–12 items (model=${modelName}). Got: ${elements.length}.`
    );
  }
}
