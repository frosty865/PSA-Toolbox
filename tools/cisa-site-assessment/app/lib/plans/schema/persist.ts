/**
 * Persist and retrieve versioned plan schemas (schema-first pipeline).
 * ensureActivePlanSchema: return existing active or insert new and set previous inactive.
 */

import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import type { PlanSchemaSnapshot } from "./types";
import { planSchemaHash } from "./hash";

export interface ActivePlanSchemaRow {
  id: string;
  module_code: string;
  structure_source_registry_id: string;
  derive_method: string;
  confidence: string;
  schema_hash: string;
  schema_json: unknown;
  created_at: string;
}

/**
 * Get the active plan schema for a module, if any.
 */
export async function getActivePlanSchema(moduleCode: string): Promise<ActivePlanSchemaRow | null> {
  const runtimePool = getRuntimePool();
  const sql = `SELECT id, module_code, structure_source_registry_id::text, derive_method, confidence, schema_hash, schema_json, created_at::text
    FROM public.plan_schemas WHERE module_code = $1 AND is_active = true LIMIT 1`;
  guardModuleQuery(sql, "getActivePlanSchema");
  const result = await runtimePool.query<ActivePlanSchemaRow>(sql, [moduleCode]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Insert a new plan schema and set it active; deactivate any previous for this module.
 * Returns the new schema id.
 */
export async function insertActivePlanSchema(snapshot: PlanSchemaSnapshot): Promise<{ plan_schema_id: string }> {
  const runtimePool = getRuntimePool();
  const hash = planSchemaHash(snapshot);
  const schemaJson = JSON.stringify({
    module_code: snapshot.module_code,
    structure_source_registry_id: snapshot.structure_source_registry_id,
    derive_method: snapshot.derive_method,
    confidence: snapshot.confidence,
    sections: snapshot.sections,
  });

  // Deactivate current active
  const deactivateSql = `UPDATE public.plan_schemas SET is_active = false, updated_at = now() WHERE module_code = $1 AND is_active = true`;
  guardModuleQuery(deactivateSql, "insertActivePlanSchema: deactivate");
  await runtimePool.query(deactivateSql, [snapshot.module_code]);

  // Insert plan_schemas row
  const insSchema = `INSERT INTO public.plan_schemas (module_code, structure_source_registry_id, derive_method, confidence, schema_hash, schema_json, is_active)
    VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, true) RETURNING id`;
  guardModuleQuery(insSchema, "insertActivePlanSchema: insert");
  const schemaResult = await runtimePool.query<{ id: string }>(insSchema, [
    snapshot.module_code,
    snapshot.structure_source_registry_id,
    snapshot.derive_method,
    snapshot.confidence,
    hash,
    schemaJson,
  ]);
  const plan_schema_id = schemaResult.rows[0].id;

  // Insert sections
  for (const sec of snapshot.sections) {
    const insSec = `INSERT INTO public.plan_schemas_sections (plan_schema_id, section_ord, section_key, section_title, source_locator)
      VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`;
    guardModuleQuery(insSec, "insertActivePlanSchema: section");
    const secResult = await runtimePool.query<{ id: string }>(insSec, [
      plan_schema_id,
      sec.section_ord,
      sec.section_key,
      sec.section_title,
      sec.source_locator ? JSON.stringify(sec.source_locator) : null,
    ]);
    const sectionId = secResult.rows[0].id;

    for (const el of sec.elements) {
      const insEl = `INSERT INTO public.plan_schemas_elements (plan_schema_id, section_id, element_ord, element_key, element_label, is_core, source_excerpt, source_locator)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`;
      guardModuleQuery(insEl, "insertActivePlanSchema: element");
      await runtimePool.query(insEl, [
        plan_schema_id,
        sectionId,
        el.element_ord,
        el.element_key,
        el.element_label,
        el.is_core,
        el.source_excerpt ?? null,
        el.source_locator ? JSON.stringify(el.source_locator) : null,
      ]);
    }
  }

  return { plan_schema_id };
}

/**
 * Ensure an active plan schema exists: return existing if same structure_source_registry_id, else derive and insert.
 * Caller must provide a derive function that returns PlanSchemaSnapshot (with pdf_path/chunks as needed).
 */
export async function ensureActivePlanSchema(
  moduleCode: string,
  structureSourceRegistryId: string,
  derive: () => Promise<PlanSchemaSnapshot>
): Promise<{ plan_schema_id: string; created: boolean }> {
  const existing = await getActivePlanSchema(moduleCode);
  if (existing && existing.structure_source_registry_id === structureSourceRegistryId) {
    return { plan_schema_id: existing.id, created: false };
  }
  const snapshot = await derive();
  const { plan_schema_id } = await insertActivePlanSchema(snapshot);
  return { plan_schema_id, created: true };
}
