import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * GET /api/admin/modules/[moduleCode]/export
 * 
 * Exports module data as JSON in import format for editing.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();

    // Get module metadata
    const m = await runtimePool.query(
      `SELECT module_code, module_name, description, status
       FROM public.assessment_modules 
       WHERE module_code = $1`,
      [normalizedModuleCode]
    );
    
    if (!m.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const moduleRow = m.rows[0] as Record<string, unknown>;

    // Get module questions
    const moduleQs = await runtimePool.query(
      `SELECT 
        mq.module_question_id as id,
        mq.question_text as text,
        mq.order_index as "order",
        mq.discipline_id,
        mq.discipline_subtype_id,
        mq.asset_or_location,
        mq.event_trigger
       FROM public.module_questions mq
       WHERE mq.module_code = $1
       ORDER BY mq.order_index ASC`,
      [normalizedModuleCode]
    );

    // Get module OFCs
    const ofcs = await runtimePool.query(
      `SELECT 
        id,
        ofc_id,
        ofc_text,
        order_index,
        source_system,
        source_ofc_id,
        source_ofc_num
       FROM public.module_ofcs
       WHERE module_code = $1
       ORDER BY order_index ASC`,
      [normalizedModuleCode]
    );

    // Get sources for OFCs
    const ofcIds = ofcs.rows.map((r: Record<string, unknown>) => r.id);
    const sourcesMap: Record<string, Array<{ url: string; label: string | null }>> = {};
    
    if (ofcIds.length > 0) {
      const sources = await runtimePool.query(
        `SELECT module_ofc_id, source_url, source_label
         FROM public.module_ofc_sources
         WHERE module_ofc_id = ANY($1::uuid[])
         ORDER BY created_at ASC`,
        [ofcIds]
      );
      
      for (const row of sources.rows as Array<Record<string, unknown>>) {
        const ofcId = String(row.module_ofc_id ?? '');
        if (!sourcesMap[ofcId]) {
          sourcesMap[ofcId] = [];
        }
        sourcesMap[ofcId].push({
          url: String(row.source_url ?? ''),
          label: row.source_label != null ? String(row.source_label) : null
        });
      }
    }

    // Get risk drivers
    const riskDrivers = await runtimePool.query(
      `SELECT driver_type, driver_text
       FROM public.module_risk_drivers
       WHERE module_code = $1
       ORDER BY driver_type ASC, created_at ASC`,
      [normalizedModuleCode]
    );

    const exportData = {
      module_code: moduleRow.module_code,
      title: moduleRow.module_name,
      description: moduleRow.description ?? undefined,
      import_source: `export_${moduleRow.module_code}_${new Date().toISOString().split('T')[0]}.json`,
      mode: "REPLACE",
      module_questions: moduleQs.rows.map((q: Record<string, unknown>) => ({
        id: q.id,
        text: q.text,
        order: q.order,
        discipline_id: q.discipline_id,
        discipline_subtype_id: q.discipline_subtype_id,
        asset_or_location: q.asset_or_location,
        event_trigger: q.event_trigger
      })),
      module_ofcs: ofcs.rows.map((o: Record<string, unknown>) => ({
        ofc_id: o.ofc_id,
        ofc_text: o.ofc_text,
        order_index: o.order_index,
        ...(o.source_system ? { source_system: o.source_system } : {}),
        ...(o.source_ofc_id ? { source_ofc_id: o.source_ofc_id } : {}),
        ...(o.source_ofc_num != null && { source_ofc_num: o.source_ofc_num }),
        sources: sourcesMap[String(o.id ?? '')] ?? []
      })),
      risk_drivers: riskDrivers.rows.map((d: Record<string, unknown>) => ({
        driver_type: d.driver_type,
        driver_text: d.driver_text
      }))
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${moduleRow.module_code}_export.json"`
      }
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[API /api/admin/modules/[moduleCode]/export] Error:`, error);
    return NextResponse.json(
      { error: "Failed to export module", message: err.message },
      { status: 500 }
    );
  }
}
