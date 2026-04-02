import { loadModuleTemplate } from "@/app/lib/modules/module_template_loader";
import { validateExistenceQuestion } from "@/app/lib/modules/question_quality";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import type { Pool } from "pg";

type EvidenceHit = {
  source_registry_id: string;
  locator: unknown;
  excerpt: string;
  score: number;
};

export type ModuleQuestionSuggestion = {
  family_code: string;
  question: string;
  discipline_subtype_code: string | null;
  evidence: EvidenceHit;
  rationale: string; // derived from excerpt (short)
};

function clip(s: string, n = 280) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function hashKey(s: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function findEvidence(
  sourceIds: string[],
  signals: string[],
  corpusPool: Pool,
  moduleCode?: string
): Promise<EvidenceHit | null> {
  // Find chunks from module corpus sources that match evidence signals
  const sigs = (signals || []).map(s => s.trim()).filter(Boolean);
  if (!sigs.length || !sourceIds.length) return null;

  // Query chunks from module corpus only (filtered by scope_tags)
  // Path: source_registry.id -> corpus_documents.source_registry_id -> document_chunks
  // MUST filter by scope_tags->'tags'->>'module_code' and ingestion_stream = 'MODULE'
  const queryParams: unknown[] = [sourceIds];
  let paramIndex = 2; // $1 is sourceIds
  let moduleCodeFilter = '';
  if (moduleCode) {
    queryParams.push(moduleCode);
    moduleCodeFilter = `AND (sr.scope_tags->'tags'->>'module_code') = $${paramIndex}`;
    paramIndex++;
  }
  
  // Build signal filters with correct parameter indices
  const signalFilters = sigs.map((_, i) => 
    `CASE WHEN dc.chunk_text ILIKE $${paramIndex + i} THEN 1 ELSE 0 END`
  ).join(" + ");
  
  const rows = await corpusPool.query<{
    source_registry_id: string;
    locator: unknown;
    excerpt: string;
    match_count: number;
  }>(
    `
    WITH hits AS (
      SELECT
        sr.id as source_registry_id,
        CASE 
          WHEN dc.locator_type IS NOT NULL AND dc.locator IS NOT NULL
          THEN jsonb_build_object('type', dc.locator_type, 'locator', dc.locator)
          ELSE jsonb_build_object('type', 'chunk', 'chunk_id', dc.chunk_id::text)
        END as locator,
        dc.chunk_text as excerpt,
        (${signalFilters}) as match_count
      FROM public.source_registry sr
      JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
      JOIN public.document_chunks dc ON dc.document_id = cd.id
      WHERE sr.id::text = ANY($1::text[])
        AND (sr.scope_tags->>'ingestion_stream') = 'MODULE'
        ${moduleCodeFilter}
      ORDER BY match_count DESC
      LIMIT 50
    )
    SELECT source_registry_id, locator, excerpt, match_count FROM hits
    WHERE match_count > 0
    ORDER BY match_count DESC
    LIMIT 1
    `,
    [...queryParams, ...sigs.map(s => `%${s}%`)]
  );

  if (!rows.rows?.length) return null;
  const r = rows.rows[0];
  return {
    source_registry_id: r.source_registry_id,
    locator: r.locator,
    excerpt: clip(r.excerpt, 420),
    score: Math.min(1, r.match_count / Math.max(1, sigs.length))
  };
}

export async function generateModuleQuestionSuggestions(
  moduleCode: string,
  sourceIds: string[]
): Promise<{ template: unknown; suggestions: ModuleQuestionSuggestion[] }> {
  const tpl = loadModuleTemplate(moduleCode);
  const corpusPool = getCorpusPool();
  const runtimePool = getRuntimePool();

  const out: ModuleQuestionSuggestion[] = [];
  const seen = new Set<string>();

  // Get discipline subtype mappings
  const subtypeQuery = `SELECT id, code, discipline_id FROM public.discipline_subtypes WHERE is_active = true`;
  guardModuleQuery(subtypeQuery, 'generateModuleQuestionSuggestions: discipline_subtypes');
  const subRows = await runtimePool.query<{ id: string; code: string; discipline_id: string }>(subtypeQuery);
  const subtypeByCode = new Map<string, { id: string; discipline_id: string }>();
  for (const r of subRows.rows) {
    if (r.code) subtypeByCode.set(r.code.toUpperCase(), { id: r.id, discipline_id: r.discipline_id });
  }

    for (const fam of tpl.question_families) {
    const evidence = await findEvidence(sourceIds, fam.evidence_signals || [], corpusPool, moduleCode);
    if (!evidence) continue; // evidence-gated

    // Determine a subtype to propose from allowed anchors
    const subtypeAllow = fam.anchors?.discipline_subtype_codes_allow || [];
    let subtypeCode: string | null = null;
    if (subtypeAllow.length > 0) {
      // Find first valid subtype code
      for (const code of subtypeAllow) {
        if (subtypeByCode.has(code.toUpperCase())) {
          subtypeCode = code.toUpperCase();
          break;
        }
      }
    }

    for (const q of fam.question_prompts) {
      const qc = validateExistenceQuestion(q);
      if (!qc.ok) continue;

      const key = `${fam.family_code}::${hashKey(q)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        family_code: fam.family_code,
        question: q,
        discipline_subtype_code: subtypeCode,
        evidence,
        rationale: clip(evidence.excerpt, 160)
      });

      if (out.filter(x => x.family_code === fam.family_code).length >= tpl.generation_rules.min_questions_per_family) {
        break;
      }
    }
  }

  return { template: tpl, suggestions: out };
}
