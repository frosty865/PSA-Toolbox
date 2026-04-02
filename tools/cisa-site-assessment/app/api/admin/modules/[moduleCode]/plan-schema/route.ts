/**
 * GET /api/admin/modules/[moduleCode]/plan-schema
 * Returns active schema summary + snapshot (derive_method, confidence, structure_source_registry_id, schema_hash, created_at).
 * Single source of truth for PLAN UI: sections/elements and counts come from this response.
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import { getActivePlanSchema } from "@/app/lib/plans/schema/persist";
import { getPlanSchemaEngine } from "@/app/lib/config/plan_schema_engine";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");

function resolveStructureSourceTitle(moduleCode: string, structureSourceRegistryId: string | null): string | null {
  if (!structureSourceRegistryId) return null;
  const chunksPath = path.join(CHUNKS_DIR, `${moduleCode}.json`);
  if (!fs.existsSync(chunksPath)) return null;
  try {
    const raw = fs.readFileSync(chunksPath, "utf-8");
    const payload = JSON.parse(raw) as { source_index?: Record<string, string>; chunks?: Array<{ source_registry_id?: string; source_label?: string }> };
    const fromIndex = payload.source_index?.[structureSourceRegistryId];
    if (fromIndex) return fromIndex;
    const chunk = payload.chunks?.find((c) => c.source_registry_id === structureSourceRegistryId);
    return chunk?.source_label ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
): Promise<NextResponse> {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode ?? "").trim();
    if (!normalized) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }

    const engine = getPlanSchemaEngine();
    const active = await getActivePlanSchema(normalized);
    if (!active) {
      return NextResponse.json(
        {
          ok: true,
          plan_schema_engine: engine,
          active: false,
          message: "No active plan schema for this module. Derive or rebuild to create one.",
          sections_count: 0,
          elements_count: 0,
        },
        { status: 200 }
      );
    }

    const runtimePool = getRuntimePool();
    const sectionsSql = `SELECT COUNT(*)::int AS n FROM public.plan_schemas_sections WHERE plan_schema_id = $1`;
    const elementsSql = `SELECT COUNT(*)::int AS n FROM public.plan_schemas_elements WHERE plan_schema_id = $1`;
    guardModuleQuery(sectionsSql, "plan-schema: sections count");
    guardModuleQuery(elementsSql, "plan-schema: elements count");
    const [sectionsRes, elementsRes] = await Promise.all([
      runtimePool.query<{ n: number }>(sectionsSql, [active.id]),
      runtimePool.query<{ n: number }>(elementsSql, [active.id]),
    ]);
    const sections_count = sectionsRes.rows[0]?.n ?? 0;
    const elements_count = elementsRes.rows[0]?.n ?? 0;
    const structure_source_title = resolveStructureSourceTitle(normalized, active.structure_source_registry_id);

    return NextResponse.json({
      ok: true,
      plan_schema_engine: engine,
      active: true,
      plan_schema_id: active.id,
      module_code: active.module_code,
      structure_source_registry_id: active.structure_source_registry_id,
      structure_source_title: structure_source_title ?? undefined,
      derive_method: active.derive_method,
      confidence: active.confidence,
      schema_hash: active.schema_hash,
      created_at: active.created_at,
      sections_count,
      elements_count,
      schema_json: active.schema_json,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Failed to load plan schema", message },
      { status: 500 }
    );
  }
}
