/**
 * Build plan generation output (criteria + OFCs + checklist) from stored derived schema.
 * Requirement sources define what should exist; they do not satisfy observations.
 * When chunks are available, only elements WITHOUT implementation evidence are emitted (vulnerabilities).
 * Each emitted element has exactly one OFC. Citations from requirement chunks (top 1-2).
 */

import * as fs from "fs";
import * as path from "path";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import { classifyPlanSourceRole } from "./source_roles";
import { hasImplementationEvidence } from "./evidence";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");

export interface PlanOutputFromSchemaRow {
  section_order: number;
  section_key: string;
  section_title: string;
  element_order: number;
  element_key: string;
  element_title: string;
  observation: string;
  ofc: string;
  impact: string;
  evidence_terms: string[] | null;
}

export interface PlanCitationStub {
  criterion_key: string;
  template_key: string;
  source_title: string;
  source_url?: string | null;
  locator_type?: string | null;
  locator_value?: string | null;
}

export interface PlanOutputFromSchema {
  criteria: Array<{
    criterion_key: string;
    title: string;
    question_text: string;
    applicability: "APPLIES";
    discipline_subtype_id: string;
    order_index: number;
  }>;
  ofcs: Array<{
    criterion_key: string;
    template_key: string;
    ofc_text: string;
    ofc_reason?: string;
    discipline_subtype_id: string;
    order_index: number;
  }>;
  checklist_items: Array<{ id: string; text: string; subitems?: string[] }>;
  plan_type: string;
  citations?: PlanCitationStub[];
}

/** Exact UI text per PLAN spec: question and OFC. */
const PLAN_QUESTION_PREFIX = "Does the plan include documented procedures for ";
const PLAN_QUESTION_SUFFIX = "?";
const PLAN_OFC_BODY_PREFIX = "Ensure the plan includes documented procedures for ";
const PLAN_OFC_IMPACT = "Lack of documented procedures for this element may limit coordinated response during an incident.";

/**
 * Load derived schema for module and build criteria + OFCs (one per element).
 * Prefers schema-first (plan_schemas) when active; falls back to plan_schema_registry.
 * Throws if no schema: "Plan schema not derived. Run derive-schema first."
 */
export async function buildPlanOutputFromDerivedSchema(
  moduleCode: string,
  defaultDisciplineSubtypeId: string
): Promise<PlanOutputFromSchema> {
  const runtimePool = getRuntimePool();

  // Schema-first: try plan_schemas (versioned) first
  const activeSchemaQuery = `SELECT id FROM public.plan_schemas WHERE module_code = $1 AND is_active = true LIMIT 1`;
  guardModuleQuery(activeSchemaQuery, "buildPlanOutputFromDerivedSchema: plan_schemas");
  const activeSchema = await runtimePool.query<{ id: string }>(activeSchemaQuery, [moduleCode]);
  if (activeSchema.rows.length > 0) {
    const planSchemaId = activeSchema.rows[0].id;
    const schemaFirstRowsQuery = `
      SELECT sec.section_ord, sec.section_key, sec.section_title,
             el.element_ord, el.element_key, el.element_label
      FROM public.plan_schemas_sections sec
      JOIN public.plan_schemas_elements el ON el.section_id = sec.id
      WHERE sec.plan_schema_id = $1
      ORDER BY sec.section_ord, el.element_ord`;
    guardModuleQuery(schemaFirstRowsQuery, "buildPlanOutputFromDerivedSchema: plan_schemas_sections/elements");
    const schemaFirstRows = await runtimePool.query<{ section_ord: number; section_key: string; section_title: string; element_ord: number; element_key: string; element_label: string }>(
      schemaFirstRowsQuery,
      [planSchemaId]
    );
    const sectionRowsQuery = `SELECT section_ord, section_key, section_title FROM public.plan_schemas_sections WHERE plan_schema_id = $1 ORDER BY section_ord`;
    guardModuleQuery(sectionRowsQuery, "buildPlanOutputFromDerivedSchema: plan_schemas_sections list");
    const sectionRows = await runtimePool.query<{ section_ord: number; section_key: string; section_title: string }>(sectionRowsQuery, [planSchemaId]);
    const seenElementKeys = new Set<string>();
    const dedupedRows = schemaFirstRows.rows.filter((r) => {
      const key = `${r.section_key}::${r.element_key}`;
      if (seenElementKeys.has(key)) return false;
      seenElementKeys.add(key);
      return true;
    });
    let orderIndex = 1;
    const criteria: PlanOutputFromSchema["criteria"] = [];
    const ofcs: PlanOutputFromSchema["ofcs"] = [];
    const checklist_items = sectionRows.rows.map((s) => ({
      id: `sec_${s.section_key}`,
      text: s.section_title,
      subitems: [] as string[],
    }));
    for (const r of dedupedRows) {
      const criterion_key = `ELT_${orderIndex.toString().padStart(3, "0")}`;
      const template_key = `MOD_OFC_${moduleCode}_${criterion_key}_1`;
      criteria.push({
        criterion_key,
        title: r.element_label,
        question_text: PLAN_QUESTION_PREFIX + r.element_label + PLAN_QUESTION_SUFFIX,
        applicability: "APPLIES",
        discipline_subtype_id: defaultDisciplineSubtypeId,
        order_index: orderIndex,
      });
      ofcs.push({
        criterion_key,
        template_key,
        ofc_text: PLAN_OFC_BODY_PREFIX + r.element_label + ".",
        ofc_reason: PLAN_OFC_IMPACT,
        discipline_subtype_id: defaultDisciplineSubtypeId,
        order_index: orderIndex,
      });
      orderIndex++;
    }
    return {
      criteria,
      ofcs,
      checklist_items,
      plan_type: "Derived from plan schema (schema-first)",
    };
  }

  const regQuery = `SELECT id FROM public.plan_schema_registry WHERE module_code = $1 LIMIT 1`;
  guardModuleQuery(regQuery, "buildPlanOutputFromDerivedSchema: plan_schema_registry");
  const reg = await runtimePool.query<{ id: string }>(regQuery, [moduleCode]);
  if (!reg.rows.length) {
    const err = new Error("Plan schema not derived. Run derive-schema first.");
    (err as Error & { code?: string }).code = "PLAN_SCHEMA_NOT_DERIVED";
    throw err;
  }

  const schemaId = reg.rows[0].id;
  const rowsQuery = `
    SELECT s.section_order, s.section_key, s.section_title,
           e.element_order, e.element_key, e.element_title, e.observation, e.ofc, e.impact, e.evidence_terms
    FROM public.plan_schema_sections s
    JOIN public.plan_schema_elements e ON e.section_id = s.id
    WHERE s.schema_id = $1
    ORDER BY s.section_order, e.element_order`;
  guardModuleQuery(rowsQuery, "buildPlanOutputFromDerivedSchema: sections/elements");
  const rows = await runtimePool.query<PlanOutputFromSchemaRow>(rowsQuery, [schemaId]);

  const sectionsQuery = `SELECT section_order, section_key, section_title FROM public.plan_schema_sections WHERE schema_id = $1 ORDER BY section_order`;
  guardModuleQuery(sectionsQuery, "buildPlanOutputFromDerivedSchema: sections");
  const sectionRows = await runtimePool.query<{ section_order: number; section_key: string; section_title: string }>(
    sectionsQuery,
    [schemaId]
  );

  let requirementChunks: Array<{ chunk_text: string; source_title: string; page_range?: string; locator?: string; source_registry_id?: string }> = [];
  let implementationChunks: Array<{ chunk_text: string }> = [];
  const chunksPath = path.join(CHUNKS_DIR, `${moduleCode}.json`);
  if (fs.existsSync(chunksPath)) {
    try {
      const raw = fs.readFileSync(chunksPath, "utf-8");
      const payload = JSON.parse(raw) as { chunks?: Array<{ text?: string; chunk_text?: string; source_label?: string; source_registry_id?: string; page_range?: string; locator_value?: string; locator?: string }>; source_index?: Record<string, string> };
      const allChunks = (payload.chunks ?? []).map((c) => ({
        chunk_text: (c.text ?? c.chunk_text ?? "") as string,
        source_title: (c.source_label ?? payload.source_index?.[c.source_registry_id ?? ""] ?? "Document") as string,
        source_registry_id: c.source_registry_id,
        page_range: c.page_range,
        locator: (c.locator_value ?? c.locator) ?? undefined,
      }));
      const roleBySource = new Map<string, "REQUIREMENT" | "IMPLEMENTATION">();
      for (const c of allChunks) {
        const key = c.source_registry_id ?? c.source_title;
        if (!roleBySource.has(key)) {
          const sample = allChunks.filter((x) => (x.source_registry_id ?? x.source_title) === key).slice(0, 3).map((x) => x.chunk_text).join("\n");
          roleBySource.set(key, classifyPlanSourceRole({ title: c.source_title, chunkSample: sample }));
        }
      }
      requirementChunks = allChunks.filter((c) => roleBySource.get(c.source_registry_id ?? c.source_title) === "REQUIREMENT");
      implementationChunks = allChunks.filter((c) => roleBySource.get(c.source_registry_id ?? c.source_title) === "IMPLEMENTATION").map((c) => ({ chunk_text: c.chunk_text }));
    } catch {
      /* ignore; proceed without evidence filtering */
    }
  }

  const criteria: PlanOutputFromSchema["criteria"] = [];
  const ofcs: PlanOutputFromSchema["ofcs"] = [];
  const citations: PlanCitationStub[] = [];
  let orderIndex = 1;
  const requirementTop = requirementChunks.length > 0 ? requirementChunks[0] : null;

  for (const r of rows.rows) {
    const satisfied =
      implementationChunks.length > 0 &&
      hasImplementationEvidence({
        implementationChunks,
        evidenceTerms: (r.evidence_terms ?? []).filter(Boolean),
      });
    if (satisfied) continue;

    const criterion_key = `ELT_${orderIndex.toString().padStart(3, "0")}`;
    const template_key = `MOD_OFC_${moduleCode}_${criterion_key}_1`;
    criteria.push({
      criterion_key,
      title: r.element_title,
      question_text: PLAN_QUESTION_PREFIX + r.element_title + PLAN_QUESTION_SUFFIX,
      applicability: "APPLIES",
      discipline_subtype_id: defaultDisciplineSubtypeId,
      order_index: orderIndex,
    });
    ofcs.push({
      criterion_key,
      template_key,
      ofc_text: PLAN_OFC_BODY_PREFIX + r.element_title + ".",
      ofc_reason: PLAN_OFC_IMPACT,
      discipline_subtype_id: defaultDisciplineSubtypeId,
      order_index: orderIndex,
    });
    if (requirementTop) {
      citations.push({
        criterion_key,
        template_key,
        source_title: requirementTop.source_title,
        source_url: null,
        locator_type: requirementTop.locator ? "page" : null,
        locator_value: requirementTop.page_range ?? requirementTop.locator ?? null,
      });
    }
    orderIndex++;
  }

  const checklist_items = sectionRows.rows.map((s) => ({
    id: `sec_${s.section_key}`,
    text: s.section_title,
    subitems: [] as string[],
  }));

  return {
    criteria,
    ofcs,
    checklist_items,
    plan_type: "Derived from plan schema",
    ...(citations.length > 0 ? { citations } : {}),
  };
}
