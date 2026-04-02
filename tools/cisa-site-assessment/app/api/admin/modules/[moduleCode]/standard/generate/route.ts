import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { generateModuleContentFromChunks } from "@/app/lib/modules/generation/generate_module_content_from_chunks";
import { buildPreflightReport } from "@/app/lib/modules/generation/preflight";
import type { PreflightReport } from "@/app/lib/modules/generation/preflight";
import { normalizeCriteria, validateCriteriaShape } from "@/app/lib/normalization/criteria_normalize";
import { validateCriteriaArePlanElements } from "@/app/lib/normalization/criteria_validate";
import { validateOfcsHardRules as _validateOfcsHardRules } from "@/app/lib/ofc/ofc_validate";
import { normalizeCriteriaList } from "@/app/lib/criteria/normalize_criteria";
import { validateStandardCriteriaOrThrow } from "@/app/lib/modules/standard/validators/standard_output_validator";
import { STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL } from "@/app/lib/modules/generation/generate_module_content_from_chunks";
import { getOllamaUrl } from "@/app/lib/config/ollama";
import { getPlanStandardModel, resolveStandardsModel, getComprehensionModel } from "@/app/lib/ollama/model_router";
import { runPlanStructurePipeline } from "@/app/lib/plans/plan_structure_pipeline";
import { runPlanGeneratorV1 } from "@/app/lib/modules/generation/planGeneratorV1";
import { buildPlanOutputFromDerivedSchema } from "@/app/lib/modules/plan_ecosystem/build_plan_output_from_schema";
import { lintMeasuresOfcsOnly, RULE_DESCRIPTIONS } from "@/app/lib/modules/generation/normalizedLint";
import { kindFromStandardClass, isStandardClassKey, isPlanMode } from "@/app/lib/modules/standard_class";
import { normalizeLocatorFromJson } from "@/app/lib/citations/normalize_locator";
import { buildTraceFromChunkResult, type GenerationDebugTrace } from "@/app/lib/modules/generation/debug_trace";
import { ensureModuleComprehension } from "@/app/lib/modules/comprehension/run_module_comprehension";

type Body = { standard_key: string; dryRun?: boolean; plan_type?: string };

const OLLAMA_PREFLIGHT_TIMEOUT_MS = 5000;

/** Returns true if Ollama is reachable; false or throws on network error. */
async function checkOllamaReachable(): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = getOllamaUrl().replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(OLLAMA_PREFLIGHT_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, message: `${res.status} ${await res.text().catch(() => "")}` };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && (e as Error & { cause?: { code?: string } }).cause;
    const code = cause && typeof (cause as { code?: string }).code === "string" ? (cause as { code: string }).code : "";
    return {
      ok: false,
      message: msg + (code ? ` (${code})` : ""),
    };
  }
}

function _basename(p: string | null | undefined): string {
  if (p == null || p === "") return "";
  const s = p.replace(/\\/g, "/").trim();
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

/** Remove internal service names from messages shown on the web UI. */
function sanitizeMessageForUser(msg: string): string {
  return msg.replace(/ollama/gi, "generator");
}

const PROGRESS_STEPS = 4;
function progressBar(step: number, label: string): string {
  const filled = Math.round((step / PROGRESS_STEPS) * 10) || 0;
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  return `[${bar}] ${step}/${PROGRESS_STEPS} ${label}`;
}

function logProgress(step: number, label: string, detail?: string): void {
  const msg = detail
    ? `[standard/generate] ${progressBar(step, label)} ${detail}`
    : `[standard/generate] ${progressBar(step, label)}`;
  console.log(msg);
}

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");
const PARSER_OUTPUT_DIR = path.join(process.cwd(), "tools", "outputs");
const MIN_CHUNK_LENGTH = 200;
const MAX_CHUNKS_EXPORT = 500;
/** When comprehension-driven selection is used: max chunks sent to generation. */
const MAX_CHUNKS_FOR_GENERATION = 120;
/** Min priority for comprehension-driven selection (2 = MEDIUM). generation_priority is text; compared as HIGH=3, MEDIUM=2, LOW=1. */
const MIN_PRIORITY_FOR_GENERATION = 2;
/** Diversity: max chunks per doc_id when using comprehension-driven selection. */
const MAX_CHUNKS_PER_DOC_DIVERSITY = 30;
const MAX_QUESTIONS = 12;
const MAX_OFCS_PER_QUESTION = 4;
/** Advisory: total OFCs; generation allows 0–4 per question; export may require 1–4 or NO_OFC_NEEDED per question. */
const MIN_OFCS_FOR_QUESTION_SET = 8;

export interface ExportChunksResult {
  exported: number;
  missingSourceRegistryLink: number;
  /** Set when comprehension-driven selection was used. */
  comprehension_rows_total?: number;
  comprehension_rows_eligible?: number;
  chunks_selected_for_generation?: number;
}

/**
 * Export ingested chunks from RUNTIME to data/module_chunks/<module_code>.json
 * (same format as the legacy chunk export for the module parser path).
 * Only exports chunks whose document has a CORPUS source_registry link (module_doc_source_link).
 * Returns { exported, missingSourceRegistryLink }.
 */
async function exportChunksFromRuntime(
  runtimePool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  moduleCode: string,
  corpusPool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> } | null
): Promise<ExportChunksResult> {
  const chunkRows = await runtimePool.query(
    `SELECT DISTINCT ON (mc.id)
        mc.id AS chunk_id,
        mc.module_document_id AS doc_id,
        mc.chunk_index,
        mc.text,
        mc.locator,
        md.sha256,
        COALESCE(md.label, 'Document') AS doc_label,
        link.source_registry_id AS corpus_source_registry_id,
        ms.id::text AS module_source_id
     FROM public.module_chunks mc
     JOIN public.module_documents md ON md.id = mc.module_document_id
     LEFT JOIN public.module_doc_source_link link
       ON link.module_code ILIKE md.module_code AND link.doc_sha256 = md.sha256
     LEFT JOIN public.module_sources ms ON ms.module_code ILIKE md.module_code AND ms.sha256 = md.sha256
     WHERE md.module_code ILIKE $1 AND md.status = 'INGESTED'
       AND length(mc.text) >= $2
     ORDER BY mc.id, md.id, mc.chunk_index
     LIMIT $3`,
    [moduleCode, MIN_CHUNK_LENGTH, MAX_CHUNKS_EXPORT]
  );
  const rows = (chunkRows.rows as {
    chunk_id: string;
    doc_id: string;
    chunk_index: number;
    text: string;
    locator: unknown;
    doc_label: string;
    corpus_source_registry_id: string | null;
    module_source_id: string | null;
  }[]);

  let missingSourceRegistryLink = 0;
  const eligibleRows = rows.filter((r) => (r.text || "").trim().length >= MIN_CHUNK_LENGTH);
  for (const r of eligibleRows) {
    if (!r.corpus_source_registry_id) missingSourceRegistryLink++;
  }

  // Use all eligible chunks; when CORPUS link is missing, use module document label (so generation can proceed without backfill)
  const linkedRows = eligibleRows;
  if (linkedRows.length === 0) {
    return { exported: 0, missingSourceRegistryLink };
  }

  const sourceRegistryIds = [...new Set(linkedRows.map((r) => r.corpus_source_registry_id).filter(Boolean))] as string[];
  const labels: Record<string, string> = {};
  const sourceIndex: Record<string, string> = {};
  if (corpusPool && sourceRegistryIds.length > 0) {
    const titleRows = await corpusPool.query(
      `SELECT id::text AS id, COALESCE(title, '') AS title FROM public.source_registry WHERE id::text = ANY($1::text[])`,
      [sourceRegistryIds]
    );
    for (const row of titleRows.rows as { id: string; title: string }[]) {
      const label = (row.title || "Document").trim().slice(0, 500);
      labels[row.id] = label;
      sourceIndex[row.id] = label;
    }
  }
  for (const id of sourceRegistryIds) {
    if (!labels[id]) {
      labels[id] = "Document";
      sourceIndex[id] = "Document";
    }
  }

  const chunksOut: {
    source_registry_id: string;
    doc_id: string;
    chunk_id: string;
    source_label: string;
    locator_type: string;
    locator_value: string;
    page_range: string;
    text: string;
    module_source_id?: string | null;
  }[] = [];
  for (const r of linkedRows) {
    const sourceRegistryId = r.corpus_source_registry_id ?? `module-doc:${r.doc_id}`;
    const sourceLabel = r.corpus_source_registry_id
      ? (labels[r.corpus_source_registry_id] ?? "Document")
      : (r.doc_label || "Document").trim().slice(0, 500);
    if (!sourceIndex[sourceRegistryId]) sourceIndex[sourceRegistryId] = sourceLabel;
    const locatorJson = r.locator && typeof r.locator === "object" ? (r.locator as { type?: string; page?: number; page_start?: number; page_end?: number }) : null;
    const normalized = normalizeLocatorFromJson({ locatorJson, fallbackRaw: r.chunk_index ?? 1 });
    const locator_type = normalized?.locator_type ?? "page";
    const locator_value = normalized?.locator ?? "";
    const page_range = locator_value;
    chunksOut.push({
      source_registry_id: sourceRegistryId,
      doc_id: r.doc_id,
      chunk_id: String(r.chunk_id),
      source_label: sourceLabel,
      locator_type,
      locator_value,
      page_range,
      text: (r.text || "").trim(),
      ...(r.module_source_id != null ? { module_source_id: r.module_source_id } : {}),
    });
  }

  const payload = { module_code: moduleCode, source_index: sourceIndex, chunks: chunksOut };
  const outDir = CHUNKS_DIR;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${moduleCode}.json`), JSON.stringify(payload, null, 2), "utf-8");

  if (missingSourceRegistryLink > 0) {
    console.warn(
      `[standard/generate] ${missingSourceRegistryLink} chunk(s) have no CORPUS source_registry link (using module document labels). For citations in CORPUS, run: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts ${moduleCode}`
    );
  }
  return { exported: chunksOut.length, missingSourceRegistryLink };
}

/**
 * Export chunks for generation using comprehension-driven selection when REQUIRE_MODULE_COMPREHENSION=1.
 * Selects chunks from module_chunk_comprehension where supports_question_generation=true and priority>=MEDIUM,
 * ordered by priority, life_safety, ops, confidence; diversity cap per doc_id (max 30). Writes same JSON format.
 * If 0 rows and requireComprehension, throws with actionable error.
 */
async function exportChunksFromRuntimeComprehensionDriven(
  runtimePool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  moduleCode: string,
  corpusPool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> } | null,
  requireComprehension: boolean
): Promise<ExportChunksResult> {
  const countRows = await runtimePool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE supports_question_generation = TRUE AND generation_priority IN ('MEDIUM', 'HIGH'))::int AS eligible
     FROM public.module_chunk_comprehension
     WHERE module_code ILIKE $1`,
    [moduleCode]
  );
  const total = (countRows.rows[0] as { total: number } | undefined)?.total ?? 0;
  const eligible = (countRows.rows[0] as { eligible: number } | undefined)?.eligible ?? 0;

  const selectionRows = await runtimePool.query(
    `WITH ranked AS (
       SELECT
         mcc.chunk_id,
         mcc.doc_id,
         mcc.source_registry_id,
         mcc.locator,
         mcc.generation_priority,
         mcc.life_safety_signal,
         mcc.ops_signal,
         mcc.llm_confidence,
         mcc.updated_at
       FROM public.module_chunk_comprehension mcc
       WHERE mcc.module_code ILIKE $1
         AND mcc.supports_question_generation = TRUE
         AND CASE mcc.generation_priority WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END >= $2
     ),
     with_rn AS (
       SELECT ranked.*,
         ROW_NUMBER() OVER (
           PARTITION BY doc_id
           ORDER BY
             CASE generation_priority WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
             life_safety_signal DESC,
             ops_signal DESC,
             llm_confidence DESC NULLS LAST,
             updated_at DESC NULLS LAST,
             chunk_id ASC
         ) AS rn_doc
       FROM ranked
     ),
     picked AS (
       SELECT chunk_id, doc_id, source_registry_id, locator
       FROM with_rn
       WHERE rn_doc <= $4
       ORDER BY
         CASE generation_priority WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
         life_safety_signal DESC,
         ops_signal DESC,
         llm_confidence DESC NULLS LAST,
         updated_at DESC NULLS LAST,
         chunk_id ASC
       LIMIT $3
     )
     SELECT
       p.chunk_id AS chunk_id,
       p.doc_id AS doc_id,
       mc.text AS content,
       p.source_registry_id::text AS source_registry_id,
       COALESCE(
         NULLIF(TRIM(p.locator), ''),
         CASE
           WHEN mc.locator IS NOT NULL AND jsonb_typeof(mc.locator) = 'object' THEN
             CASE
               WHEN mc.locator->>'page_start' IS NOT NULL AND mc.locator->>'page_end' IS NOT NULL
                 THEN 'p.' || (mc.locator->>'page_start') || '-' || (mc.locator->>'page_end')
               WHEN mc.locator->>'page' IS NOT NULL THEN 'p.' || (mc.locator->>'page')
               ELSE ''
             END
           ELSE ''
         END,
         ''
       ) AS locator
     FROM picked p
     JOIN public.module_chunks mc ON mc.id = p.chunk_id`,
    [moduleCode, MIN_PRIORITY_FOR_GENERATION, MAX_CHUNKS_FOR_GENERATION, MAX_CHUNKS_PER_DOC_DIVERSITY]
  );

  const rows = (selectionRows.rows as {
    chunk_id: string;
    doc_id: string;
    content: string;
    source_registry_id: string;
    locator: string;
  }[]).filter((r) => (r.content || "").trim().length >= MIN_CHUNK_LENGTH);

  if (rows.length === 0 && requireComprehension) {
    throw new Error(
      "Comprehension present but no chunks qualify (supports_question_generation=true and priority>=2). Rebuild comprehension or lower minPriority."
    );
  }
  if (rows.length === 0) {
    return {
      exported: 0,
      missingSourceRegistryLink: 0,
      comprehension_rows_total: total,
      comprehension_rows_eligible: eligible,
      chunks_selected_for_generation: 0,
    };
  }

  const sourceRegistryIds = [...new Set(rows.map((r) => r.source_registry_id).filter((id) => id && id !== "00000000-0000-0000-0000-000000000000"))] as string[];
  const docIds = [...new Set(rows.map((r) => r.doc_id))];
  const labels: Record<string, string> = {};
  const sourceIndex: Record<string, string> = {};
  if (corpusPool && sourceRegistryIds.length > 0) {
    const titleRows = await corpusPool.query(
      `SELECT id::text AS id, COALESCE(title, '') AS title FROM public.source_registry WHERE id::text = ANY($1::text[])`,
      [sourceRegistryIds]
    );
    for (const row of titleRows.rows as { id: string; title: string }[]) {
      const label = (row.title || "Document").trim().slice(0, 500);
      labels[row.id] = label;
      sourceIndex[row.id] = label;
    }
  }
  const docRows = await runtimePool.query(
    `SELECT id::text AS id, COALESCE(label, 'Document') AS label, sha256 FROM public.module_documents WHERE id::text = ANY($1::text[])`,
    [docIds]
  );
  const docLabelByDocId: Record<string, string> = {};
  const docSha256ByDocId: Record<string, string> = {};
  for (const row of docRows.rows as { id: string; label: string; sha256: string | null }[]) {
    docLabelByDocId[row.id] = (row.label || "Document").trim().slice(0, 500);
    if (row.sha256) docSha256ByDocId[row.id] = row.sha256;
  }
  const moduleSourceIdBySha256: Record<string, string> = {};
  if (docIds.length > 0) {
    const sha256List = Object.values(docSha256ByDocId);
    if (sha256List.length > 0) {
      const msRows = await runtimePool.query(
        `SELECT sha256, id::text AS id FROM public.module_sources WHERE module_code ILIKE $1 AND sha256 = ANY($2::text[])`,
        [moduleCode, sha256List]
      );
      for (const row of msRows.rows as { sha256: string; id: string }[]) {
        moduleSourceIdBySha256[row.sha256] = row.id;
      }
    }
  }
  for (const id of sourceRegistryIds) {
    if (!labels[id]) {
      labels[id] = "Document";
      sourceIndex[id] = "Document";
    }
  }

  const chunksOut: {
    source_registry_id: string;
    doc_id: string;
    chunk_id: string;
    source_label: string;
    locator_type: string;
    locator_value: string;
    page_range: string;
    text: string;
    module_source_id?: string | null;
  }[] = [];
  let missingSourceRegistryLink = 0;
  for (const r of rows) {
    const sourceRegistryId = r.source_registry_id && r.source_registry_id !== "00000000-0000-0000-0000-000000000000"
      ? r.source_registry_id
      : `module-doc:${r.doc_id}`;
    if (!r.source_registry_id || r.source_registry_id === "00000000-0000-0000-0000-000000000000") missingSourceRegistryLink++;
    const sourceLabel = labels[r.source_registry_id] ?? docLabelByDocId[r.doc_id] ?? "Document";
    if (!sourceIndex[sourceRegistryId]) sourceIndex[sourceRegistryId] = sourceLabel;
    const locatorValue = (r.locator || "").trim() || "";
    const normalized = /^p\.\d|^p\.\d+-\d+/.test(locatorValue)
      ? { locator_type: "page" as const, locator: locatorValue }
      : normalizeLocatorFromJson({ locatorJson: null, fallbackRaw: locatorValue || "1" });
    const locator_type = normalized?.locator_type ?? "page";
    const locator_value = (normalized?.locator != null ? normalized.locator : locatorValue) || "";
    const page_range = locator_value;
    const sha256 = docSha256ByDocId[r.doc_id];
    const module_source_id = sha256 ? moduleSourceIdBySha256[sha256] ?? null : null;
    chunksOut.push({
      source_registry_id: sourceRegistryId,
      doc_id: r.doc_id,
      chunk_id: String(r.chunk_id),
      source_label: sourceLabel,
      locator_type,
      locator_value,
      page_range,
      text: (r.content || "").trim(),
      ...(module_source_id != null ? { module_source_id } : {}),
    });
  }

  const payload = { module_code: moduleCode, source_index: sourceIndex, chunks: chunksOut };
  const outDir = CHUNKS_DIR;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${moduleCode}.json`), JSON.stringify(payload, null, 2), "utf-8");

  return {
    exported: chunksOut.length,
    missingSourceRegistryLink,
    comprehension_rows_total: total,
    comprehension_rows_eligible: eligible,
    chunks_selected_for_generation: chunksOut.length,
  };
}

async function getDefaultDisciplineSubtypeId(
  runtimePool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }
): Promise<string> {
  const r = await runtimePool.query(
    `SELECT id FROM public.discipline_subtypes WHERE is_active = true ORDER BY code LIMIT 1`
  );
  const id = (r.rows[0] as { id: string } | undefined)?.id;
  if (!id) throw new Error("No active discipline_subtype found for PLAN OFCs.");
  return id;
}

/**
 * POST /api/admin/modules/[moduleCode]/standard/generate
 *
 * Chunk-only: exports ingested chunks from RUNTIME, runs the generator over them, uses chunk-derived
 * criteria/OFCs. No fallbacks. Fails if no chunks or if the chunk pipeline fails.
 *
 * Why CORPUS vs RUNTIME:
 * - Standards registry (module_standards: standard_key, name, version, status) lives in CORPUS.
 *   Run "node scripts/run_corpus_module_standards.js" to apply migrations/seeds on CORPUS.
 * - Modules and their content (assessment_modules, module_sources, module_documents, module_chunks)
 *   live in RUNTIME. Chunks are exported from RUNTIME here; no chunk data is read from CORPUS.
 *
 * Body: { standard_key, dryRun?: boolean }
 * - dryRun true (default): return preview only
 * - dryRun false: persist module_instances + module_instance_criteria + module_instance_ofcs
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    if (!normalized) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }

    const requestUrl = req.url ? new URL(req.url) : null;
    const debugQuery = requestUrl?.searchParams?.get("debug") === "1";

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { standard_key, dryRun, plan_type: request_plan_type } = body;
    if (!standard_key || typeof standard_key !== "string") {
      return NextResponse.json({ error: "standard_key required" }, { status: 400 });
    }

    const runtimePool = getRuntimePool();
    let corpusPool;
    try {
      corpusPool = getCorpusPool();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[POST standard/generate] CORPUS pool failed:", e);
      return NextResponse.json(
        {
          error: "CORPUS database unavailable",
          message: msg,
          hint: "Standards live in CORPUS (module_standards). Set CORPUS_DATABASE_URL and ensure CORPUS is reachable.",
        },
        { status: 503 }
      );
    }

    // 1) Resolve canonical module_code (assessment_modules may store different case than URL)
    const mod = await runtimePool.query<{ module_code: string }>(
      "SELECT module_code FROM public.assessment_modules WHERE module_code ILIKE $1 LIMIT 1",
      [normalized]
    );
    if (!mod.rows.length) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    const canonicalModuleCode = (mod.rows[0].module_code ?? normalized).trim();

    // 2) Load standard (APPROVED only) from CORPUS
    const std = await corpusPool.query(
      `SELECT id, standard_key, name, version FROM public.module_standards
       WHERE standard_key = $1 AND status = 'APPROVED'`,
      [standard_key]
    );
    if (!std.rowCount) {
      return NextResponse.json(
        {
          error: "Standard not found or not APPROVED",
          standard_key,
          hint: "The selected standard is not in the CORPUS database or is not APPROVED. Run: node scripts/run_corpus_module_standards.js (requires CORPUS_DATABASE_URL in .env.local).",
        },
        { status: 404 }
      );
    }
    const standardVersion = (std.rows[0].version as string) || "v1";
    const _standardName = (std.rows[0].name as string) || "Emergency Action Plan";

    const structure: PreflightReport["structure"] =
      (standard_key as string).toUpperCase().trim() === "PHYSICAL_SECURITY_PLAN" ? "PLAN" : "MEASURES";
    const preflightReport = await buildPreflightReport(runtimePool, canonicalModuleCode, structure);
    preflightReport.standards_model_used = resolveStandardsModel(isPlanMode(standard_key) ? "plan" : "object");

    if (preflightReport.failure_reason) {
      console.warn("[standard/generate] Preflight failed:", {
        module_code: canonicalModuleCode,
        failure_reason: preflightReport.failure_reason,
        source_count: preflightReport.source_count,
        usable_source_count: preflightReport.usable_source_count,
        chunk_count: preflightReport.chunk_count,
      });
      return NextResponse.json(
        {
          error: "Preflight failed",
          failure_reason: preflightReport.failure_reason,
          preflight: preflightReport,
          message:
            preflightReport.failure_reason === "NO_SOURCES"
              ? "This module has no sources attached."
              : preflightReport.failure_reason === "NO_USABLE_SOURCES"
                ? "No sources have retrievable text (ingest PDFs or fix CORPUS pointers)."
                : "No retrievable text chunks; ingest sources on the Sources tab.",
          hint: "Add sources on the Sources tab, then retry.",
        },
        { status: 400 }
      );
    }

    logProgress(1, "Preflight OK", `sources=${preflightReport.source_count} usable=${preflightReport.usable_source_count} chunks=${preflightReport.chunk_count}`);

    // Comprehension: if required, run TS-native comprehension before any generation (idempotent UPSERT).
    let comprehensionStatus: "present" | "created" | undefined;
    let comprehensionRows: number | undefined;
    const comprehensionModel = getComprehensionModel();
    if (process.env.REQUIRE_MODULE_COMPREHENSION === "1" && corpusPool) {
      try {
        const compResult = await ensureModuleComprehension({
          moduleCode: canonicalModuleCode,
          model: comprehensionModel,
          maxChunks: 160,
          minChunkLen: 400,
          runtimeDb: runtimePool,
          corpusDb: corpusPool,
        });
        comprehensionStatus = compResult.status;
        comprehensionRows = compResult.rows;
        logProgress(1, "Comprehension", `${compResult.status} rows=${compResult.rows}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[standard/generate] ensureModuleComprehension failed:", e);
        return NextResponse.json(
          {
            error: "Comprehension step failed",
            message: msg,
            failure_reason: "REQUIRE_MODULE_COMPREHENSION",
            preflight: preflightReport,
            hint: "Ensure the module has ingested sources (Sources tab: process PDFs so RUNTIME has module_documents and module_chunks).",
          },
          { status: 503 }
        );
      }
    }

    type OfcPreviewRow = { criterion_key: string; template_key: string; ofc_text: string; ofc_reason?: string; discipline_subtype_id: string; order_index: number };
    type CritPreviewRow = { criterion_key: string; title: string; question_text: string; applicability: "APPLIES" | "N_A"; discipline_subtype_id: string | null; order_index: number };

    let criteriaPreview: CritPreviewRow[] = [];
    let ofcsPreview: OfcPreviewRow[] = [];
    let planSchemaCitations: Array<{ criterion_key: string; template_key: string; source_title: string; source_url?: string | null; locator_type?: string | null; locator_value?: string | null }> | null = null;
    let criteriaRewrites: { from: string; to: string }[] = [];
    let useChunkResult = false;
    const usePlanResult = false;
    let usePlanStructureResult = false;
    let planStructureOutput: Awaited<ReturnType<typeof runPlanStructurePipeline>> | null = null;
    const planOutput: Awaited<ReturnType<typeof runPlanGeneratorV1>> | null = null;
    let planPreview: {
      plan_structure?: boolean;
      gate_question?: { id: string; text: string; response_type: "YES_NO_NA" };
      checklist_prompt?: string;
      checklist_items?: Array<{ id: string; text: string; subitems?: string[] }>;
      capabilities: Array<{ criterion_key: string; title: string; capability_state: string; rollup_status?: string; applicable_count?: number; checked_count?: number }>;
      groups: Array<{ criterion_key: string; group_key: string; title: string }>;
      items: Array<{ criterion_key: string; group_key: string; item_key: string; text: string; rationale: string; checked: boolean; is_na: boolean; order_index: number; ofcs?: OfcPreviewRow[] }>;
      ofcs: OfcPreviewRow[];
    } | null = null;
    let chunkExportCount = 0;
    let missingSourceRegistryLink = 0;
    /** When debug=1, last chunk result is used to attach debug_trace to success response. */
    let lastChunkGeneratedForDebug: Awaited<ReturnType<typeof generateModuleContentFromChunks>> | null = null;

    // 3) Export ingested chunks from RUNTIME (Node) then run generator when chunks exist.
    // When REQUIRE_MODULE_COMPREHENSION=1 and comprehension rows exist, use comprehension-driven selection (priority + diversity).
    const moduleKind = kindFromStandardClass(standard_key);
    logProgress(2, "Exporting chunks...", "");
    const useComprehensionSelection =
      process.env.REQUIRE_MODULE_COMPREHENSION === "1" && (comprehensionRows ?? 0) > 0;
    let exportResult: ExportChunksResult;
    if (useComprehensionSelection) {
      exportResult = await exportChunksFromRuntimeComprehensionDriven(
        runtimePool,
        canonicalModuleCode,
        corpusPool ?? null,
        true
      );
    } else {
      exportResult = await exportChunksFromRuntime(runtimePool, canonicalModuleCode, corpusPool ?? null);
    }
    chunkExportCount = exportResult.exported;
    missingSourceRegistryLink = exportResult.missingSourceRegistryLink;
    if (exportResult.comprehension_rows_total != null) {
      preflightReport.comprehension_rows_total = exportResult.comprehension_rows_total;
      preflightReport.comprehension_rows_eligible = exportResult.comprehension_rows_eligible;
      preflightReport.chunks_selected_for_generation = exportResult.chunks_selected_for_generation;
    }
    logProgress(
      2,
      "Chunks exported",
      useComprehensionSelection
        ? `(comprehension-driven: ${chunkExportCount} of ${exportResult.comprehension_rows_eligible ?? 0} eligible)`
        : `(${chunkExportCount} chunks)` + (missingSourceRegistryLink > 0 ? `; ${missingSourceRegistryLink} skipped (no CORPUS link)` : "")
    );
    if (chunkExportCount > 0) {
      // Comprehension: when REQUIRE_MODULE_COMPREHENSION=1 we already ran ensureModuleComprehension above. Populate preflight counts if not set.
      if (comprehensionRows == null) {
        const compCount = await runtimePool.query(
          `SELECT COUNT(*)::int AS n FROM public.module_chunk_comprehension WHERE module_code = $1`,
          [canonicalModuleCode]
        );
        comprehensionRows = (compCount.rows[0] as { n: number } | undefined)?.n ?? 0;
        comprehensionStatus = comprehensionRows > 0 ? "present" : undefined;
      }
      if (isPlanMode(standard_key)) {
        const defaultSub = await getDefaultDisciplineSubtypeId(runtimePool);
        // Prefer derived plan schema (no manual packs). If present, build criteria + OFCs from it.
        try {
          const fromSchema = await buildPlanOutputFromDerivedSchema(canonicalModuleCode, defaultSub);
          logProgress(3, "Using derived plan schema", `sections=${fromSchema.checklist_items.length} elements=${fromSchema.criteria.length}`);
          criteriaPreview = fromSchema.criteria;
          ofcsPreview = fromSchema.ofcs;
          if (fromSchema.citations?.length) planSchemaCitations = fromSchema.citations;
          useChunkResult = true;
          planPreview = {
            plan_structure: true,
            gate_question: { id: "GATE", text: "Does this plan address the required sections?", response_type: "YES_NO_NA" as const },
            checklist_prompt: "Required plan sections (from derived schema)",
            checklist_items: fromSchema.checklist_items,
            capabilities: [],
            groups: [],
            items: [],
            ofcs: fromSchema.ofcs,
          };
          planStructureOutput = {
            plan_type: fromSchema.plan_type,
            gate_question: { id: "GATE", text: "Does this plan address the required sections?", response_type: "YES_NO_NA" as const },
            checklist_prompt: "Required plan sections (from derived schema)",
            checklist_items: fromSchema.checklist_items,
            capabilities: [],
          };
          usePlanStructureResult = false;
          // Persist path: use "else" branch (criteria + ofcs) not gate+checklist-only
        } catch (schemaErr: unknown) {
          const err = schemaErr as Error & { code?: string };
          if (err.code === "PLAN_SCHEMA_NOT_DERIVED" || (err.message && err.message.includes("Plan schema not derived"))) {
            return NextResponse.json(
              {
                error: "Plan schema not derived",
                message: err.message,
                hint: "On the Standard tab, click 'Derive Plan Schema' first (with Plan selected). Then run Generate.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          // No derived schema: require Ollama and run legacy structure pipeline (TOC extraction).
          const ollamaUrl = getOllamaUrl();
          const ollamaPreflight = await checkOllamaReachable();
          if (!ollamaPreflight.ok) {
            return NextResponse.json(
              {
                error: "Ollama not reachable",
                message: ollamaPreflight.message,
                ollama_url: ollamaUrl,
                hint: `Plan generation needs Ollama. Ensure Ollama is running (e.g. start the Ollama app or run 'ollama serve'), then run: ollama pull ${getPlanStandardModel()}. (Plan uses OLLAMA_PLAN_STANDARD_MODEL / psa-plan-standard:latest.) To verify: curl ${ollamaUrl.replace(/\/+$/, "")}/api/tags. Set PSA_OLLAMA_URL in .env.local if Ollama runs on another host.`,
                preflight: preflightReport,
              },
              { status: 503 }
            );
          }
          try {
            logProgress(3, "Running PLAN structure pipeline (heading extraction)", "");
            const source_titles = (preflightReport.sources_used ?? []).map((s) => s.label).filter(Boolean);
            const topSource = preflightReport.sources_used?.[0];
            const structureResult = await runPlanStructurePipeline({
              moduleCode: canonicalModuleCode,
              request_plan_type: request_plan_type ?? null,
              source_titles: source_titles.length > 0 ? source_titles : undefined,
              top_source_id: topSource?.source_id ?? null,
              top_source_label: topSource?.label ?? null,
              top_source_chunks_expected: topSource?.contributed_chunks ?? null,
            });
            planStructureOutput = structureResult;
            usePlanStructureResult = true;
            useChunkResult = true;

            if (!structureResult.gate_question?.text) {
              throw new Error("PLAN_MODE_INVARIANT_FAILED: missing gate_question");
            }
            if (!structureResult.checklist_items || structureResult.checklist_items.length < 6) {
              throw new Error(
                `PLAN_MODE_INVARIANT_FAILED: checklist_items missing/too few (${structureResult.checklist_items?.length ?? 0})`
              );
            }

            criteriaPreview = [
              {
                criterion_key: structureResult.gate_question.id,
                title: "Plan gate",
                question_text: structureResult.gate_question.text,
                applicability: "APPLIES" as const,
                discipline_subtype_id: defaultSub,
              order_index: 1,
            },
          ];
          ofcsPreview = [];
          planPreview = {
            plan_structure: true,
            gate_question: structureResult.gate_question,
            checklist_prompt: structureResult.checklist_prompt,
            checklist_items: structureResult.checklist_items,
            capabilities: [],
            groups: [],
            items: [],
            ofcs: [],
          };
          logProgress(4, "PLAN structure complete", `gate=1 sections=${structureResult.checklist_items.length} capabilities=${structureResult.capabilities?.length ?? 0} ofcs=0`);
        } catch (e) {
          const err = e as Error & { failure_reason?: string; counts?: { elements?: number }; heading_chunk_count?: number; top_chunk_ids?: string[]; hint?: string };
          const errMsg = err instanceof Error ? err.message : String(e);
          if (errMsg.includes("CHUNK_EXPORT_MISSING") || errMsg.includes("NO_CHUNKS")) {
            return NextResponse.json(
              { error: "Plan structure pipeline failed", message: sanitizeMessageForUser(errMsg), preflight: preflightReport, hint: "Export chunks first; ensure module has ingested sources." },
              { status: 400 }
            );
          }
          if (errMsg.includes("PLAN_MODE_INVARIANT_FAILED")) {
            return NextResponse.json(
              {
                error: "Plan mode invariant failed",
                failure_reason: "PLAN_MODE_INVARIANT_FAILED",
                message: sanitizeMessageForUser(errMsg),
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          if ((err as Error & { code?: string }).code === "PLAN_TOC_NOT_FOUND" || err.failure_reason === "PLAN_TOC_NOT_FOUND") {
            return NextResponse.json(
              {
                error: "Plan TOC not found",
                failure_reason: "PLAN_TOC_NOT_FOUND",
                message: sanitizeMessageForUser(errMsg),
                hint: (err as Error & { hint?: string }).hint ?? "Include PDF pages that contain the plan's Table of Contents. Do not mine arbitrary headings.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          if (errMsg.includes("PLAN_STRUCTURE_SOURCES_MISSING")) {
            return NextResponse.json(
              {
                error: "No structure sources",
                failure_reason: "PLAN_STRUCTURE_SOURCES_MISSING",
                message: sanitizeMessageForUser(errMsg),
                hint: "Add a source titled like 'Active Shooter Emergency Action Plan Template' or 'Active Shooter Emergency Action Plan (Guide)' for structure extraction.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          if (err.failure_reason === "PLAN_CHECKLIST_EXTRACTION_FAILED") {
            return NextResponse.json(
              {
                error: "Plan checklist extraction failed",
                failure_reason: "PLAN_CHECKLIST_EXTRACTION_FAILED",
                counts: err.counts,
                heading_chunk_count: err.heading_chunk_count,
                top_chunk_ids: err.top_chunk_ids,
                message: sanitizeMessageForUser(errMsg),
                hint: err.hint ?? "No TOC/headings detected in chunk set. Ensure sources include a table of contents or numbered section headings.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          const isOllamaUnavailable =
            /fetch failed|ECONNREFUSED|ENOTFOUND|network|socket hang up/i.test(errMsg) ||
            (err as Error & { cause?: { code?: string } }).cause?.code === "ECONNREFUSED";
          const ollamaUrl = getOllamaUrl();
          const hint = isOllamaUnavailable
            ? `Plan generation needs Ollama. Start Ollama (e.g. ollama serve), then run: ollama pull ${getPlanStandardModel()}. (Plan uses OLLAMA_PLAN_STANDARD_MODEL / psa-plan-standard:latest.) URL: ${ollamaUrl}. Set PSA_OLLAMA_URL in .env.local if Ollama runs elsewhere.`
            : "Check Ollama is running and model is available, or retry.";
          return NextResponse.json(
            { error: "Plan structure pipeline failed", message: sanitizeMessageForUser(errMsg), preflight: preflightReport, hint },
            { status: 503 }
          );
        }
        }
        // Guard: plan mode must never produce CAP01–CAP09 or "Plan element exists:" (wrong pipeline)
        if (criteriaPreview.some((c) => c.criterion_key.startsWith("CAP0") || (c.question_text ?? "").includes("Plan element exists:"))) {
          return NextResponse.json(
            {
              error: "Plan modules must use section extraction pipeline",
              failure_reason: "PLAN_MODE_WRONG_PIPELINE",
              hint: "Plan modules must use section extraction pipeline. Do not use capability/OFC pipeline for plans.",
              preflight: preflightReport,
            },
            { status: 400 }
          );
        }
      } else {
        try {
          logProgress(3, "Running document-driven generator", "(may take 2–10 min, no further output until complete)");
          const generationDumpDir = process.env.GENERATION_DUMP_DIR?.trim();
        const chunkGenerated = await generateModuleContentFromChunks(canonicalModuleCode, {
          maxChunks: 80,
          standardClass: standard_key,
          moduleKind,
          debugDump: debugQuery && !!generationDumpDir,
        });
        if (chunkGenerated.itemCount > 0 && chunkGenerated.questions.length > 0) {
          useChunkResult = true;
          lastChunkGeneratedForDebug = chunkGenerated;
          logProgress(4, "Generator complete", `criteria=${chunkGenerated.questions.length} ofcs=${chunkGenerated.ofcs.length}`);
          const subByCriterion = new Map<string, string>();
          const questionsCapped = chunkGenerated.questions.slice(0, MAX_QUESTIONS);
          criteriaPreview = questionsCapped.map((q) => {
            subByCriterion.set(q.criterion_key, q.discipline_subtype_id);
            return {
              criterion_key: q.criterion_key,
              title: q.criterion_key,
              question_text: q.question_text,
              applicability: "APPLIES" as const,
              discipline_subtype_id: q.discipline_subtype_id,
              order_index: q.order_index,
            };
          });
          const normalizedCriteria = normalizeCriteria(criteriaPreview, { mode: moduleKind });
          criteriaPreview.forEach((c, i) => {
            c.question_text = normalizedCriteria[i]?.question_text ?? c.question_text;
          });
          // Pre-validation: rewrite leading What/How into existence-based form (OBJECT only)
          if (moduleKind === "OBJECT") {
            const criteriaStrings = criteriaPreview.map((c) => c.question_text ?? "");
            const { normalized, rewrites } = normalizeCriteriaList(criteriaStrings);
            criteriaRewrites = rewrites;
            if (rewrites.length > 0) {
              console.log("[standard/generate] Auto-normalized criteria (What/How -> existence):", rewrites.length);
              rewrites.forEach((r) => console.log("[standard/generate]   from:", r.from.slice(0, 60) + "... to:", r.to.slice(0, 60) + "..."));
            }
            criteriaPreview.forEach((c, i) => {
              c.question_text = normalized[i] ?? c.question_text;
            });
          }
          try {
            validateStandardCriteriaOrThrow(criteriaPreview.map((c) => c.question_text ?? ""));
          } catch (critErr: unknown) {
            const err = critErr as Error & {
              validationErrors?: Array<{ reason: string; message: string; text: string; fullText?: string; index: number }>;
              byReason?: Record<string, number>;
            };
            const validationErrors = err.validationErrors ?? [];
            const byReason = err.byReason ?? {};
            const failures = validationErrors.slice(0, 20).map((e) => ({
              rule: e.reason,
              index: e.index,
              text: e.fullText ?? e.text,
            }));
            return NextResponse.json(
              {
                error: "Standard criteria validation failed",
                failure_reason: "SCO_CRITERIA_VALIDATION_FAILED",
                code: "SCO_CRITERIA_VALIDATION_FAILED",
                message: err.message,
                counts: {
                  forbidden_leading_what_how: byReason.forbidden_leading_what_how ?? 0,
                  deep_network_cyber_detected: byReason.deep_network_cyber_detected ?? 0,
                  forbidden_prefix: byReason.forbidden_prefix ?? 0,
                  forbidden_phrase_purpose_role: byReason.forbidden_phrase_purpose_role ?? 0,
                  must_end_with_question: byReason.must_end_with_question ?? 0,
                  max_length_exceeded: byReason.max_length_exceeded ?? 0,
                },
                failures,
                rewrites: criteriaRewrites.length > 0 ? criteriaRewrites : undefined,
                validationErrors: validationErrors.slice(0, 15),
                hint: "Criteria must be existence-based, facility-operational; no deep network/technical cyber or 'purpose/role of' technical components.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          const criteriaShapeErrs = validateCriteriaShape(criteriaPreview, { mode: moduleKind });
          if (criteriaShapeErrs.length > 0) {
            return NextResponse.json(
              {
                error: "Criteria shape validation failed",
                failure_reason: "CRITERION_NOT_PLAN_ELEMENT",
                samples: criteriaShapeErrs.slice(0, 10),
                hint:
                  moduleKind === "PLAN"
                    ? "Criteria must be 'Plan element exists: …' or 'Procedure exists: …'. No 'The topic is' placeholders."
                    : "Criteria must be YES/NO question form (end with ?). No 'Plan element exists' prefix; no 'The topic is' placeholders.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
          if (moduleKind === "PLAN") {
            const criteriaPlanErrs = validateCriteriaArePlanElements(
              criteriaPreview.map((c) => c.question_text ?? "")
            );
            if (criteriaPlanErrs.length > 0) {
              return NextResponse.json(
                {
                  error: "Criteria validation failed",
                  failure_reason: "CRITERIA_SCENARIO_OR_FORMAT",
                  criteria_validation_errors: criteriaPlanErrs,
                  hint: "Criteria must be EAP plan elements only. No hazards, scenarios, or 'what to do if…' content.",
                  preflight: preflightReport,
                },
                { status: 400 }
              );
            }
          }
          const defaultSub = chunkGenerated.questions[0]?.discipline_subtype_id ?? "";
          const criterionKeys = new Set(criteriaPreview.map((c) => c.criterion_key));
          const ofcsPerCriterion = new Map<string, number>();
          ofcsPreview = chunkGenerated.ofcs
            .filter((o) => criterionKeys.has(o.criterion_key))
            .filter((o) => {
              const n = ofcsPerCriterion.get(o.criterion_key) ?? 0;
              if (n >= MAX_OFCS_PER_QUESTION) return false;
              ofcsPerCriterion.set(o.criterion_key, n + 1);
              return true;
            })
            .map((o) => ({
              criterion_key: o.criterion_key,
              template_key: o.ofc_id,
              ofc_text: o.ofc_text,
              discipline_subtype_id: subByCriterion.get(o.criterion_key) ?? defaultSub,
              order_index: o.order_index,
            }));
          if (ofcsPreview.length === 0 && criteriaPreview.length > 0) {
            logProgress(4, "Retrying generator", "OFCs were 0; retry once with same options");
            const retryGenerated = await generateModuleContentFromChunks(canonicalModuleCode, {
              maxChunks: 80,
              standardClass: standard_key,
              moduleKind,
            });
            if (retryGenerated.ofcs.length > 0) {
              let nextOrder = ofcsPreview.length + 1;
              const retryOfcs = retryGenerated.ofcs
                .filter((o) => criterionKeys.has(o.criterion_key))
                .filter((o) => {
                  const n = ofcsPerCriterion.get(o.criterion_key) ?? 0;
                  if (n >= MAX_OFCS_PER_QUESTION) return false;
                  ofcsPerCriterion.set(o.criterion_key, n + 1);
                  return true;
                })
                .map((o) => ({
                  criterion_key: o.criterion_key,
                  template_key: o.ofc_id,
                  ofc_text: o.ofc_text,
                  discipline_subtype_id: subByCriterion.get(o.criterion_key) ?? defaultSub,
                  order_index: nextOrder++,
                }));
              ofcsPreview.push(...retryOfcs);
            }
          }
          const measuresLint = lintMeasuresOfcsOnly(ofcsPreview);
          if (!measuresLint.pass) {
            const rule_descriptions: Record<string, string> = {};
            for (const id of measuresLint.violated_rule_ids ?? []) {
              if (RULE_DESCRIPTIONS[id]) rule_descriptions[id] = RULE_DESCRIPTIONS[id];
            }
            return NextResponse.json(
              {
                error: "MEASURES normalization lint failed",
                failure_reason: measuresLint.failure_reason ?? "NORMALIZATION_LINT_FAILED",
                violated_rule_ids: measuresLint.violated_rule_ids,
                rule_descriptions,
                samples: measuresLint.samples.slice(0, 10),
                hint: "Pre-lint sanitization was applied. If this still fails, generator output violated plain-language rules (declarative checklist only). No partial results saved.",
                preflight: preflightReport,
              },
              { status: 400 }
            );
          }
        } else {
          const reason = chunkGenerated.itemsEmptyReason;
          const reasonMessage =
            reason === "PACKET_PIPELINE_NO_USABLE_CHUNKS"
              ? "No usable chunks: all had missing text, locator, or source label. Fix export/join so chunks have source_label and page locator."
              : reason === "llm_empty_response"
                ? "LLM returned empty or whitespace response."
                : reason === "llm_call_failed"
                  ? "LLM call failed (timeout or connection error)."
                  : reason === "json_parse_failed"
                    ? "LLM response was not valid JSON."
                    : reason === "schema_invalid"
                      ? "Parsed response did not match expected schema."
                      : reason === "extractor_returned_zero_items"
                        ? "LLM returned valid JSON but items array was empty."
                        : reason === "all_items_dropped"
                          ? "All extracted items were dropped (validation or citation)."
                          : reason === "no_packets"
                            ? "No non-IGNORE packets were run (router filtered all chunks)."
                            : reason === "ollama_response_not_valid_json"
                              ? "Generator response was not valid JSON (parse error)."
                              : reason === "ollama_response_not_dict"
                                ? "Generator response was not a JSON object."
                                : reason === "ollama_response_missing_or_invalid_items"
                                  ? "Generator response had no valid 'items' array."
                                  : reason === "all_items_dropped_invalid_citation"
                                    ? "Generator returned items but all were dropped (citation mismatch)."
                                    : reason === "no_chunks"
                                      ? "No chunks were sent to the parser."
                                      : "Generator produced no usable items.";
          const hint =
            "Ensure sources are ingested on the Sources tab, then try Generate again. If it still fails, run the diagnostic from project root (see server logs).";
          const debugTrace: GenerationDebugTrace = buildTraceFromChunkResult({
            chunksTotal: chunkGenerated.chunksTotal ?? chunkGenerated.totalRetrieved ?? 0,
            chunksUsable: chunkGenerated.chunksUsable ?? Math.max(0, (chunkGenerated.totalRetrieved ?? 0) - (chunkGenerated.missingTextCount ?? 0) - (chunkGenerated.missingLocatorCount ?? 0) - (chunkGenerated.missingSourceLabelCount ?? 0)),
            missingSourceLabel: chunkGenerated.missingSourceLabelCount ?? 0,
            missingLocator: chunkGenerated.missingLocatorCount ?? 0,
            missingText: chunkGenerated.missingTextCount ?? 0,
            sampleHandles: [],
            itemsEmptyReason: reason,
            itemsKept: 0,
            droppedTotal: chunkGenerated.droppedTotal,
            dropReasons: chunkGenerated.dropReasons,
            dropExamples: chunkGenerated.dropExamples,
            extracted: undefined,
            llm: (chunkGenerated.debugTraceFromPacketPipeline as Record<string, unknown> | undefined)?.llm as GenerationDebugTrace["llm"] | undefined,
            parsing: (chunkGenerated.debugTraceFromPacketPipeline as Record<string, unknown> | undefined)?.parsing as GenerationDebugTrace["parsing"] | undefined,
            schema: (chunkGenerated.debugTraceFromPacketPipeline as Record<string, unknown> | undefined)?.schema as GenerationDebugTrace["schema"] | undefined,
          });
          const payload: Record<string, unknown> = {
            error: "Chunk pipeline returned no items",
            message: "Generator produced no usable items.",
            itemsEmptyReason: reason,
            reasonMessage,
            hint,
            preflight: preflightReport,
            debug_trace: debugTrace,
            call_to_action: "See debug_trace for exact failure stage.",
          };
          if (chunkGenerated.droppedTotal != null) {
            payload.dropped_total = chunkGenerated.droppedTotal;
            payload.drop_reasons = chunkGenerated.dropReasons ?? {};
            payload.examples = (chunkGenerated.dropExamples ?? []).slice(0, 5);
          }
          if (reason === "PACKET_PIPELINE_NO_USABLE_CHUNKS") {
            payload.total_retrieved = chunkGenerated.totalRetrieved ?? 0;
            payload.missing_text_count = chunkGenerated.missingTextCount ?? 0;
            payload.missing_locator_count = chunkGenerated.missingLocatorCount ?? 0;
            payload.missing_source_label_count = chunkGenerated.missingSourceLabelCount ?? 0;
            payload.missing_text_chunk_ids = (chunkGenerated.missingTextChunkIds ?? []).slice(0, 5);
            payload.missing_locator_chunk_ids = (chunkGenerated.missingLocatorChunkIds ?? []).slice(0, 5);
            payload.missing_source_label_chunk_ids = (chunkGenerated.missingSourceLabelChunkIds ?? []).slice(0, 5);
          }
          if (reason === "no_packets" && chunkGenerated.router) {
            payload.router = {
              total: chunkGenerated.router.total,
              keep: chunkGenerated.router.keep,
              maybe: chunkGenerated.router.maybe,
              ignore: chunkGenerated.router.ignore,
              examples: chunkGenerated.router.examples ?? { ignore: [], maybe: [], keep: [] },
            };
          }
          if (chunkGenerated.stage_debug) {
            payload.stage_debug = chunkGenerated.stage_debug;
          }
          if (missingSourceRegistryLink > 0) {
            payload.missing_source_registry_link = missingSourceRegistryLink;
            payload.hint = `${payload.hint ?? hint} Run backfill: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts ${canonicalModuleCode}`;
          }
          return NextResponse.json(payload, { status: 503 });
        }
      } catch (e) {
        if (e instanceof STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL) {
          const counts = (e as STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL).counts;
          return NextResponse.json(
            {
              error: "Insufficient PSA-scope content",
              failure_reason: "STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL",
              message: e.message,
              counts: {
                total: counts.total,
                excluded_deep_network: counts.excluded_deep_network,
                remaining: counts.remaining,
                by_source: counts.by_source,
              },
              hint: "Too many chunks were excluded as deep network/technical cyber. Add more physical-security or convergence (governance) sources, or remove cyber-heavy documents.",
              preflight: preflightReport,
            },
            { status: 400 }
          );
        }
        if (e instanceof Error && e.name === "STANDARD_PROMPT_CONTAINS_PLAN_FOR_OBJECT_MODULE") {
          return NextResponse.json(
            {
              error: "Object module prompt must not contain plan vocabulary",
              failure_reason: "STANDARD_PROMPT_CONTAINS_PLAN_FOR_OBJECT_MODULE",
              message: e.message,
              hint: "The generator prompt for object modules must not reference 'plan element'. This is an internal configuration error.",
              preflight: preflightReport,
            },
            { status: 400 }
          );
        }
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[standard/generate] Chunk pipeline failed:", e);
        return NextResponse.json(
          {
            error: "Chunk pipeline failed",
            message: sanitizeMessageForUser(msg),
            hint: "Ensure sources are ingested on the Sources tab, then try Generate again. If it still fails, see server logs for diagnostics.",
            preflight: preflightReport,
          },
          { status: 503 }
        );
      }
      }
    }

    // Chunk-only: no doctrine fallback. Fail if no chunks (should not reach here if preflight passed).
    if (!useChunkResult) {
      const hint =
        missingSourceRegistryLink > 0
          ? `All ${missingSourceRegistryLink} chunk(s) lack a CORPUS source_registry link. Run: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts ${canonicalModuleCode}`
          : "Add sources on the Sources tab, then retry.";
      return NextResponse.json(
        {
          error: "No ingested chunks",
          failure_reason: missingSourceRegistryLink > 0 ? "MISSING_SOURCE_REGISTRY_LINK" : "NO_RETRIEVABLE_TEXT",
          message:
            missingSourceRegistryLink > 0
              ? "No chunks could be exported: every document must be linked to CORPUS source_registry (run backfill script)."
              : "This module has no ingested chunks. Ingest sources on the Sources tab (upload PDFs or link corpus sources), then run Generate.",
          hint,
          ...(missingSourceRegistryLink > 0 ? { missing_source_registry_link: missingSourceRegistryLink } : {}),
          preflight: preflightReport,
        },
        { status: 400 }
      );
    }

    const validForPersist = true;
    const ofcCountWarning =
      useChunkResult && ofcsPreview.length < MIN_OFCS_FOR_QUESTION_SET && criteriaPreview.length >= 12
        ? `Fewer than ${MIN_OFCS_FOR_QUESTION_SET} OFCs (${ofcsPreview.length}); prompt recommends 1–4 per question.`
        : undefined;

    // PLAN mode: expose checklist_items and plan_type at top level (canonical); planPreview is optional for backward compat
    const topLevelChecklistItems =
      usePlanStructureResult && planStructureOutput?.checklist_items ? planStructureOutput.checklist_items : [];
    const topLevelPlanType =
      usePlanStructureResult && planStructureOutput?.plan_type ? planStructureOutput.plan_type : undefined;

    const preview = {
      criteria: criteriaPreview,
      ofcs: ofcsPreview,
      validForPersist,
      ...(criteriaRewrites.length > 0 ? { rewrites: criteriaRewrites } : {}),
      source: usePlanStructureResult ? ("plan_structure" as const) : usePlanResult ? ("plan_v1" as const) : ("ollama_chunks" as const),
      chunkExportCount,
      ...(missingSourceRegistryLink > 0 ? { missingSourceRegistryLink } : {}),
      ofcCountWarning,
      preflight: {
        ...preflightReport,
        chunks_retrieved_total: preflightReport.chunk_count,
        chunks_top_source: preflightReport.sources_used?.[0]?.contributed_chunks ?? undefined,
        ...(comprehensionStatus != null ? { comprehension_status: comprehensionStatus } : {}),
        ...(comprehensionRows != null ? { comprehension_rows: comprehensionRows } : {}),
        ...(planStructureOutput?.capabilities != null
          ? (() => {
              const caps = planStructureOutput.capabilities;
              const plan_vital_elements_count = caps.reduce(
                (sum, cap) => sum + (cap.vital_elements_count ?? cap.vital_elements?.length ?? 0),
                0
              );
              const plan_capabilities_with_vitals = caps.filter(
                (cap) => (cap.vital_elements_count ?? cap.vital_elements?.length ?? 0) > 0
              ).length;
              return {
                plan_capabilities_count: caps.length,
                plan_vital_elements_count,
                plan_capabilities_with_vitals,
                ...(planStructureOutput?.plan_vital_elements_reason != null
                  ? { plan_vital_elements_reason: planStructureOutput.plan_vital_elements_reason }
                  : {}),
                ...(planStructureOutput?.plan_vital_elements_diagnostics != null
                  ? { plan_vital_elements_diagnostics: planStructureOutput.plan_vital_elements_diagnostics }
                  : {}),
                ...(planStructureOutput?.plan_sections_found_in_text != null
                  ? { plan_sections_found_in_text: planStructureOutput.plan_sections_found_in_text }
                  : {}),
                ...(planStructureOutput?.plan_markers_found != null
                  ? { plan_markers_found: planStructureOutput.plan_markers_found }
                  : {}),
                ...(planStructureOutput?.plan_bullets_captured != null
                  ? { plan_bullets_captured: planStructureOutput.plan_bullets_captured }
                  : {}),
                ...(planStructureOutput?.chunks_used_count != null
                  ? { chunks_top_source: planStructureOutput.chunks_used_count }
                  : {}),
              };
            })()
          : {}),
      },
      ...(topLevelChecklistItems.length > 0 ? { checklist_items: topLevelChecklistItems } : {}),
      ...(topLevelPlanType ? { plan_type: topLevelPlanType } : {}),
      ...(planPreview
        ? {
            planPreview: {
              ...planPreview,
              gate: criteriaPreview[0]?.question_text ?? planPreview.gate_question?.text ?? null,
              sections: planPreview.checklist_items ?? topLevelChecklistItems,
            },
          }
        : {}),
      ...(debugQuery && lastChunkGeneratedForDebug
        ? {
            debug_trace: buildTraceFromChunkResult({
              chunksTotal: lastChunkGeneratedForDebug.chunksTotal ?? 0,
              chunksUsable: lastChunkGeneratedForDebug.chunksUsable ?? 0,
              missingSourceLabel: 0,
              missingLocator: 0,
              missingText: 0,
              sampleHandles: [],
              itemsKept: lastChunkGeneratedForDebug.itemCount,
              dropReasons: lastChunkGeneratedForDebug.dropReasons,
              dropExamples: lastChunkGeneratedForDebug.dropExamples,
              llm: (lastChunkGeneratedForDebug.debugTraceFromPacketPipeline as Record<string, unknown> | undefined)?.llm as GenerationDebugTrace["llm"] | undefined,
              parsing: (lastChunkGeneratedForDebug.debugTraceFromPacketPipeline as Record<string, unknown> | undefined)?.parsing as GenerationDebugTrace["parsing"] | undefined,
            }),
          }
        : {}),
      ...((dryRun !== false || debugQuery) && lastChunkGeneratedForDebug?.stage_debug ? { stage_debug: lastChunkGeneratedForDebug.stage_debug } : {}),
    };

    // C) Instrument: right before saving/returning payload
    if (process.env.NODE_ENV !== "production") {
      console.log("[plan] payload keys:", Object.keys(preview));
      console.log("[plan] saving checklist_items:", (preview as { checklist_items?: unknown[] }).checklist_items?.length ?? 0);
    }
    // D) Instrument: preflight printer (what we send to client)
    if (process.env.NODE_ENV !== "production") {
      console.log("[preflight] plan checklist_items:", (preview as { checklist_items?: unknown[] }).checklist_items?.length ?? 0);
    }

    if (dryRun !== false) {
      console.log("[standard/generate] [██████████] Done. Dry run (preview only).");
      return NextResponse.json({ dryRun: true, ...preview });
    }

    // 7) Persist: delete existing instance (CASCADE removes criteria, responses, ofcs, citations, groups, items)
    await runtimePool.query("DELETE FROM public.module_instances WHERE module_code = $1", [canonicalModuleCode]);

    const inst = await runtimePool.query(
      `INSERT INTO public.module_instances (module_code, standard_key, standard_version, attributes_json)
       VALUES ($1, $2, $3, '{}'::jsonb)
       RETURNING id`,
      [canonicalModuleCode, standard_key, standardVersion]
    );
    const instanceId = inst.rows[0].id as string;

    if (isStandardClassKey(standard_key)) {
      try {
        await runtimePool.query(
          `UPDATE public.assessment_modules SET standard_class = $1 WHERE module_code = $2`,
          [standard_key, canonicalModuleCode]
        );
      } catch {
        /* column may not exist */
      }
    }

    const defaultSub = await getDefaultDisciplineSubtypeId(runtimePool);

    if (usePlanStructureResult && planStructureOutput) {
      // Plan structure persist: 1 gate criterion + 1 group (SECTIONS) + N checklist items. No OFCs.
      const gate = planStructureOutput.gate_question;
      const critRow = await runtimePool.query(
        `INSERT INTO public.module_instance_criteria
         (module_instance_id, criterion_key, title, question_text, discipline_subtype_id, applicability, order_index)
         VALUES ($1, $2, $3, $4, $5, 'APPLIES', 1)
         RETURNING id`,
        [instanceId, gate.id, "Plan gate", gate.text, defaultSub]
      );
      const gateCriterionId = (critRow.rows[0] as { id: string }).id;
      const groupRow = await runtimePool.query(
        `INSERT INTO public.module_instance_checklist_groups (module_instance_id, criterion_id, group_key, title)
         VALUES ($1, $2, 'SECTIONS', $3) RETURNING id`,
        [instanceId, gateCriterionId, planStructureOutput.checklist_prompt]
      );
      const sectionsGroupId = (groupRow.rows[0] as { id: string }).id;
      for (let i = 0; i < planStructureOutput.checklist_items.length; i++) {
        const item = planStructureOutput.checklist_items[i];
        await runtimePool.query(
          `INSERT INTO public.module_instance_checklist_items
           (module_instance_id, group_id, order_index, text, rationale, checked, is_na, derived_unchecked, suppressed)
           VALUES ($1, $2, $3, $4, '', false, false, false, false)`,
          [instanceId, sectionsGroupId, i + 1, item.text]
        );
      }
    } else if (usePlanResult && planOutput) {
      // PLAN persist (legacy capability pipeline): criteria (PLAN_CAPABILITY) → groups → items → ofcs (checklist_item_id) → citations
      const legacyPlanOutput = planOutput as Awaited<ReturnType<typeof runPlanGeneratorV1>>;
      const rollup = legacyPlanOutput.rollup;
      const criterionIdByKey = new Map<string, string>();
      for (const c of legacyPlanOutput.capabilities) {
        const r = rollup.get(c.criterion_key);
        const row = await runtimePool.query(
          `INSERT INTO public.module_instance_criteria
           (module_instance_id, criterion_key, title, question_text, discipline_subtype_id, applicability, order_index,
            criteria_type, capability_state, rollup_status, checked_count, applicable_count, completion_ratio)
           VALUES ($1, $2, $3, $4, $5, 'APPLIES', $6, 'PLAN_CAPABILITY', $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            instanceId,
            c.criterion_key,
            c.title,
            `Plan element exists: ${c.title}.`,
            defaultSub,
            c.order_index,
            c.capability_state,
            r?.rollup_status ?? "DEFICIENT",
            r?.checked_count ?? 0,
            r?.applicable_count ?? 0,
            r?.completion_ratio ?? 0,
          ]
        );
        criterionIdByKey.set(c.criterion_key, (row.rows[0] as { id: string }).id);
      }
      const groupIdByCriterionKey = new Map<string, string>();
      for (const g of legacyPlanOutput.groups) {
        const criterionId = criterionIdByKey.get(g.criterion_key);
        if (!criterionId) continue;
        const row = await runtimePool.query(
          `INSERT INTO public.module_instance_checklist_groups (module_instance_id, criterion_id, group_key, title)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [instanceId, criterionId, g.group_key, g.title]
        );
        groupIdByCriterionKey.set(g.criterion_key, (row.rows[0] as { id: string }).id);
      }
      const itemIdByKey = new Map<string, string>();
      for (const i of legacyPlanOutput.items) {
        const groupId = groupIdByCriterionKey.get(i.group_key);
        if (!groupId) continue;
        const row = await runtimePool.query(
          `INSERT INTO public.module_instance_checklist_items
           (module_instance_id, group_id, order_index, text, rationale, checked, is_na, derived_unchecked, suppressed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [instanceId, groupId, i.order_index, i.text, i.rationale, i.checked, i.is_na, i.derived_unchecked, i.suppressed]
        );
        itemIdByKey.set(i.item_key, (row.rows[0] as { id: string }).id);
      }
      // Insert citations before OFCs so the deferred trigger (enforce_instance_ofc_citations) sees them when each OFC row commits.
      for (const cit of legacyPlanOutput.citations) {
        await runtimePool.query(
          `INSERT INTO public.module_instance_citations
           (module_instance_id, criterion_key, template_key, source_title, source_publisher, source_url, publication_date, locator_type, locator_value)
           VALUES ($1, $2, $3, $4, NULL, $5, NULL, $6, $7)`,
          [instanceId, cit.criterion_key, cit.template_key, cit.source_title, cit.source_url, cit.locator_type, cit.locator_value]
        );
      }
      for (const o of legacyPlanOutput.ofcs) {
        const checklistItemId = itemIdByKey.get(o.checklist_item_id) ?? null;
        await runtimePool.query(
          `INSERT INTO public.module_instance_ofcs
           (module_instance_id, criterion_key, template_key, discipline_subtype_id, ofc_text, order_index, checklist_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [instanceId, o.criterion_key, o.template_key, defaultSub, o.ofc_text, o.order_index, checklistItemId]
        );
      }
    } else {
      // MEASURES persist: criteria → ofcs → citations
      for (const c of criteriaPreview) {
        await runtimePool.query(
          `INSERT INTO public.module_instance_criteria
           (module_instance_id, criterion_key, title, question_text, discipline_subtype_id, applicability, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            instanceId,
            c.criterion_key,
            c.title,
            c.question_text,
            c.discipline_subtype_id,
            c.applicability,
            c.order_index,
          ]
        );
      }
      for (const o of ofcsPreview) {
        await runtimePool.query(
          `INSERT INTO public.module_instance_ofcs
           (module_instance_id, criterion_key, template_key, discipline_subtype_id, ofc_text, order_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [instanceId, o.criterion_key, o.template_key, o.discipline_subtype_id, o.ofc_text, o.order_index]
        );
      }
      if (planSchemaCitations?.length) {
        for (const cit of planSchemaCitations) {
          await runtimePool.query(
            `INSERT INTO public.module_instance_citations
             (module_instance_id, criterion_key, template_key, source_title, source_publisher, source_url, publication_date, locator_type, locator_value)
             VALUES ($1, $2, $3, $4, NULL, $5, NULL, $6, $7)`,
            [instanceId, cit.criterion_key, cit.template_key, cit.source_title, cit.source_url ?? null, cit.locator_type ?? null, cit.locator_value ?? null]
          );
        }
      }
      const parserPath = path.join(PARSER_OUTPUT_DIR, `module_parser_test_${canonicalModuleCode}.json`);
      const criterionToChunkId = new Map<string, string>();
      if (fs.existsSync(parserPath)) {
        try {
          const raw = fs.readFileSync(parserPath, "utf-8");
          const parserOut = JSON.parse(raw) as { items?: Array<{ question?: string; source_chunk_id?: string }> };
          const items = Array.isArray(parserOut?.items) ? parserOut.items : [];
          let orderIndex = 1;
          for (const item of items) {
            const questionText = (item?.question ?? "").toString().trim();
            if (!questionText) continue;
            const ckey = `Q${orderIndex.toString().padStart(3, "0")}`;
            const sid = typeof item?.source_chunk_id === "string" ? item.source_chunk_id.trim() : "";
            if (ckey && sid) criterionToChunkId.set(ckey, sid);
            orderIndex++;
          }
        } catch {
          /* ignore */
        }
      }
      const chunkIdList = [...new Set(criterionToChunkId.values())];
      const chunkMeta = new Map<string, { source_title: string | null; source_url: string | null }>();
      if (chunkIdList.length > 0) {
        const placeholders = chunkIdList.map((_, i) => `$${i + 1}`).join(",");
        const rows = await runtimePool.query(
          `SELECT mc.id, md.label AS source_title, md.url AS source_url
           FROM public.module_chunks mc
           JOIN public.module_documents md ON md.id = mc.module_document_id
           WHERE mc.id IN (${placeholders})`,
          chunkIdList
        );
        for (const r of rows.rows as { id: string; source_title: string | null; source_url: string | null }[]) {
          chunkMeta.set(r.id, { source_title: r.source_title ?? "Chunk-derived", source_url: r.source_url ?? null });
        }
      }
      for (const o of ofcsPreview) {
        const chunkId = criterionToChunkId.get(o.criterion_key);
        const meta = chunkId ? chunkMeta.get(chunkId) : null;
        const source_title = meta?.source_title ?? "Chunk-derived";
        const source_url = meta?.source_url ?? null;
        await runtimePool.query(
          `INSERT INTO public.module_instance_citations
           (module_instance_id, criterion_key, template_key, source_title, source_publisher, source_url, publication_date, locator_type, locator_value)
           VALUES ($1, $2, $3, $4, NULL, $5, NULL, 'chunk', $6)`,
          [instanceId, o.criterion_key, o.template_key, source_title, source_url, chunkId ?? ""]
        );
      }
    }

    console.log("[standard/generate] [██████████] Done. Applied (persisted instance).");
    return NextResponse.json({ dryRun: false, ...preview });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/admin/modules/[moduleCode]/standard/generate]", e);
    return NextResponse.json(
      { error: "Module standard generation failed", message: msg },
      { status: 500 }
    );
  }
}
