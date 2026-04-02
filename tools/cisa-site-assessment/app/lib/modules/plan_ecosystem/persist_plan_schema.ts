/**
 * Persist derived plan schema (idempotent by source_set_hash).
 * Writes to plan_schema_registry + plan_schema_sections + plan_schema_elements (legacy tables).
 * Do not add is_vital: plan_schema_elements (20260205) has no such column; use is_core in schema-first (plan_schemas_elements) only.
 */

import { createHash } from "crypto";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import type { DerivedPlanSchema } from "./derived_schema_types";

/** Allowed columns for plan_schema_elements INSERT. If you add a column, add a migration first then add here. */
const ALLOWED_PLAN_SCHEMA_ELEMENTS_INSERT_COLUMNS = [
  "section_id",
  "element_order",
  "element_key",
  "element_title",
  "observation",
  "ofc",
  "impact",
  "evidence_terms",
] as const;

function assertElementInsertNoDisallowedColumns(insertSql: string): void {
  if (insertSql.includes("is_vital")) {
    throw new Error(
      "PLAN_SCHEMA_DB_COLUMN_MISMATCH: attempted=is_vital missing_in_db=true. Use only: " +
        ALLOWED_PLAN_SCHEMA_ELEMENTS_INSERT_COLUMNS.join(", ")
    );
  }
}

export function computeSourceSetHash(sourceRegistryIds: string[]): string {
  const sorted = [...new Set(sourceRegistryIds)].filter(Boolean).sort();
  return createHash("sha256").update(sorted.join("|")).digest("hex");
}

export const PLAN_SCHEMA_VERSION = 2;

export type PlanSchemaDeriveMethod = "TOC" | "HEADINGS" | "LEGACY_LLM";
export type PlanSchemaConfidence = "HIGH" | "MEDIUM" | "LOW";

export async function upsertPlanSchema(args: {
  module_code: string;
  source_set_hash: string;
  derived_model?: string | null;
  schema: DerivedPlanSchema;
  schema_version?: number;
  structure_trust?: string;
  structure_source_registry_id?: string | null;
  engine_used?: string | null;
  derive_method?: PlanSchemaDeriveMethod | null;
  confidence?: PlanSchemaConfidence | null;
  model_used?: string | null;
}): Promise<{ schema_id: string }> {
  const runtimePool = getRuntimePool();
  const {
    module_code,
    source_set_hash,
    derived_model,
    schema,
    schema_version = PLAN_SCHEMA_VERSION,
    structure_trust = "BALANCED",
    structure_source_registry_id = null,
    engine_used = null,
    derive_method = null,
    confidence = null,
    model_used = null,
  } = args;

  const existingQuery = `SELECT id, source_set_hash, schema_version FROM public.plan_schema_registry WHERE module_code = $1 LIMIT 1`;
  guardModuleQuery(existingQuery, "upsertPlanSchema: select");
  const existing = await runtimePool.query<{ id: string; source_set_hash: string; schema_version: number }>(existingQuery, [
    module_code,
  ]);

  if (existing.rows.length && existing.rows[0].source_set_hash === source_set_hash && existing.rows[0].schema_version === schema_version) {
    return { schema_id: existing.rows[0].id };
  }

  if (existing.rows.length) {
    const delQuery = `DELETE FROM public.plan_schema_registry WHERE module_code = $1`;
    guardModuleQuery(delQuery, "upsertPlanSchema: delete");
    await runtimePool.query(delQuery, [module_code]);
  }

  const insertRegQuery = `INSERT INTO public.plan_schema_registry (module_code, schema_version, source_set_hash, derived_model, structure_trust, structure_source_registry_id, notes, engine_used, derive_method, confidence, model_used)
    VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10) RETURNING id`;
  guardModuleQuery(insertRegQuery, "upsertPlanSchema: insert registry");
  const regResult = await runtimePool.query<{ id: string }>(insertRegQuery, [
    module_code,
    schema_version,
    source_set_hash,
    derived_model ?? null,
    structure_trust,
    structure_source_registry_id ?? null,
    engine_used ?? null,
    derive_method ?? null,
    confidence ?? null,
    model_used ?? null,
  ]);
  const schema_id = regResult.rows[0].id;

  for (let i = 0; i < schema.sections.length; i++) {
    const sec = schema.sections[i];
    const insSec = `INSERT INTO public.plan_schema_sections (schema_id, section_order, section_key, section_title)
      VALUES ($1, $2, $3, $4) RETURNING id`;
    guardModuleQuery(insSec, "upsertPlanSchema: insert section");
    const secResult = await runtimePool.query<{ id: string }>(insSec, [
      schema_id,
      i + 1,
      sec.section_key,
      sec.section_title,
    ]);
    const sectionId = secResult.rows[0].id;

    for (let j = 0; j < sec.elements.length; j++) {
      const el = sec.elements[j];
      const insEl = `INSERT INTO public.plan_schema_elements (section_id, element_order, element_key, element_title, observation, ofc, impact, evidence_terms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
      assertElementInsertNoDisallowedColumns(insEl);
      guardModuleQuery(insEl, "upsertPlanSchema: insert element");
      await runtimePool.query(insEl, [
        sectionId,
        j + 1,
        el.element_key,
        el.element_title,
        el.observation,
        el.ofc,
        el.impact,
        el.evidence_terms?.length ? el.evidence_terms : null,
      ]);
    }
  }

  return { schema_id };
}
