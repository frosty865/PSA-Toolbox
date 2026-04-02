/**
 * GET /api/admin/modules/[moduleCode]/sources/pending
 *
 * Lists sources that are unassigned (MODULE_UNASSIGNED or legacy MODULE_PENDING).
 * User can then assign them to this module via POST .../sources/assign-from-pending.
 */

import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/** Unassigned library documents (ingested, not yet assigned to a module). */
const UNASSIGNED_MODULE_CODES = ["MODULE_UNASSIGNED", "MODULE_PENDING"];

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const targetModuleCode = decodeURIComponent(moduleCode).trim();
    const pool = getRuntimePool();

    const mod = await pool.query(
      `SELECT 1 FROM public.assessment_modules WHERE module_code = $1`,
      [targetModuleCode]
    );
    if (mod.rows.length === 0) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const sourcesRows = await pool.query(
      `SELECT
          id,
          source_type,
          source_label,
          sha256,
          storage_relpath,
          created_at
       FROM public.module_sources
       WHERE module_code = ANY($1::text[])
       ORDER BY created_at DESC`,
      [UNASSIGNED_MODULE_CODES]
    );

    const docRows = await pool.query(
      `SELECT id, label, sha256, status, created_at
       FROM public.module_documents
       WHERE module_code = ANY($1::text[])
       ORDER BY id`,
      [UNASSIGNED_MODULE_CODES]
    );

    // One row per unique file (by sha256). Prefer module_sources.id for assign-from-pending.
    const bySha = new Map<
      string,
      { id: string; label: string; status: string; created_at: unknown }
    >();
    for (const r of sourcesRows.rows as Array<Record<string, unknown>>) {
      const sha = r.sha256 != null ? String(r.sha256) : null;
      if (!sha) continue;
      bySha.set(sha, {
        id: String(r.id),
        label: String(r.source_label ?? "Document"),
        status: "INGESTED",
        created_at: r.created_at,
      });
    }
    for (const r of docRows.rows as Array<Record<string, unknown>>) {
      const sha = r.sha256 != null ? String(r.sha256) : null;
      if (!sha) continue;
      if (!bySha.has(sha)) {
        bySha.set(sha, {
          id: String(r.id),
          label: String(r.label ?? "Ingested document"),
          status: String(r.status ?? "INGESTED"),
          created_at: r.created_at,
        });
      }
    }

    const items = Array.from(bySha.entries()).map(([sha, v]) => ({
      id: v.id,
      label: v.label,
      sha256: sha,
      status: v.status,
      created_at: v.created_at,
    }));
    items.sort((a, b) => {
      const ta = a.created_at != null ? new Date(a.created_at as string).getTime() : 0;
      const tb = b.created_at != null ? new Date(b.created_at as string).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ pending: items, count: items.length });
  } catch (e: unknown) {
    console.error("[API GET sources/pending]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list unassigned sources" },
      { status: 500 }
    );
  }
}
