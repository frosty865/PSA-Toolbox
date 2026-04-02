/**
 * Preflight for module generation: source_count, usable_source_count, chunk_count, sources_used.
 * Used to fail fast with clear failure_reason (NO_SOURCES, NO_USABLE_SOURCES, NO_RETRIEVABLE_TEXT)
 * and to surface diagnostics in the UI.
 */

export type PreflightStructure = "PLAN" | "MEASURES";

export interface PreflightSourceUsed {
  source_id: string;
  label: string;
  type: string;
  contributed_chunks: number;
}

export interface PreflightReport {
  module_code: string;
  structure: PreflightStructure;
  source_count: number;
  usable_source_count: number;
  chunk_count: number;
  sources_used: PreflightSourceUsed[];
  failure_reason?: string;
  /** PLAN mode: set from plan structure pipeline result; number of TOC-derived plan capabilities. */
  plan_capabilities_count?: number;
  /** PLAN mode: total Level-2 vital elements across all capabilities. */
  plan_vital_elements_count?: number;
  /** PLAN mode: number of capabilities that have at least one vital element. */
  plan_capabilities_with_vitals?: number;
  /** PLAN mode: when vital_elements_count is 0, concrete reason for diagnostics. */
  plan_vital_elements_reason?: string;
  /** PLAN mode: when vital_elements_count is 0, diagnostic counts (top_source_chunks, parsed_pages_count, sections_with_nonempty_text, sections_with_marker_present). */
  plan_vital_elements_diagnostics?: {
    top_source_chunks: number;
    parsed_pages_count: number;
    sections_with_nonempty_text: number;
    sections_with_marker_present: number;
  };
  /** PLAN mode: section-anchored extraction — sections whose header was found in fullText. */
  plan_sections_found_in_text?: number;
  /** PLAN mode: section-anchored extraction — marker phrases found. */
  plan_markers_found?: number;
  /** PLAN mode: section-anchored extraction — bullets captured. */
  plan_bullets_captured?: number;
  /** Total chunks retrieved (all sources) for reconciliation. */
  chunks_retrieved_total?: number;
  /** Chunks from top source only (used for plan structure / vitals). */
  chunks_top_source?: number;
  /** When REQUIRE_MODULE_COMPREHENSION=1: "present" (already had rows) or "created" (ran comprehension this request). */
  comprehension_status?: "present" | "created";
  /** Row count in module_chunk_comprehension for this module (auditable). */
  comprehension_rows?: number;
  /** Total rows in module_chunk_comprehension for this module (when comprehension-driven selection used). */
  comprehension_rows_total?: number;
  /** Rows with supports_question_generation=true and priority>=MEDIUM (when comprehension-driven selection used). */
  comprehension_rows_eligible?: number;
  /** Chunks actually selected for generation (when comprehension-driven selection used). */
  chunks_selected_for_generation?: number;
  /** Model used for standards generation (plan or object). Set so you never guess. */
  standards_model_used?: string;
  /** Schema-first: active plan schema id (plan_schemas table). */
  plan_schema_id?: string;
  /** Schema-first: derive_method (TOC, HEADINGS, LEGACY). */
  plan_schema_derive_method?: string;
  /** Schema-first: confidence (HIGH, MEDIUM, LOW). */
  plan_schema_confidence?: string;
  /** Schema-first: sections count from stored schema. */
  plan_schema_sections_count?: number;
  /** Schema-first: elements count from stored schema. */
  plan_schema_elements_count?: number;
  /** When PLAN and no stored schema: set to true so UI/caller can prompt derive. */
  plan_schema_missing?: boolean;
}

const MIN_CHUNK_LENGTH = 200;

/**
 * Build preflight report from RUNTIME: module_sources, module_documents, module_chunks.
 * Usable = MODULE_UPLOAD with at least one ingested document and chunks (length >= MIN_CHUNK_LENGTH).
 * CORPUS_POINTER does not contribute chunks in current RUNTIME-only flow.
 */
export async function buildPreflightReport(
  runtimePool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  moduleCode: string,
  structure: PreflightStructure
): Promise<PreflightReport> {
  // Match module_code case-insensitively (URL vs DB casing may differ)
  const sourcesRows = await runtimePool.query(
    `SELECT
        ms.id::text AS source_id,
        COALESCE(ms.source_label, '') AS label,
        COALESCE(ms.source_type, '') AS type,
        ms.sha256
     FROM public.module_sources ms
     WHERE ms.module_code ILIKE $1`,
    [moduleCode]
  );
  let sources = sourcesRows.rows as { source_id: string; label: string; type: string; sha256: string | null }[];

  // Include ingested module_documents that have no module_sources row (same as Sources tab UI)
  const docOnlyRows = await runtimePool.query(
    `SELECT md.id::text AS source_id, COALESCE(md.label, 'Ingested document') AS label, 'MODULE_UPLOAD' AS type, md.sha256
     FROM public.module_documents md
     WHERE md.module_code ILIKE $1 AND md.status IN ('INGESTED', 'DOWNLOADED')`,
    [moduleCode]
  );
  const sourceSha256Set = new Set(sources.map((s) => s.sha256).filter(Boolean));
  for (const row of docOnlyRows.rows as { source_id: string; label: string; type: string; sha256: string | null }[]) {
    if (row.sha256 && !sourceSha256Set.has(row.sha256)) {
      sourceSha256Set.add(row.sha256);
      sources = sources.concat([row]);
    }
  }
  const source_count = sources.length;

  const chunkCountRows = await runtimePool.query(
    `SELECT
        ms.id::text AS source_id,
        COUNT(mc.id)::int AS contributed_chunks
     FROM public.module_sources ms
     LEFT JOIN public.module_documents md ON md.module_code ILIKE ms.module_code AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
     LEFT JOIN public.module_chunks mc ON mc.module_document_id = md.id AND length(mc.text) >= $2
     WHERE ms.module_code ILIKE $1
     GROUP BY ms.id, ms.source_label, ms.source_type`,
    [moduleCode, MIN_CHUNK_LENGTH]
  );
  const bySource = new Map<string, number>();
  const msSourceIds = new Set((sourcesRows.rows as { source_id: string }[]).map((r) => r.source_id));
  for (const r of chunkCountRows.rows as { source_id: string; contributed_chunks: number }[]) {
    const n = Number(r.contributed_chunks) || 0;
    bySource.set(r.source_id, n);
  }
  // Chunk counts for orphan module_documents (so they appear in sources_used)
  const docChunkRows = await runtimePool.query(
    `SELECT md.id::text AS source_id, COUNT(mc.id)::int AS contributed_chunks
     FROM public.module_documents md
     LEFT JOIN public.module_chunks mc ON mc.module_document_id = md.id AND length(mc.text) >= $2
     WHERE md.module_code ILIKE $1 AND md.status IN ('INGESTED', 'DOWNLOADED')
     GROUP BY md.id`,
    [moduleCode, MIN_CHUNK_LENGTH]
  );
  for (const r of docChunkRows.rows as { source_id: string; contributed_chunks: number }[]) {
    const n = Number(r.contributed_chunks) || 0;
    if (!msSourceIds.has(r.source_id)) bySource.set(r.source_id, n);
  }
  const chunk_count = Array.from(bySource.values()).reduce((a, b) => a + b, 0);

  const sources_used: PreflightSourceUsed[] = sources
    .map((s) => ({
      source_id: s.source_id,
      label: s.label,
      type: s.type,
      contributed_chunks: bySource.get(s.source_id) ?? 0,
    }))
    .filter((s) => s.contributed_chunks > 0)
    .sort((a, b) => b.contributed_chunks - a.contributed_chunks);
  const usable_source_count = sources_used.length;

  let failure_reason: string | undefined;
  if (source_count === 0) failure_reason = "NO_SOURCES";
  else if (usable_source_count === 0) failure_reason = "NO_USABLE_SOURCES";
  else if (chunk_count === 0) failure_reason = "NO_RETRIEVABLE_TEXT";

  const report: PreflightReport = {
    module_code: moduleCode,
    structure,
    source_count,
    usable_source_count,
    chunk_count,
    sources_used,
    failure_reason,
  };

  if (structure === "PLAN") {
    try {
      const schemaRow = await runtimePool.query(
        `SELECT id, derive_method, confidence FROM public.plan_schemas WHERE module_code = $1 AND is_active = true LIMIT 1`,
        [moduleCode]
      );
      if (schemaRow.rows.length > 0) {
        const active = schemaRow.rows[0] as { id?: unknown; derive_method?: unknown; confidence?: unknown };
        const activeId = typeof active.id === "string" ? active.id : null;
        if (!activeId) {
          report.plan_schema_missing = true;
          return report;
        }
        const sectionsRes = await runtimePool.query(
          `SELECT COUNT(*)::int AS n FROM public.plan_schemas_sections WHERE plan_schema_id = $1`,
          [activeId]
        );
        const elementsRes = await runtimePool.query(
          `SELECT COUNT(*)::int AS n FROM public.plan_schemas_elements WHERE plan_schema_id = $1`,
          [activeId]
        );
        const sections_count = (sectionsRes.rows[0] as { n?: number } | undefined)?.n ?? 0;
        const elements_count = (elementsRes.rows[0] as { n?: number } | undefined)?.n ?? 0;
        report.plan_schema_id = activeId;
        report.plan_schema_derive_method = typeof active.derive_method === "string" ? active.derive_method : undefined;
        report.plan_schema_confidence = typeof active.confidence === "string" ? active.confidence : undefined;
        report.plan_schema_sections_count = sections_count;
        report.plan_schema_elements_count = elements_count;
        report.plan_capabilities_count = sections_count;
        report.plan_vital_elements_count = elements_count;
      } else {
        report.plan_schema_missing = true;
      }
    } catch {
      report.plan_schema_missing = true;
    }
  }

  return report;
}
