/**
 * GET: comprehension summary (metrics + sample chunks) for a module.
 * POST: generate LLM synopsis from comprehension rows (diagnostic only; does not alter standards).
 */

import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getOllamaUrl } from "@/app/lib/config/ollama";
import { getGeneralModel } from "@/app/lib/ollama/model_router";

const SAMPLE_CHUNKS_LIMIT = 12;
const EXCERPT_LEN = 600;
const OLLAMA_SYNOPSIS_TIMEOUT_MS = 60_000;

function collapseWhitespace(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function excerpt(text: string): string {
  return collapseWhitespace(text).slice(0, EXCERPT_LEN);
}

/** Map generation_priority to numeric bucket for by_priority: 0=other, 1=LOW, 2=MEDIUM, 3=HIGH */
function priorityBucket(p: string | null): number {
  if (p === "HIGH") return 3;
  if (p === "MEDIUM") return 2;
  if (p === "LOW") return 1;
  return 0;
}

type ComprehensionRow = {
  chunk_id: string;
  locator: string;
  generation_priority: string | null;
  supports_question_generation: boolean;
  life_safety_signal: boolean;
  ops_signal: boolean;
  cyber_awareness_signal: boolean;
  primary_domains: unknown;
  secondary_domains: unknown;
  explicit_topics: unknown;
  implied_risks: unknown;
  llm_model: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export type ComprehensionSummaryResponse = {
  module_code: string;
  status: "present" | "missing";
  comprehension_rows: number;
  last_updated_at: string | null;
  model_used_distribution?: Record<string, number>;
  by_priority: { "0": number; "1": number; "2": number; "3": number };
  supports_qg_true: number;
  life_safety_hist: { "0": number; "1": number };
  ops_hist: { "0": number; "1": number };
  cyber_awareness_hist: { "0": number; "1": number };
  top_topics: Array<{ topic: string; count: number }>;
  top_domains: Array<{ domain: string; count: number }>;
  sample_chunks: Array<{
    chunk_id: string;
    locator: string;
    excerpt: string;
    generation_priority: string | null;
    implied_risks: string[];
    explicit_topics: string[];
  }>;
};

const EMPTY_METRICS: Omit<
  ComprehensionSummaryResponse,
  "module_code" | "status" | "comprehension_rows" | "last_updated_at" | "sample_chunks"
> = {
  by_priority: { "0": 0, "1": 0, "2": 0, "3": 0 },
  supports_qg_true: 0,
  life_safety_hist: { "0": 0, "1": 0 },
  ops_hist: { "0": 0, "1": 0 },
  cyber_awareness_hist: { "0": 0, "1": 0 },
  top_topics: [],
  top_domains: [],
};

async function getSummary(moduleCode: string): Promise<ComprehensionSummaryResponse> {
  const runtimePool = getRuntimePool();

  // Metrics are computed directly from DB columns (generation_priority, supports_question_generation, life_safety_signal, ops_signal, cyber_awareness_signal).
  const rowsResult = await runtimePool.query(
    `SELECT
       chunk_id, locator, generation_priority, supports_question_generation,
       life_safety_signal, ops_signal, cyber_awareness_signal,
       primary_domains, secondary_domains, explicit_topics, implied_risks,
       llm_model, updated_at, created_at
     FROM public.module_chunk_comprehension
     WHERE module_code = $1`,
    [moduleCode]
  );
  const rows = (rowsResult.rows ?? []) as ComprehensionRow[];

  if (rows.length === 0) {
    return {
      module_code: moduleCode,
      status: "missing",
      comprehension_rows: 0,
      last_updated_at: null,
      ...EMPTY_METRICS,
      sample_chunks: [],
    };
  }

  const by_priority: { "0": number; "1": number; "2": number; "3": number } = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
  };
  let supports_qg_true = 0;
  const life_safety_hist: { "0": number; "1": number } = { "0": 0, "1": 0 };
  const ops_hist: { "0": number; "1": number } = { "0": 0, "1": 0 };
  const cyber_awareness_hist: { "0": number; "1": number } = { "0": 0, "1": 0 };
  const topicCounts: Record<string, number> = {};
  const domainCounts: Record<string, number> = {};
  const modelCounts: Record<string, number> = {};
  let lastUpdated: string | null = null;

  for (const r of rows) {
    const bucket = priorityBucket(r.generation_priority);
    by_priority[String(bucket) as "0" | "1" | "2" | "3"] =
      (by_priority[String(bucket) as "0" | "1" | "2" | "3"] ?? 0) + 1;
    if (r.supports_question_generation) supports_qg_true++;
    life_safety_hist[r.life_safety_signal ? "1" : "0"]++;
    ops_hist[r.ops_signal ? "1" : "0"]++;
    cyber_awareness_hist[r.cyber_awareness_signal ? "1" : "0"]++;

    const u = r.updated_at ?? r.created_at;
    if (u && (!lastUpdated || u > lastUpdated)) lastUpdated = u;

    const model = r.llm_model ?? "unknown";
    modelCounts[model] = (modelCounts[model] ?? 0) + 1;

    const topics = Array.isArray(r.explicit_topics) ? r.explicit_topics : (r.explicit_topics as string[]) ?? [];
    for (const t of topics) {
      const key = String(t).trim();
      if (key) topicCounts[key] = (topicCounts[key] ?? 0) + 1;
    }
    const prim = Array.isArray(r.primary_domains) ? r.primary_domains : (r.primary_domains as string[]) ?? [];
    const sec = Array.isArray(r.secondary_domains) ? r.secondary_domains : (r.secondary_domains as string[]) ?? [];
    for (const d of [...prim, ...sec]) {
      const key = String(d).trim();
      if (key) domainCounts[key] = (domainCounts[key] ?? 0) + 1;
    }
  }

  const top_topics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([topic, count]) => ({ topic, count }));

  const top_domains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([domain, count]) => ({ domain, count }));

  // Sample chunks: prefer supports_question_generation=true, then by priority desc, life_safety desc, ops desc; take top 12
  const priorityOrder = (p: string | null) => (p === "HIGH" ? 3 : p === "MEDIUM" ? 2 : p === "LOW" ? 1 : 0);
  const sorted = [...rows].sort((a, b) => {
    if (a.supports_question_generation !== b.supports_question_generation)
      return a.supports_question_generation ? -1 : 1;
    const pa = priorityOrder(a.generation_priority);
    const pb = priorityOrder(b.generation_priority);
    if (pa !== pb) return pb - pa;
    if (a.life_safety_signal !== b.life_safety_signal) return a.life_safety_signal ? -1 : 1;
    if (a.ops_signal !== b.ops_signal) return a.ops_signal ? -1 : 1;
    return 0;
  });
  const sampleRows = sorted.slice(0, SAMPLE_CHUNKS_LIMIT);
  const chunkIds = sampleRows.map((r) => r.chunk_id);

  const chunkTexts: Record<string, string> = {};
  if (chunkIds.length > 0) {
    // Prefer RUNTIME module_chunks (comprehension is built from module chunks)
    const runtimeResult = await runtimePool.query(
      `SELECT id::text AS chunk_id, text FROM public.module_chunks WHERE id::text = ANY($1::text[])`,
      [chunkIds]
    );
    for (const row of (runtimeResult.rows ?? []) as Array<{ chunk_id: string; text: string | null }>) {
      if (row.chunk_id != null) chunkTexts[row.chunk_id] = row.text ?? "";
    }
    // Fill any missing from CORPUS (legacy comprehension from CORPUS document_chunks)
    const missingIds = chunkIds.filter((id) => !chunkTexts[id]);
    if (missingIds.length > 0) {
      try {
        const corpusPool = getCorpusPool();
        const corpusResult = await corpusPool.query(
          `SELECT chunk_id::text AS chunk_id, chunk_text AS text FROM public.document_chunks WHERE chunk_id::text = ANY($1::text[])`,
          [missingIds]
        );
        for (const row of (corpusResult.rows ?? []) as Array<{ chunk_id: string; text: string | null }>) {
          if (row.chunk_id != null) chunkTexts[row.chunk_id] = row.text ?? "";
        }
      } catch {
        // CORPUS may be unavailable
      }
    }
  }

  const sample_chunks = sampleRows.map((r) => {
    const text = chunkTexts[r.chunk_id] ?? "";
    const implied_risks = Array.isArray(r.implied_risks) ? (r.implied_risks as string[]) : [];
    const explicit_topics = Array.isArray(r.explicit_topics) ? (r.explicit_topics as string[]) : [];
    return {
      chunk_id: r.chunk_id,
      locator: r.locator,
      excerpt: excerpt(text),
      generation_priority: r.generation_priority,
      implied_risks,
      explicit_topics,
    };
  });

  return {
    module_code: moduleCode,
    status: "present",
    comprehension_rows: rows.length,
    last_updated_at: lastUpdated,
    model_used_distribution: modelCounts,
    by_priority,
    supports_qg_true,
    life_safety_hist,
    ops_hist,
    cyber_awareness_hist,
    top_topics,
    top_domains,
    sample_chunks,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await params;
    if (!moduleCode) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }
    const summary = await getSummary(moduleCode);
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[comprehension/summary] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST body for synopsis generation */
type _SynopsisBody = { refresh?: boolean };

const SYNOPSIS_SYSTEM_PROMPT = `You are writing a brief diagnostic synopsis for a physical security assessment module. Scope: physical security, governance, planning, and operations only (PSA).

Output exactly two parts in plain text (no markdown headers):
1) One short paragraph (2-4 sentences) summarizing what the module's evidence supports: themes, risks, and domains (life safety, operations, physical security). Be concrete but concise.
2) Exactly 5 bullet points as "Key takeaways:" — one line each. No numbering.

Rules:
- PSA scope only. No regulatory language, no implementation HOW, no costs or timelines.
- No cadence/frequency details. No cyber/IT configuration or technical controls.
- Use only information present in the evidence pack provided. Do not invent.`;

async function generateSynopsis(moduleCode: string): Promise<{
  synopsis: string | null;
  error?: string;
  model?: string;
}> {
  const summary = await getSummary(moduleCode);
  if (summary.comprehension_rows === 0) {
    return { synopsis: null, error: "NO_COMPREHENSION_ROWS" };
  }

  const evidence: string[] = [];
  evidence.push(`Module: ${moduleCode}. Comprehension rows: ${summary.comprehension_rows}.`);
  evidence.push(`Top domains: ${summary.top_domains.map((d) => d.domain).join(", ") || "—"}`);
  evidence.push(`Top topics: ${summary.top_topics.map((t) => t.topic).join(", ") || "—"}`);
  evidence.push(
    `Signals: life_safety true=${summary.life_safety_hist["1"]}, ops true=${summary.ops_hist["1"]}, supports_question_generation=${summary.supports_qg_true}.`
  );
  for (let i = 0; i < Math.min(5, summary.sample_chunks.length); i++) {
    const c = summary.sample_chunks[i];
    evidence.push(`[Chunk ${i + 1}] ${c.locator} | priority=${c.generation_priority} | topics: ${(c.explicit_topics ?? []).join(", ")} | risks: ${(c.implied_risks ?? []).join(", ")}. Excerpt: ${c.excerpt.slice(0, 300)}...`);
  }

  const userContent = `Evidence pack for synopsis:\n\n${evidence.join("\n\n")}`;

  const model = getGeneralModel();
  const base = getOllamaUrl().replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYNOPSIS_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        stream: false,
        options: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(OLLAMA_SYNOPSIS_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { synopsis: null, error: `Ollama ${res.status}: ${text.slice(0, 200)}`, model };
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const synopsis = (data.message?.content ?? "").trim();
    return { synopsis: synopsis || null, model };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { synopsis: null, error: message, model };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await params;
    if (!moduleCode) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }
    try {
      const raw = await req.json();
      if (raw && typeof raw === "object") {
        void Boolean(raw.refresh);
      }
    } catch {
      // no body is ok
    }

    const result = await generateSynopsis(moduleCode);
    return NextResponse.json({
      synopsis: result.synopsis,
      error: result.error,
      model: result.model,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[comprehension/summary] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
