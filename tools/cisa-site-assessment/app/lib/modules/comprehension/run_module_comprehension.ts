/**
 * TS-native module chunk comprehension: ensure module_chunk_comprehension has rows for a module.
 * Runs synchronously; idempotent UPSERT. Used when REQUIRE_MODULE_COMPREHENSION=1 before standard generation.
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { getOllamaUrl } from "@/app/lib/config/ollama";
import { getComprehensionModel } from "@/app/lib/ollama/model_router";
import { parseJsonWithExtraction } from "@/app/lib/llm/parse_json_strict";

const DEFAULT_MAX_CHUNKS = 160;
const DEFAULT_MIN_CHUNK_LEN = 400;
const OLLAMA_TIMEOUT_MS = 120_000;

const CYBER_TECHNICAL_FORBIDDEN = [
  "segmentation",
  "firewall",
  "ids",
  "ips",
  "siem",
  "encryption",
  "tls",
  "certificate",
  "firmware",
  "patch",
  "ocpp",
  "protocol",
  "api",
  "oauth",
  "credential",
  "network architecture",
  "zero trust",
];

function getSystemPrompt(): string {
  const p = path.join(process.cwd(), "app", "lib", "modules", "comprehension", "COMPREHENSION_SYSTEM_PROMPT.txt");
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  return `You are performing a COMPREHENSION PASS for a PSA physical security assessment module.
Your job is to interpret what the chunk SUPPORTS and to label it in a structured way.
DOMAINS (use only): LIFE_SAFETY, OPERATIONS, PHYSICAL_SECURITY, USER_SAFETY, CYBER_AWARENESS.
Return JSON only: primary_domains, secondary_domains, explicit_topics, implied_risks, site_observable, supports_question_generation, generation_priority (HIGH|MEDIUM|LOW), life_safety_signal, ops_signal, cyber_awareness_signal, confidence. No prose.`;
}

export interface EnsureModuleComprehensionOpts {
  moduleCode: string;
  model: string;
  maxChunks?: number;
  minChunkLen?: number;
  runtimeDb: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  /** Optional; not used when loading from RUNTIME module_chunks (chunks come from module_documents + module_chunks). */
  corpusDb?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
}

export interface ComprehensionOut {
  primary_domains: string[];
  secondary_domains: string[];
  explicit_topics: string[];
  implied_risks: string[];
  site_observable: boolean;
  supports_question_generation: boolean;
  generation_priority: string;
  life_safety_signal: boolean;
  ops_signal: boolean;
  cyber_awareness_signal: boolean;
  confidence?: number;
}

const DEBUG_COMPREHENSION = process.env.DEBUG_MODULE_COMPREHENSION === "1";

function containsAny(text: string, terms: string[]): string | null {
  const t = (text ?? "").toLowerCase();
  for (const term of terms) {
    if (t.includes(term)) return term;
  }
  return null;
}

/** Heuristic: chunk text suggests actionable content (markers like "ensure", "coordinate"). */
function hasMarker(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  const markers = [
    "consider the following",
    "ensure",
    "identify",
    "determine",
    "establish",
    "coordinate",
    "designate",
  ];
  return markers.some((m) => t.includes(m));
}

/** Heuristic: chunk has list/bullet structure. */
function hasBullets(text: string): boolean {
  const t = text ?? "";
  return (
    t.includes("●") ||
    t.includes("•") ||
    /\n-\s/.test(t) ||
    /\n■\s/.test(t) ||
    /\n1\.\s/.test(t)
  );
}

/** Heuristic: chunk looks like a template or example. */
function hasTemplate(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  return t.includes("example") || t.includes("template");
}

/** Heuristic: ops-related terms (coordination, roles, recovery). */
function hasOpsSignalText(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  const terms = [
    "coordination",
    "coordinate",
    "roles",
    "communications",
    "accountability",
    "recovery",
    "procedure",
    "procedures",
    "exercise",
    "drill",
    "designate",
    "assign",
  ];
  return terms.some((m) => t.includes(m));
}

/** Heuristic: life-safety terms (evacuation, lockdown, first aid). */
function hasLifeSafetySignalText(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  const terms = [
    "evacuation",
    "evacuate",
    "lockdown",
    "shelter",
    "active assailant",
    "first aid",
    "emergency response",
    "life safety",
  ];
  return terms.some((m) => t.includes(m));
}

/** Heuristic: cyber awareness only (phishing, scams, fraud). */
function hasCyberAwarenessSignalText(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  const terms = ["scam", "scams", "phishing", "fraud", "qr-code", "social engineering", "impersonation"];
  return terms.some((m) => t.includes(m));
}

/** Coerce value to boolean: accept boolean; number >= 2 or "true"/"yes" => true. */
function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number" && !Number.isNaN(v)) return v >= 2;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

/** Coerce to generation_priority text. Accept "HIGH"|"MEDIUM"|"LOW"; int 0..3 => LOW/MEDIUM/HIGH. */
function toGenerationPriority(v: unknown): "LOW" | "MEDIUM" | "HIGH" {
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  if (typeof v === "string") {
    const u = (v as string).trim().toUpperCase();
    if (u === "HIGH" || u === "MEDIUM" || u === "LOW") return u as "LOW" | "MEDIUM" | "HIGH";
  }
  if (typeof v === "number" && !Number.isNaN(v)) {
    if (v >= 3) return "HIGH";
    if (v >= 2) return "MEDIUM";
    return "LOW";
  }
  return "LOW";
}

export type NormalizedComprehensionRecord = {
  primary_domains: string;
  secondary_domains: string;
  explicit_topics: string;
  implied_risks: string;
  site_observable: boolean;
  supports_question_generation: boolean;
  generation_priority: string;
  life_safety_signal: boolean;
  ops_signal: boolean;
  cyber_awareness_signal: boolean;
  llm_confidence: number | null;
  comprehension_error: string | null;
};

/**
 * Normalize and validate LLM output. Coerces types; sets comprehension_error on validation issues
 * without wiping other valid fields. Applies deterministic heuristics when model output is
 * missing or obviously wrong (e.g. all LOW/false for bullet/procedure chunks).
 * @param parseError - When set (e.g. parse threw), record gets heuristic-based values and this error is stored.
 */
function normalizeComprehensionOut(
  out: unknown,
  chunkText: string,
  parseError?: string
): NormalizedComprehensionRecord {
  const o = out && typeof out === "object" ? (out as Record<string, unknown>) : {};
  const errors: string[] = [];
  const jsonArr = (v: unknown): string => {
    if (Array.isArray(v)) return JSON.stringify(v);
    if (v != null && typeof v === "object") return JSON.stringify(Array.isArray(v) ? v : []);
    return "[]";
  };

  const primary_domains = jsonArr(o.primary_domains);
  const secondary_domains = jsonArr(o.secondary_domains);
  const explicit_topics = jsonArr(o.explicit_topics);
  const implied_risks = jsonArr(o.implied_risks);
  const site_observable = toBoolean(o.site_observable);
  let supports_question_generation = toBoolean(o.supports_question_generation);
  let generation_priority = toGenerationPriority(o.generation_priority);
  let life_safety_signal = toBoolean(o.life_safety_signal);
  let ops_signal = toBoolean(o.ops_signal);
  let cyber_awareness_signal = toBoolean(o.cyber_awareness_signal);
  const llm_confidence: number | null =
    typeof o.confidence === "number" && !Number.isNaN(o.confidence) ? o.confidence : null;

  // Deterministic heuristics from chunk text (fallback when model is conservative or missing)
  const heurMarker = hasMarker(chunkText);
  const heurBullets = hasBullets(chunkText);
  const heurTemplate = hasTemplate(chunkText);
  const heurOps = hasOpsSignalText(chunkText);
  const heurLife = hasLifeSafetySignalText(chunkText);
  const heurCyber = hasCyberAwarenessSignalText(chunkText);

  const actionable = heurMarker || heurBullets || heurTemplate;
  if (actionable) {
    if (!supports_question_generation) {
      supports_question_generation = true;
      errors.push("supports_question_generation raised by heuristic (marker/bullets/template)");
    }
    const wantPriority = heurMarker && heurBullets ? 3 : 2;
    const currentOrder = generation_priority === "HIGH" ? 3 : generation_priority === "MEDIUM" ? 2 : 1;
    if (wantPriority > currentOrder) {
      generation_priority = wantPriority === 3 ? "HIGH" : "MEDIUM";
      errors.push(`generation_priority raised by heuristic to ${generation_priority}`);
    }
  }
  if (heurOps && !ops_signal) {
    ops_signal = true;
    errors.push("ops_signal raised by heuristic (coordination/procedures/recovery terms)");
  }
  if (heurLife && !life_safety_signal) {
    life_safety_signal = true;
    errors.push("life_safety_signal raised by heuristic (evacuation/lockdown/first aid terms)");
  }
  if (heurCyber && !cyber_awareness_signal) {
    cyber_awareness_signal = true;
    errors.push("cyber_awareness_signal raised by heuristic (phishing/scams/fraud terms)");
  }

  let comprehension_error: string | null =
    errors.length > 0 ? `VALIDATION_HEURISTIC: ${errors.join("; ")}` : null;
  if (parseError) {
    comprehension_error = parseError.length > 500 ? parseError.slice(0, 500) : parseError;
  }
  return {
    primary_domains,
    secondary_domains,
    explicit_topics,
    implied_risks,
    site_observable,
    supports_question_generation,
    generation_priority,
    life_safety_signal,
    ops_signal,
    cyber_awareness_signal,
    llm_confidence,
    comprehension_error,
  };
}

async function ollamaChatJson(
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const base = getOllamaUrl().replace(/\/+$/, "");
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return (data.message?.content ?? "").trim();
}

/** Sentinel UUID when module document has no CORPUS source_registry link. */
const NO_CORPUS_SOURCE_REGISTRY_ID = "00000000-0000-0000-0000-000000000000";

export type EnsureModuleComprehensionResult = {
  status: "present" | "created";
  rows: number;
  /** Set when status === "created". */
  effective_model?: string;
  llm_run_id?: string;
};

/**
 * Ensure module_chunk_comprehension has rows for the module. If already present, return immediately.
 * If 0 rows: load chunks from RUNTIME (module_chunks), run comprehension per chunk, UPSERT into RUNTIME, then return.
 * Model: opts.model when provided, else OLLAMA_COMPREHENSION_MODEL via getComprehensionModel() — never hardcoded default in runner.
 */
export async function ensureModuleComprehension(
  opts: EnsureModuleComprehensionOpts
): Promise<EnsureModuleComprehensionResult> {
  const {
    moduleCode,
    model: optsModel,
    maxChunks = DEFAULT_MAX_CHUNKS,
    minChunkLen = DEFAULT_MIN_CHUNK_LEN,
    runtimeDb,
  } = opts;

  const effectiveModel = (optsModel?.trim() || getComprehensionModel()).trim() || "llama3.1:8b-instruct";
  if (process.env.DEBUG_MODULE_COMPREHENSION === "1") {
    console.log("[comprehension] effectiveModel=", effectiveModel);
    console.log("[comprehension] env.OLLAMA_COMPREHENSION_MODEL=", process.env.OLLAMA_COMPREHENSION_MODEL ?? "(not set)");
  }

  const countResult = await runtimeDb.query(
    `SELECT COUNT(*)::int AS n FROM public.module_chunk_comprehension WHERE module_code = $1`,
    [moduleCode]
  );
  const existing = (countResult.rows[0] as { n: number } | undefined)?.n ?? 0;
  if (existing > 0) {
    return { status: "present", rows: existing };
  }

  const llm_run_id = randomUUID();

  const chunkRows = await runtimeDb.query(
    `SELECT
       mc.id AS chunk_id,
       md.id AS doc_id,
       mc.text AS content,
       COALESCE(link.source_registry_id::text, $4) AS source_registry_id,
       COALESCE(
         CASE
           WHEN mc.locator IS NOT NULL AND jsonb_typeof(mc.locator) = 'object' THEN
             CASE
               WHEN mc.locator->>'page_start' IS NOT NULL AND mc.locator->>'page_end' IS NOT NULL THEN 'p.' || (mc.locator->>'page_start') || '-' || (mc.locator->>'page_end')
               WHEN mc.locator->>'page' IS NOT NULL THEN 'p.' || (mc.locator->>'page')
               ELSE ''
             END
           ELSE ''
         END,
         ''
       ) AS locator
     FROM public.module_chunks mc
     JOIN public.module_documents md ON md.id = mc.module_document_id
     LEFT JOIN public.module_doc_source_link link
       ON link.module_code ILIKE md.module_code AND link.doc_sha256 = md.sha256
     WHERE md.module_code ILIKE $1
       AND md.status IN ('INGESTED', 'DOWNLOADED')
       AND length(mc.text) >= $2
     ORDER BY mc.id
     LIMIT $3`,
    [moduleCode, minChunkLen, maxChunks, NO_CORPUS_SOURCE_REGISTRY_ID]
  );
  const chunks = chunkRows.rows as Array<{
    chunk_id: string;
    doc_id: string;
    content: string;
    source_registry_id: string;
    locator: string;
  }>;

  if (chunks.length === 0) {
    throw new Error(
      "Comprehension: 0 chunks loaded. Ensure the module has ingested sources (Sources tab: process PDFs so RUNTIME has module_documents and module_chunks with length >= " +
        String(minChunkLen) +
        " chars)."
    );
  }

  const systemPrompt = getSystemPrompt();
  const runId = llm_run_id;
  const _packetsBuilt = chunks.length;
  void _packetsBuilt;
  let firstChunkLogged = false;

  for (const ch of chunks) {
    const userContent = JSON.stringify({
      module_code: moduleCode,
      chunk: {
        chunk_id: ch.chunk_id,
        doc_id: ch.doc_id,
        source_registry_id: ch.source_registry_id,
        locator: ch.locator,
        text: ch.content,
      },
    });

    let rawModelText: string | null = null;
    let parsedJson: unknown = null;
    let normalized_record: NormalizedComprehensionRecord;

    try {
      const raw = await ollamaChatJson(effectiveModel, systemPrompt, userContent);
      rawModelText = raw;
      const out = parseJsonWithExtraction<ComprehensionOut>(raw);
      parsedJson = out;
      normalized_record = normalizeComprehensionOut(out, ch.content);

      const joined = [
        ...(out.primary_domains ?? []),
        ...(out.secondary_domains ?? []),
        ...(out.explicit_topics ?? []),
        ...(out.implied_risks ?? []),
      ].join("\n");
      const bad = containsAny(joined, CYBER_TECHNICAL_FORBIDDEN);
      if (bad) {
        normalized_record = { ...normalized_record, comprehension_error: "cyber_blocked" };
      }
    } catch (e) {
      const parseErr = e instanceof Error ? e.message : String(e);
      normalized_record = normalizeComprehensionOut({}, ch.content, parseErr);
    }

    if (DEBUG_COMPREHENSION && !firstChunkLogged) {
      firstChunkLogged = true;
      console.log("[DEBUG_MODULE_COMPREHENSION] === first chunk only ===");
      console.log("[DEBUG_MODULE_COMPREHENSION] raw_model_text (first 800):", (rawModelText ?? "").slice(0, 800));
      console.log("[DEBUG_MODULE_COMPREHENSION] parsed_json:", JSON.stringify(parsedJson));
      console.log("[DEBUG_MODULE_COMPREHENSION] normalized_record:", JSON.stringify(normalized_record, null, 2));
      console.log("[DEBUG_MODULE_COMPREHENSION] comprehension_error:", normalized_record.comprehension_error ?? "(none)");
      console.log("[DEBUG_MODULE_COMPREHENSION] === end first chunk ===");
    }

    await runtimeDb.query(
      `INSERT INTO public.module_chunk_comprehension (
        module_code, source_registry_id, doc_id, chunk_id, locator,
        primary_domains, secondary_domains, explicit_topics, implied_risks,
        site_observable, supports_question_generation, generation_priority,
        life_safety_signal, ops_signal, cyber_awareness_signal,
        llm_model, llm_run_id, llm_confidence, comprehension_error
      ) VALUES (
        $1, $2::uuid, $3::uuid, $4::uuid, $5,
        $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19
      )
      ON CONFLICT (module_code, chunk_id)
      DO UPDATE SET
        source_registry_id = EXCLUDED.source_registry_id,
        doc_id = EXCLUDED.doc_id,
        locator = EXCLUDED.locator,
        primary_domains = EXCLUDED.primary_domains,
        secondary_domains = EXCLUDED.secondary_domains,
        explicit_topics = EXCLUDED.explicit_topics,
        implied_risks = EXCLUDED.implied_risks,
        site_observable = EXCLUDED.site_observable,
        supports_question_generation = EXCLUDED.supports_question_generation,
        generation_priority = EXCLUDED.generation_priority,
        life_safety_signal = EXCLUDED.life_safety_signal,
        ops_signal = EXCLUDED.ops_signal,
        cyber_awareness_signal = EXCLUDED.cyber_awareness_signal,
        llm_model = EXCLUDED.llm_model,
        llm_run_id = EXCLUDED.llm_run_id,
        llm_confidence = EXCLUDED.llm_confidence,
        comprehension_error = EXCLUDED.comprehension_error,
        updated_at = now()`,
      [
        moduleCode,
        ch.source_registry_id,
        ch.doc_id,
        ch.chunk_id,
        ch.locator,
        normalized_record.primary_domains,
        normalized_record.secondary_domains,
        normalized_record.explicit_topics,
        normalized_record.implied_risks,
        normalized_record.site_observable,
        normalized_record.supports_question_generation,
        normalized_record.generation_priority,
        normalized_record.life_safety_signal,
        normalized_record.ops_signal,
        normalized_record.cyber_awareness_signal,
        effectiveModel,
        runId,
        normalized_record.llm_confidence,
        normalized_record.comprehension_error,
      ]
    );
  }

  const afterCount = await runtimeDb.query(
    `SELECT COUNT(*)::int AS n FROM public.module_chunk_comprehension WHERE module_code = $1`,
    [moduleCode]
  );
  const newCount = (afterCount.rows[0] as { n: number } | undefined)?.n ?? 0;

  if (newCount === 0) {
    throw new Error(
      "Comprehension: 0 rows after run. Chunks loaded and packets built but persistence failed (check RUNTIME module_chunk_comprehension table and UNIQUE(module_code, chunk_id))."
    );
  }

  return { status: "created", rows: newCount, effective_model: effectiveModel, llm_run_id };
}
