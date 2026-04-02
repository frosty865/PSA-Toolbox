/**
 * Automated Module Draft Builder
 *
 * Builds draft title, summary, and suggested question stubs from selected sources.
 * DOCUMENTS ARE EVIDENCE ONLY. No OFC derivation. No writes to module_ofcs,
 * ofc_candidate_queue, or ofc_library*. This module is READ-ONLY; the API performs
 * all inserts into module_drafts, module_draft_sources, module_draft_questions.
 */

import type { Pool } from "pg";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export type BuildMode = "LIGHT" | "DEEP";

export interface SourceInfo {
  id: string;
  source_key: string;
  title: string | null;
  canonical_url: string | null;
}

export interface DraftQuestionStub {
  question_text: string;
  discipline_id: string;
  discipline_subtype_id: string | null;
  confidence: number | null;
  rationale: string | null;
}

export interface BuildResult {
  title: string;
  summary: string | null;
  questions: DraftQuestionStub[];
}

/** Guard: builder must never write to module_ofcs, ofc_candidate_queue, ofc_library*. This function only reads. */
export async function buildDraftFromSources(
  sourceIds: string[],
  mode: BuildMode,
  titleHint: string | null,
  corpusPool?: Pool,
  runtimePool?: Pool
): Promise<BuildResult> {
  const corpus = corpusPool ?? getCorpusPool();
  const runtime = runtimePool ?? getRuntimePool();

  if (!sourceIds?.length) {
    return { title: titleHint || "Module Draft", summary: null, questions: [] };
  }

  // 1) Resolve sources: id::text or source_key
  const sr = await corpus.query<{ id: string; source_key: string; title: string | null; canonical_url: string | null }>(
    `SELECT id::text as id, source_key, title, canonical_url
     FROM public.source_registry
     WHERE id::text = ANY($1::text[]) OR source_key = ANY($1::text[])`,
    [sourceIds]
  );
  const sources = sr.rows as SourceInfo[];
  if (sources.length === 0) {
    return { title: titleHint || "Module Draft", summary: null, questions: [] };
  }

  const ids = sources.map((s) => s.id);

  // 2) Title and summary
  const first = sources[0];
  const title = (titleHint && titleHint.trim()) || first.title || first.source_key || "Module Draft";
  const summary =
    "Draft from sources: " +
    sources
      .map((s) => s.title || s.source_key)
      .filter(Boolean)
      .join("; ");

  // 3) Load subtype taxonomy from RUNTIME (id, discipline_id, name, code, overview)
  let stCol = "ds.id, ds.discipline_id, ds.name, ds.code";
  try {
    const cc = await runtime.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='discipline_subtypes' AND column_name='overview'`
    );
    if (cc.rows.length) stCol += ", ds.overview";
  } catch {
    /* ignore */
  }
  const st = await runtime.query(
    `SELECT ${stCol} FROM public.discipline_subtypes ds WHERE ds.is_active = true ORDER BY ds.discipline_id, ds.name`
  );

  type SubtypeRow = { id: string; discipline_id: string; name: string; code: string; overview?: string };
  const subtypes = st.rows as SubtypeRow[];

  function subtypeTerms(s: SubtypeRow): string[] {
    const parts = [s.name, s.code].filter(Boolean);
    const o = (s.overview || "").slice(0, 200);
    const words = o.split(/\s+/).filter((w) => w.length > 2);
    const seen = new Set(parts.map((p) => p.toLowerCase()));
    for (const w of words) {
      const t = w.replace(/\W/g, "").toLowerCase();
      if (t && !seen.has(t)) {
        seen.add(t);
        parts.push(t);
      }
    }
    return parts;
  }

  if (mode === "LIGHT") {
    const questions: DraftQuestionStub[] = [];
    for (let i = 0; i < Math.min(10, subtypes.length); i++) {
      const s = subtypes[i];
      questions.push({
        question_text: `${s.name}: assign asset or location and event trigger, then phrase the question.`,
        discipline_id: s.discipline_id,
        discipline_subtype_id: s.id,
        confidence: 0.5,
        rationale: "Draft from source metadata (LIGHT mode). Review and assign asset/event.",
      });
    }
    return { title, summary, questions };
  }

  // DEEP: use chunks
  const docRes = await corpus.query<{ id: string }>(
    `SELECT id::text as id FROM public.corpus_documents WHERE source_registry_id IN (SELECT unnest($1::text[])::uuid)`,
    [ids]
  );
  const docIds = docRes.rows.map((r) => r.id);
  if (docIds.length === 0) {
    // No documents: fallback to LIGHT-like
    const questions: DraftQuestionStub[] = [];
    for (let i = 0; i < Math.min(10, subtypes.length); i++) {
      const s = subtypes[i];
      questions.push({
        question_text: `${s.name}: assign asset or location and event trigger, then phrase the question.`,
        discipline_id: s.discipline_id,
        discipline_subtype_id: s.id,
        confidence: 0.4,
        rationale: "No chunks for DEEP; draft from metadata. Add scope and asset/event.",
      });
    }
    return { title, summary, questions };
  }

  const chunksRes = await corpus.query<{ chunk_id: string; document_id: string; chunk_text: string }>(
    `SELECT chunk_id::text as chunk_id, document_id::text as document_id, chunk_text
     FROM public.document_chunks
     WHERE document_id IN (SELECT unnest($1::text[])::uuid)
     LIMIT 500`,
    [docIds]
  );
  const chunks = chunksRes.rows;

  const questions: DraftQuestionStub[] = [];
  const subtypeScores: { subtype: SubtypeRow; chunk: { chunk_text: string }; score: number }[] = [];

  for (const ch of chunks) {
    const text = (ch.chunk_text || "").toLowerCase();
    if (!text || text.length < 20) continue;
    let best: { subtype: SubtypeRow; score: number } | null = null;
    for (const s of subtypes) {
      const terms = subtypeTerms(s);
      let score = 0;
      for (const t of terms) {
        if (t.length < 3) continue;
        if (text.includes(t.toLowerCase())) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) best = { subtype: s, score };
    }
    if (best) subtypeScores.push({ subtype: best.subtype, chunk: { chunk_text: ch.chunk_text }, score: best.score });
  }

  // Group by subtype, take up to 2 chunks per subtype, cap 30 total
  const bySubtype = new Map<string, typeof subtypeScores>();
  for (const item of subtypeScores) {
    const k = item.subtype.id;
    if (!bySubtype.has(k)) bySubtype.set(k, []);
    bySubtype.get(k)!.push(item);
  }

   
  for (const [_stId, items] of bySubtype.entries()) {
    const s = items[0].subtype;
    for (const it of items.slice(0, 2)) {
      if (questions.length >= 30) break;
      const phrase = it.chunk.chunk_text.replace(/\s+/g, " ").trim().slice(0, 80);
      const short = phrase.split(/\s+/).slice(0, 8).join(" ");
      questions.push({
        question_text: `Is/Are ${s.name} present for ${short}?`,
        discipline_id: s.discipline_id,
        discipline_subtype_id: s.id,
        confidence: Math.min(0.95, 0.5 + it.score * 0.1),
        rationale: "Suggested from: " + it.chunk.chunk_text.slice(0, 100).replace(/\s+/g, " ") + (it.chunk.chunk_text.length > 100 ? "…" : ""),
      });
    }
  }

  if (questions.length === 0 && subtypes.length > 0) {
    for (let i = 0; i < Math.min(5, subtypes.length); i++) {
      const s = subtypes[i];
      questions.push({
        question_text: `${s.name}: assign asset or location and event trigger, then phrase the question.`,
        discipline_id: s.discipline_id,
        discipline_subtype_id: s.id,
        confidence: 0.4,
        rationale: "No strong chunk match; add from sources as needed.",
      });
    }
  }

  return { title, summary, questions: questions.slice(0, 30) };
}
