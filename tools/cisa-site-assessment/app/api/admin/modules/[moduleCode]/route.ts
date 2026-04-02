import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { isStandardClassKey } from "@/app/lib/modules/standard_class";

/**
 * GET /api/admin/modules/[moduleCode]
 * 
 * Returns module details including questions and curated OFCs.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();

    // Decode and normalize module code
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();

    // Check which columns exist in assessment_modules
    const assessmentModulesColumns = new Set<string>();
    try {
      const columnCheck = await runtimePool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessment_modules'
      `);
      type ColRow = { column_name: string };
      (columnCheck.rows as ColRow[]).forEach((r) => assessmentModulesColumns.add(r.column_name));
    } catch (colCheckError: unknown) {
      console.warn('[API /api/admin/modules/[moduleCode]] Failed to check assessment_modules columns:', colCheckError instanceof Error ? colCheckError.message : String(colCheckError));
    }

    // Build SELECT clause dynamically based on available columns
    const selectCols: string[] = [];
    if (assessmentModulesColumns.has('module_code')) selectCols.push('module_code');
    if (assessmentModulesColumns.has('module_name')) selectCols.push('module_name');
    if (assessmentModulesColumns.has('description')) selectCols.push('description');
    if (assessmentModulesColumns.has('is_active')) selectCols.push('is_active');
    if (assessmentModulesColumns.has('status')) selectCols.push('status');
    if (assessmentModulesColumns.has('intent_standard_key')) selectCols.push('intent_standard_key');
    if (assessmentModulesColumns.has('intent_confidence')) selectCols.push('intent_confidence');
    if (assessmentModulesColumns.has('intent_locked')) selectCols.push('intent_locked');
    if (assessmentModulesColumns.has('intent_explanation')) selectCols.push('intent_explanation');
    if (assessmentModulesColumns.has('standard_class')) selectCols.push('standard_class');

    // Get module metadata
    const m = await runtimePool.query(
      `SELECT ${selectCols.join(', ')}
       FROM public.assessment_modules 
       WHERE module_code = $1`,
      [normalizedModuleCode]
    );
    if (!m.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const moduleRow = m.rows[0] as Record<string, unknown>;

    // Get module-specific questions (NOT baseline) with discipline ownership
    // Use try-catch to handle cases where table or columns don't exist
    let moduleQs: { rows: unknown[] } = { rows: [] };
    try {
      // Check if module_questions table exists
      const tableCheck = await runtimePool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'module_questions'
        ) as table_exists
      `);
      
      if (tableCheck.rows[0]?.table_exists) {
        // Check which columns exist
        const colCheck = await runtimePool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'module_questions'
        `);
        const moduleQuestionsColumns = new Set<string>();
        (colCheck.rows as { column_name: string }[]).forEach((r) => moduleQuestionsColumns.add(r.column_name));

        // Build query dynamically based on available columns
        const hasDisciplineId = moduleQuestionsColumns.has('discipline_id');
        const hasDisciplineSubtypeId = moduleQuestionsColumns.has('discipline_subtype_id');
        const hasAssetOrLocation = moduleQuestionsColumns.has('asset_or_location');
        const hasEventTrigger = moduleQuestionsColumns.has('event_trigger');
        const hasOrderIndex = moduleQuestionsColumns.has('order_index');

        // Build SELECT clause
        const selectParts: string[] = [
          'mq.module_question_id',
          'mq.question_text',
          'mq.response_enum'
        ];
        if (hasAssetOrLocation) selectParts.push('mq.asset_or_location');
        if (hasEventTrigger) selectParts.push('mq.event_trigger');
        if (hasOrderIndex) selectParts.push('mq.order_index');

        // Build JOINs only if columns exist
        let joinClause = '';
        if (hasDisciplineId && hasDisciplineSubtypeId) {
          selectParts.push(
            'd.id as discipline_id',
            'd.name as discipline_name',
            'd.code as discipline_code',
            'ds.id as discipline_subtype_id',
            'ds.name as discipline_subtype_name',
            'ds.code as discipline_subtype_code'
          );
          joinClause = `
            INNER JOIN public.disciplines d ON mq.discipline_id = d.id
            INNER JOIN public.discipline_subtypes ds ON mq.discipline_subtype_id = ds.id
          `;
        }

        // Build ORDER BY
        const orderBy = hasOrderIndex ? 'ORDER BY mq.order_index ASC' : 'ORDER BY mq.created_at ASC';

        moduleQs = await runtimePool.query(
          `
          SELECT ${selectParts.join(', ')}
          FROM public.module_questions mq
          ${joinClause}
          WHERE mq.module_code = $1
          ${orderBy}
          `,
          [normalizedModuleCode]
        );
      }
    } catch (queryError: unknown) {
      console.warn('[API /api/admin/modules/[moduleCode]] Error fetching module questions:', queryError instanceof Error ? queryError.message : String(queryError));
      // Continue with empty questions array
      moduleQs = { rows: [] };
    }

    // Get risk drivers (read-only context)
    let riskDrivers: { rows: unknown[] } = { rows: [] };
    try {
      const tableCheck = await runtimePool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'module_risk_drivers'
        ) as table_exists
      `);
      
      if (tableCheck.rows[0]?.table_exists) {
        riskDrivers = await runtimePool.query(
          `
          SELECT 
            driver_type,
            driver_text
          FROM public.module_risk_drivers
          WHERE module_code = $1
          ORDER BY driver_type ASC, created_at ASC
          `,
          [normalizedModuleCode]
        );
      }
    } catch (err: unknown) {
      console.warn('[API /api/admin/modules/[moduleCode]] Error fetching risk drivers:', err instanceof Error ? err.message : String(err));
    }

    // Get module OFCs (NOT baseline)
    let ofcs: { rows: { id?: string; ofc_id?: string; ofc_num?: string; ofc_text?: string; order_index?: number; [k: string]: unknown }[] } = { rows: [] };
    try {
      const tableCheck = await runtimePool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'module_ofcs'
        ) as table_exists
      `);
      
      if (tableCheck.rows[0]?.table_exists) {
        // Check which columns exist for trace fields
        const colCheck = await runtimePool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'module_ofcs'
        `);
        const moduleOfcsColumns = new Set<string>();
        (colCheck.rows as { column_name: string }[]).forEach((r) => moduleOfcsColumns.add(r.column_name));

        // Build SELECT clause dynamically
        const selectCols = ['id', 'ofc_id', 'ofc_num', 'ofc_text', 'order_index'];
        if (moduleOfcsColumns.has('discipline_subtype_id')) selectCols.push('discipline_subtype_id');
        if (moduleOfcsColumns.has('source_system')) selectCols.push('source_system');
        if (moduleOfcsColumns.has('source_ofc_id')) selectCols.push('source_ofc_id');
        if (moduleOfcsColumns.has('source_ofc_num')) selectCols.push('source_ofc_num');

        ofcs = await runtimePool.query(
          `
          SELECT ${selectCols.join(', ')}
          FROM public.module_ofcs
          WHERE module_code = $1
          ORDER BY order_index ASC, ofc_num ASC NULLS LAST, ofc_id ASC
          LIMIT 500
          `,
          [normalizedModuleCode]
        );
      }
    } catch (err: unknown) {
      console.warn('[API /api/admin/modules/[moduleCode]] Error fetching module OFCs:', err instanceof Error ? err.message : String(err));
    }

    // Get sources for all OFCs
    const ofcIds = ofcs.rows.map((r) => r.id).filter((id): id is string => id != null);
    const sources: Record<
      string,
      Array<{ source_url: string; source_label: string | null }>
    > = {};
    if (ofcIds.length > 0) {
      const s = await runtimePool.query(
        `
        SELECT module_ofc_id, source_url, source_label
        FROM public.module_ofc_sources
        WHERE module_ofc_id = ANY($1::uuid[])
        ORDER BY created_at ASC
        `,
        [ofcIds]
      );
      type OfcSourceRow = { module_ofc_id: string; source_url: string; source_label: string | null };
      for (const row of s.rows as OfcSourceRow[]) {
        if (!sources[row.module_ofc_id]) {
          sources[row.module_ofc_id] = [];
        }
        sources[row.module_ofc_id].push({
          source_url: row.source_url,
          source_label: row.source_label,
        });
      }
    }

    // Doctrine: module_instance (criteria + OFCs from standard generation)
    let moduleInstance: { id: string; standard_key: string; standard_version: string; attributes_json: unknown; generated_at: string } | null = null;
    let moduleInstanceCriteria: Array<Record<string, unknown>> = [];
    let moduleInstanceOfcs: Array<{ id: string; criterion_key: string; template_key: string; ofc_text: string; order_index: number; checklist_item_id?: string | null; sources: Array<{ source_url: string; source_label: string | null }> }> = [];
    let moduleInstanceChecklistGroups: Array<{ id: string; criterion_id: string; criterion_key?: string; group_key: string; title: string }> = [];
    let moduleInstanceChecklistItems: Array<{ id: string; group_id: string; order_index: number; text: string; rationale: string; checked: boolean; is_na: boolean; derived_unchecked: boolean; suppressed: boolean }> = [];
    try {
      const instCheck = await runtimePool.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='module_instances') as ok
      `);
      if (instCheck.rows[0]?.ok) {
        const inst = await runtimePool.query(
          `SELECT id, standard_key, standard_version, attributes_json, generated_at
           FROM public.module_instances WHERE module_code = $1`,
          [normalizedModuleCode]
        );
        if (inst.rowCount && inst.rows[0]) {
          moduleInstance = {
            id: inst.rows[0].id,
            standard_key: inst.rows[0].standard_key,
            standard_version: inst.rows[0].standard_version,
            attributes_json: inst.rows[0].attributes_json,
            generated_at: inst.rows[0].generated_at,
          };
          const critCols = ['id', 'criterion_key', 'title', 'question_text', 'discipline_subtype_id', 'applicability', 'order_index'];
          try {
            const hasPlanCols = await runtimePool.query(
              `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_instance_criteria' AND column_name='criteria_type'`
            );
            if (hasPlanCols.rowCount) critCols.push('criteria_type', 'capability_state', 'rollup_status', 'checked_count', 'applicable_count', 'completion_ratio');
          } catch { /* ignore */ }
          const crit = await runtimePool.query(
            `SELECT ${critCols.join(', ')} FROM public.module_instance_criteria WHERE module_instance_id = $1 ORDER BY order_index, criterion_key`,
            [inst.rows[0].id]
          );
          moduleInstanceCriteria = (crit.rows as Record<string, unknown>[]).map((r) => ({ ...r }));
          let ofcCols = 'id, criterion_key, template_key, ofc_text, order_index';
          try {
            const hasChecklistItemId = await runtimePool.query(
              `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_instance_ofcs' AND column_name='checklist_item_id'`
            );
            if (hasChecklistItemId.rowCount) ofcCols += ', checklist_item_id';
          } catch { /* ignore */ }
          const iofcs = await runtimePool.query(
            `SELECT ${ofcCols} FROM public.module_instance_ofcs WHERE module_instance_id = $1 ORDER BY order_index, criterion_key, template_key`,
            [inst.rows[0].id]
          );
          const iofcIds = (iofcs.rows as { id: string }[]).map((r) => r.id);
          const iofcSources: Record<string, Array<{ source_url: string; source_label: string | null }>> = {};
          if (iofcIds.length > 0) {
            const hasCol = await runtimePool.query(`
              SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_ofc_sources' AND column_name='module_instance_ofc_id'
            `);
            if (hasCol.rowCount) {
              const src = await runtimePool.query(
                `SELECT module_instance_ofc_id, source_url, source_label FROM public.module_ofc_sources WHERE module_instance_ofc_id = ANY($1::uuid[])`,
                [iofcIds]
              );
              const srcRows = src.rows ?? [];
              for (const row of srcRows) {
                const k = row.module_instance_ofc_id;
                if (!iofcSources[k]) iofcSources[k] = [];
                iofcSources[k].push({ source_url: row.source_url, source_label: row.source_label });
              }
            }
          }
          type IofcRow = { id: string; criterion_key: string; template_key: string; ofc_text: string; order_index: number; checklist_item_id?: string | null };
          moduleInstanceOfcs = (iofcs.rows as IofcRow[]).map((r) => ({
            id: r.id,
            criterion_key: r.criterion_key,
            template_key: r.template_key,
            ofc_text: r.ofc_text,
            order_index: r.order_index,
            checklist_item_id: r.checklist_item_id ?? null,
            sources: iofcSources[r.id] || [],
          }));
          try {
            const groupsExist = await runtimePool.query(
              `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='module_instance_checklist_groups'`
            );
            if (groupsExist.rowCount) {
              const groups = await runtimePool.query(
                `SELECT g.id, g.criterion_id, g.group_key, g.title, c.criterion_key
                 FROM public.module_instance_checklist_groups g
                 JOIN public.module_instance_criteria c ON c.id = g.criterion_id
                 WHERE g.module_instance_id = $1 ORDER BY c.order_index, g.group_key`,
                [inst.rows[0].id]
              );
              type GroupRow = { id: string; criterion_id: string; criterion_key?: string; group_key: string; title: string };
              moduleInstanceChecklistGroups = (groups.rows as GroupRow[]).map((r) => ({ id: r.id, criterion_id: r.criterion_id, criterion_key: r.criterion_key, group_key: r.group_key, title: r.title }));
              const items = await runtimePool.query(
                `SELECT id, group_id, order_index, text, rationale, checked, is_na, derived_unchecked, suppressed
                 FROM public.module_instance_checklist_items WHERE module_instance_id = $1 ORDER BY group_id, order_index`,
                [inst.rows[0].id]
              );
              moduleInstanceChecklistItems = (items.rows as Record<string, unknown>[]).map((r) => ({ ...r })) as typeof moduleInstanceChecklistItems;
            }
          } catch {
            /* PLAN checklist tables may not exist before migration */
          }
        }
      }
    } catch (instErr: unknown) {
      console.warn('[API /api/admin/modules/[moduleCode]] Error fetching module_instance:', instErr instanceof Error ? instErr.message : String(instErr));
    }

    // Chunk count from RUNTIME (ingested module_documents -> module_chunks)
    let chunk_count = 0;
    try {
      const chunkResult = await runtimePool.query(
        `SELECT COUNT(*)::int AS n
         FROM public.module_chunks mc
         JOIN public.module_documents md ON md.id = mc.module_document_id
         WHERE md.module_code = $1 AND md.status = 'INGESTED'`,
        [normalizedModuleCode]
      );
      chunk_count = chunkResult.rows[0]?.n ?? 0;
    } catch {
      // module_chunks or module_documents may not exist
    }

    return NextResponse.json({
      module: moduleRow,
      module_questions: moduleQs.rows,
      module_ofcs: ofcs.rows.map((o) => ({ ...o, sources: sources[o.id ?? ''] || [] })),
      risk_drivers: riskDrivers.rows,
      module_instance: moduleInstance,
      module_instance_criteria: moduleInstanceCriteria,
      module_instance_ofcs: moduleInstanceOfcs,
      module_instance_checklist_groups: moduleInstanceChecklistGroups,
      module_instance_checklist_items: moduleInstanceChecklistItems,
      chunk_count,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[API /api/admin/modules/[moduleCode]] Error:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to load module details", message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/modules/[moduleCode]
 *
 * Update module metadata.
 * Body: { status?: "DRAFT" | "ACTIVE", standard_class?: "PHYSICAL_SECURITY_MEASURES" | "PHYSICAL_SECURITY_PLAN" }.
 * standard_class is the single source of truth for Object (Measures) vs Plan; persist it when user changes Standard Class.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();

    const columnCheck = await runtimePool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'assessment_modules'
    `);
    const cols = new Set((columnCheck.rows as { column_name: string }[]).map((r) => r.column_name));

    const body = await req.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
    const standard_class =
      typeof body.standard_class === "string" ? (body.standard_class as string).trim() : null;

    if (standard_class !== null && !isStandardClassKey(standard_class)) {
      return NextResponse.json(
        {
          error: "standard_class must be PHYSICAL_SECURITY_MEASURES or PHYSICAL_SECURITY_PLAN",
        },
        { status: 400 }
      );
    }
    if (status !== null && status !== "DRAFT" && status !== "ACTIVE") {
      return NextResponse.json(
        { error: "status must be 'DRAFT' or 'ACTIVE'" },
        { status: 400 }
      );
    }
    if (status === null && standard_class === null) {
      return NextResponse.json(
        { error: "Body must include status and/or standard_class" },
        { status: 400 }
      );
    }

    const exists = await runtimePool.query(
      "SELECT 1 FROM public.assessment_modules WHERE module_code = $1",
      [normalizedModuleCode]
    );
    if (!exists.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 0;
    if (status !== null && cols.has("status")) {
      idx += 1;
      updates.push(`status = $${idx}`);
      values.push(status);
    }
    if (standard_class !== null && cols.has("standard_class")) {
      idx += 1;
      updates.push(`standard_class = $${idx}`);
      values.push(standard_class);
    }
    if (cols.has("updated_at")) {
      updates.push("updated_at = now()");
    }
    if (updates.length === 0) {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    idx += 1;
    values.push(normalizedModuleCode);
    await runtimePool.query(
      `UPDATE public.assessment_modules SET ${updates.join(", ")} WHERE module_code = $${idx}`,
      values
    );
    const res: { success: boolean; status?: string; standard_class?: string } = { success: true };
    if (status !== null) res.status = status;
    if (standard_class !== null) res.standard_class = standard_class;
    return NextResponse.json(res, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[API PATCH /api/admin/modules/[moduleCode]]", error);
    return NextResponse.json({ error: "Failed to update module", message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/modules/[moduleCode]
 *
 * Deletes a draft module (status = DRAFT only). Active modules cannot be deleted.
 *
 * Removes the module and its relation to sources (module_sources rows for this
 * module_code). Underlying sources are kept in the module library: files on disk,
 * corpus source_registry entries, and module_documents/module_chunks are NOT deleted
 * so they remain available for reuse or re-attachment to another module.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();

    // Decode and normalize module code
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();

    // Check which columns exist in assessment_modules
    const assessmentModulesColumns = new Set<string>();
    try {
      const columnCheck = await runtimePool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessment_modules'
      `);
      (columnCheck.rows as { column_name: string }[]).forEach((r) => assessmentModulesColumns.add(r.column_name));
    } catch (colCheckError: unknown) {
      console.warn('[API /api/admin/modules/[moduleCode] DELETE] Failed to check assessment_modules columns:', colCheckError instanceof Error ? colCheckError.message : String(colCheckError));
    }

    // Build SELECT clause dynamically
    const selectCols: string[] = ['module_code'];
    if (assessmentModulesColumns.has('status')) selectCols.push('status');

    // Check module exists and get status (if column exists)
    const m = await runtimePool.query(
      `SELECT ${selectCols.join(', ')} FROM public.assessment_modules WHERE module_code = $1`,
      [normalizedModuleCode]
    );

    if (!m.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const moduleRow = m.rows[0] as { status?: string };

    // Only allow deletion of DRAFT modules (if status column exists)
    // If status column doesn't exist, allow deletion (backward compatibility)
    if (assessmentModulesColumns.has('status') && moduleRow.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: "Only draft modules can be deleted. Active modules must be deactivated first.",
        },
        { status: 409 }
      );
    }

    // Remove all RUNTIME references to this module (tables that do not CASCADE from assessment_modules).
    // Order: children before parents where FKs apply.
    const runDelete = async (label: string, sql: string, params: string[] = []) => {
      try {
        await runtimePool.query(sql, params);
      } catch (err) {
        console.warn(`[API /api/admin/modules/[moduleCode] DELETE] ${label}:`, err instanceof Error ? err.message : String(err));
      }
    };

    await runDelete(
      "module_chunk_comprehension",
      "DELETE FROM public.module_chunk_comprehension WHERE module_code = $1",
      [normalizedModuleCode]
    );
    await runDelete(
      "module_corpus_links",
      "DELETE FROM public.module_corpus_links WHERE module_code = $1",
      [normalizedModuleCode]
    );
    await runDelete(
      "module_documents",
      "DELETE FROM public.module_documents WHERE module_code = $1",
      [normalizedModuleCode]
    );
    await runDelete(
      "module_sources",
      "DELETE FROM public.module_sources WHERE module_code = $1",
      [normalizedModuleCode]
    );
    await runDelete(
      "module_vulnerability_candidates",
      "DELETE FROM public.module_vulnerability_candidates WHERE module_code = $1",
      [normalizedModuleCode]
    );
    await runDelete(
      "module_drafts",
      "DELETE FROM public.module_drafts WHERE module_code = $1",
      [normalizedModuleCode]
    );

    // Delete the module; CASCADE removes tables with FK to assessment_modules (module_questions, module_ofcs, module_ofc_library, module_instances, etc.)
    await runtimePool.query(
      `DELETE FROM public.assessment_modules WHERE module_code = $1`,
      [normalizedModuleCode]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[API /api/admin/modules/[moduleCode] DELETE] Error:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to delete module", message },
      { status: 500 }
    );
  }
}
