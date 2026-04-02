import { NextResponse } from "next/server";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/subtype-coverage
 *
 * Subtype Coverage & Gap Audit: baseline questions from baseline_spines_runtime vs
 * discipline_subtype_id, overview, and reference implementation.
 * - discipline_subtypes.overview: has_overview
 * - discipline_subtype_reference_impl: has_reference_implementation (fallback: false if table missing)
 * - help_enabled = discipline_subtype_id != null
 * - help_empty = help_enabled && !has_overview && !has_reference_implementation
 */
export async function GET() {
  try {
    const pool = await ensureRuntimePoolConnected();

    const fullQuery = `
      WITH ref_impl AS (
        SELECT discipline_subtype_id
        FROM public.discipline_subtype_reference_impl
      ),
      q AS (
        SELECT
          b.canon_id,
          b.question_text,
          b.discipline_subtype_id,
          b.discipline_code,
          ds.name AS discipline_subtype_name,
          ds.overview AS subtype_overview,
          COALESCE(d_sub.id, d_code.id) AS discipline_id,
          COALESCE(d_sub.name, d_code.name) AS discipline_name,
          (ds.overview IS NOT NULL AND TRIM(ds.overview) <> '') AS has_overview,
          (ri.discipline_subtype_id IS NOT NULL) AS has_reference_implementation
        FROM public.baseline_spines_runtime b
        LEFT JOIN public.discipline_subtypes ds ON b.discipline_subtype_id = ds.id
        LEFT JOIN public.disciplines d_sub ON ds.discipline_id = d_sub.id
        LEFT JOIN public.disciplines d_code ON b.discipline_subtype_id IS NULL AND d_code.code = b.discipline_code
        LEFT JOIN ref_impl ri ON ri.discipline_subtype_id = b.discipline_subtype_id
        WHERE b.active = true
      )
      SELECT
        canon_id,
        question_text,
        discipline_id::text AS discipline_id,
        discipline_name,
        discipline_subtype_id::text AS discipline_subtype_id,
        discipline_subtype_name,
        COALESCE(has_overview, false) AS has_overview,
        COALESCE(has_reference_implementation, false) AS has_reference_implementation,
        (discipline_subtype_id IS NOT NULL) AS help_enabled,
        (
          discipline_subtype_id IS NOT NULL
          AND NOT COALESCE(has_overview, false)
          AND NOT COALESCE(has_reference_implementation, false)
        ) AS help_empty
      FROM q
      ORDER BY discipline_code ASC, canon_id ASC
    `;

    const fallbackQuery = `
      WITH q AS (
        SELECT
          b.canon_id,
          b.question_text,
          b.discipline_subtype_id,
          b.discipline_code,
          ds.name AS discipline_subtype_name,
          ds.overview AS subtype_overview,
          COALESCE(d_sub.id, d_code.id) AS discipline_id,
          COALESCE(d_sub.name, d_code.name) AS discipline_name,
          (ds.overview IS NOT NULL AND TRIM(COALESCE(ds.overview, '')) <> '') AS has_overview,
          false AS has_reference_implementation
        FROM public.baseline_spines_runtime b
        LEFT JOIN public.discipline_subtypes ds ON b.discipline_subtype_id = ds.id
        LEFT JOIN public.disciplines d_sub ON ds.discipline_id = d_sub.id
        LEFT JOIN public.disciplines d_code ON b.discipline_subtype_id IS NULL AND d_code.code = b.discipline_code
        WHERE b.active = true
      )
      SELECT
        canon_id,
        question_text,
        discipline_id::text AS discipline_id,
        discipline_name,
        discipline_subtype_id::text AS discipline_subtype_id,
        discipline_subtype_name,
        COALESCE(has_overview, false) AS has_overview,
        COALESCE(has_reference_implementation, false) AS has_reference_implementation,
        (discipline_subtype_id IS NOT NULL) AS help_enabled,
        (
          discipline_subtype_id IS NOT NULL
          AND NOT COALESCE(has_overview, false)
          AND NOT COALESCE(has_reference_implementation, false)
        ) AS help_empty
      FROM q
      ORDER BY discipline_code ASC, canon_id ASC
    `;

    let rows: unknown[];
    try {
      const r = await pool.query(fullQuery);
      rows = r.rows || [];
    } catch (qerr: unknown) {
      const msg = qerr instanceof Error ? qerr.message : String(qerr ?? "");
      const code = (qerr && typeof qerr === "object" && "code" in qerr) ? String((qerr as { code?: string }).code) : "";
      const isRefImplMissing =
        code === "42P01" ||
        /relation ".*discipline_subtype_reference_impl.*" does not exist/i.test(msg) ||
        /discipline_subtype_reference_impl.*does not exist/i.test(msg) ||
        (msg.includes("discipline_subtype_reference_impl") && msg.includes("does not exist"));
      if (isRefImplMissing) {
        console.warn(
          "[API /api/admin/reports/subtype-coverage] discipline_subtype_reference_impl missing, using fallback (has_reference_implementation=false). Run: node scripts/run_runtime_migration.js db/migrations/20260124_add_discipline_subtype_reference_impl.sql"
        );
        try {
          const r = await pool.query(fallbackQuery);
          rows = r.rows || [];
        } catch (fallbackErr: unknown) {
          console.error("[API /api/admin/reports/subtype-coverage] fallback query failed", fallbackErr);
          throw fallbackErr;
        }
      } else {
        throw qerr;
      }
    }

    const list = (rows || []) as Array<{
      canon_id: string;
      question_text: string;
      discipline_id: string | null;
      discipline_name: string | null;
      discipline_subtype_id: string | null;
      discipline_subtype_name: string | null;
      has_overview: boolean;
      has_reference_implementation: boolean;
      help_enabled: boolean;
      help_empty: boolean;
    }>;

    const questions_total = list.length;
    const with_subtype = list.filter((r) => r.discipline_subtype_id != null).length;
    const without_subtype = questions_total - with_subtype;
    const with_overview = list.filter((r) => r.has_overview).length;
    const without_overview = list.filter((r) => r.help_enabled && !r.has_overview).length;
    const with_reference_implementation = list.filter((r) => r.has_reference_implementation).length;
    const without_reference_implementation = list.filter(
      (r) => r.help_enabled && !r.has_reference_implementation
    ).length;
    const help_enabled_but_empty = list.filter((r) => r.help_empty).length;

    const missing_subtype = list.filter((r) => r.discipline_subtype_id == null).map((r) => r.canon_id);
    const subtype_no_overview = [
      ...new Set(
        list.filter((r) => r.help_enabled && !r.has_overview).map((r) => r.discipline_subtype_id!).filter(Boolean)
      ),
    ];
    const subtype_no_reference_implementation = [
      ...new Set(
        list
          .filter((r) => r.help_enabled && !r.has_reference_implementation)
          .map((r) => r.discipline_subtype_id!)
          .filter(Boolean)
      ),
    ];
    const help_empty_questions = list.filter((r) => r.help_empty).map((r) => r.canon_id);

    const report = {
      generated_at: new Date().toISOString(),
      totals: {
        questions_total,
        with_subtype,
        without_subtype,
        with_overview,
        without_overview,
        with_reference_implementation,
        without_reference_implementation,
        help_enabled_but_empty: help_enabled_but_empty,
      },
      rows: list.map((r) => ({
        canon_id: r.canon_id,
        question_text: r.question_text,
        discipline_id: r.discipline_id ?? null,
        discipline_name: r.discipline_name ?? undefined,
        discipline_subtype_id: r.discipline_subtype_id,
        discipline_subtype_name: r.discipline_subtype_name ?? undefined,
        has_overview: r.has_overview,
        has_reference_implementation: r.has_reference_implementation,
        help_enabled: r.help_enabled,
        help_empty: r.help_empty,
      })),
      gaps: {
        missing_subtype,
        subtype_no_overview,
        subtype_no_reference_implementation,
        help_empty_questions,
      },
    };

    return NextResponse.json(report, { status: 200 });
  } catch (e: unknown) {
    console.error("[API /api/admin/reports/subtype-coverage GET]", e);
    const err = e && typeof e === "object" ? e as { message?: string; code?: string; detail?: unknown } : {};
    const msg = err.message ?? "";
    const code = err.code ?? "";
    const details = err.detail != null ? String(err.detail) : undefined;
    // 42P01 = undefined_table; treat missing baseline/subtype tables as deps not ready
    const isMissingTable =
      code === "42P01" &&
      (msg.includes("baseline_spines_runtime") ||
        msg.includes("discipline_subtypes") ||
        msg.includes("disciplines"));
    // Connection, pool, or env errors -> 503
    const isConnectionOrPool =
      ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"].includes(code) ||
      /RUNTIME_DATABASE_URL|connect|timeout|pool|Connection|Connection test|Failed to connect/i.test(msg);
    const body: Record<string, unknown> = {
      error: "Failed to generate subtype coverage report",
      message: msg,
    };
    if (code) body.db_code = code;
    if (details) body.details = details;
    if (isMissingTable) {
      body.code = "REPORT_DEPS_MISSING";
      body.hint =
        "Ensure RUNTIME has baseline_spines_runtime, discipline_subtypes, and disciplines. Run the required migrations for the RUNTIME database.";
      return NextResponse.json(body, { status: 503 });
    }
    if (isConnectionOrPool) {
      body.code = "CONNECTION_UNAVAILABLE";
      body.hint =
        "RUNTIME_DATABASE_URL must be set and the database must be reachable. Check env and network; see tools/RUNTIME_DB_RUNBOOK.md if needed.";
      return NextResponse.json(body, { status: 503 });
    }
    return NextResponse.json(body, { status: 500 });
  }
}

