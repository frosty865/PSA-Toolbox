/**
 * POST /api/admin/modules/[moduleCode]/plan-schema/rebuild
 * Re-derives schema and sets it active; previous schema becomes inactive.
 * Body: { structure_source_registry_id: string, pdf_path?: string }.
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import { resolvePlanSchemaEngine, type PlanSchemaEngine } from "@/app/lib/config/plan_schema_engine";
import { derivePlanSchemaFromEngine } from "@/app/lib/plans/schema/plan_schema_engine";
import { insertActivePlanSchema } from "@/app/lib/plans/schema/persist";
import { planSchemaHash } from "@/app/lib/plans/schema/hash";
import { classifyPlanSourceRole } from "@/app/lib/modules/plan_ecosystem/source_roles";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");

export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
): Promise<NextResponse> {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode ?? "").trim();
    if (!normalized) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }

    let body: { structure_source_registry_id?: string; pdf_path?: string; engine?: string } = {};
    try {
      body = (await req.json().catch(() => ({}))) as typeof body;
    } catch {
      // ignore
    }
    const structure_source_registry_id = (body.structure_source_registry_id ?? "").trim() || null;
    const pdf_path = (body.pdf_path ?? "").trim() || null;
    const engine: PlanSchemaEngine = resolvePlanSchemaEngine(body.engine);

    if (!structure_source_registry_id) {
      return NextResponse.json(
        { error: "structure_source_registry_id required", hint: "Provide the structure source (template) registry ID." },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();
    const modQuery = `SELECT module_code, standard_class FROM public.assessment_modules WHERE module_code ILIKE $1 LIMIT 1`;
    guardModuleQuery(modQuery, "plan-schema/rebuild: assessment_modules");
    const mod = await runtimePool.query<{ module_code: string; standard_class: string | null }>(modQuery, [normalized]);
    if (!mod.rows.length) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    const canonicalModuleCode = (mod.rows[0].module_code ?? normalized).trim();
    const standardClass = (mod.rows[0].standard_class ?? "").trim().toUpperCase();
    if (standardClass !== "PHYSICAL_SECURITY_PLAN") {
      return NextResponse.json(
        { error: "Module is not a PLAN module", hint: "Set Standard Class to Physical Security Plan first." },
        { status: 400 }
      );
    }

    const chunksPath = path.join(CHUNKS_DIR, `${canonicalModuleCode}.json`);
    let requirementChunks: { chunk_text: string; source_title: string; page_range?: string | null; locator?: string | null; source_registry_id?: string | null }[] = [];
    if (fs.existsSync(chunksPath)) {
      const rawData = fs.readFileSync(chunksPath, "utf-8");
      let filePayload: {
        chunks?: Array<{
          text?: string;
          chunk_text?: string;
          source_registry_id?: string;
          source_label?: string;
          page_range?: string;
          locator?: string;
          locator_value?: string;
        }>;
        source_index?: Record<string, string>;
      } = {};
      try {
        filePayload = JSON.parse(rawData);
      } catch {
        // leave requirementChunks empty
      }
      const chunks = filePayload?.chunks ?? [];
      const sourceIndex = filePayload?.source_index ?? {};
      const allChunks = chunks.map((c) => ({
        chunk_text: (c.text ?? c.chunk_text ?? "") as string,
        source_title: (c.source_label ?? sourceIndex[c.source_registry_id ?? ""] ?? "Document") as string,
        page_range: c.page_range ?? null,
        locator: (c.locator_value ?? c.locator) ?? null,
        source_registry_id: c.source_registry_id ?? null,
      }));
      const sourceRoleByRegistryId = new Map<string, "REQUIREMENT" | "IMPLEMENTATION">();
      for (const c of allChunks) {
        const id = c.source_registry_id ?? c.source_title;
        if (!sourceRoleByRegistryId.has(id)) {
          const sample = allChunks
            .filter((x) => (x.source_registry_id ?? x.source_title) === id)
            .slice(0, 3)
            .map((x) => x.chunk_text)
            .join("\n");
          sourceRoleByRegistryId.set(id, classifyPlanSourceRole({ title: c.source_title, chunkSample: sample }));
        }
      }
      requirementChunks = allChunks.filter(
        (c) => sourceRoleByRegistryId.get(c.source_registry_id ?? c.source_title) === "REQUIREMENT"
      );
      if (requirementChunks.length === 0) requirementChunks = allChunks;
    }

    if (requirementChunks.length === 0 && !pdf_path) {
      return NextResponse.json(
        {
          error: "No requirement chunks or PDF path",
          hint: "Export chunks (run Standard Generate or export) so data/module_chunks/<module>.json exists, or provide pdf_path in the request body.",
        },
        { status: 400 }
      );
    }

    const snapshot = await derivePlanSchemaFromEngine({
      module_code: canonicalModuleCode,
      structure_source_registry_id,
      engine_mode: engine,
      pdf_path: pdf_path ?? undefined,
      requirement_chunks: requirementChunks.map((c) => ({
        chunk_text: c.chunk_text,
        source_title: c.source_title,
        page_range: c.page_range,
        locator: c.locator,
        source_registry_id: c.source_registry_id,
      })),
    });

    const { plan_schema_id } = await insertActivePlanSchema(snapshot);
    const sections_count = snapshot.sections.length;
    const elements_count = snapshot.sections.reduce((sum, s) => sum + s.elements.length, 0);

    const payload: Record<string, unknown> = {
      ok: true,
      plan_schema_engine: engine,
      plan_schema_id,
      module_code: canonicalModuleCode,
      structure_source_registry_id,
      derive_method: snapshot.derive_method,
      confidence: snapshot.confidence,
      schema_hash: planSchemaHash(snapshot),
      sections_count,
      elements_count,
    };
    if (process.env.DEBUG_PLAN_SCHEMA === "1") {
      payload.payload_kind = "toc";
      payload.payload_keys = ["toc"];
      payload.derive_method_candidate = snapshot.derive_method;
    }
    return NextResponse.json(payload);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const message = err.message;
    const code = (err as Error & { code?: string }).code;
    if (code === "PLAN_SCHEMA_PARSE_FAILED") {
      return NextResponse.json(
        { error: "Plan schema derivation could not parse structure output", message: message.slice(0, 200) },
        { status: 500 }
      );
    }
    if (code === "PLAN_SCHEMA_UNEXPECTED_PAYLOAD_FOR_TOC" || code === "PLAN_SCHEMA_TOC_PAYLOAD_INVALID") {
      return NextResponse.json(
        { error: "Plan schema received unexpected payload shape (expected TOC from PDF extractor)", message: message.slice(0, 200) },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Plan schema rebuild failed", message },
      { status: 500 }
    );
  }
}
