/**
 * Derive plan schema: clean sections (extract_plan_toc) → intent seeds (section_intents) → LLM for ofc/impact only.
 * Observations come from seeds; model supplies only ofc, impact, evidence_terms.
 */

import { getOllamaUrl } from "@/app/lib/config/ollama";
import { getPlanStandardModel } from "@/app/lib/ollama/model_router";
import { extractTocLines, parseTocEntries, groupTocBySection } from "@/app/lib/plans/toc_parser";
import { extractTocNumberedSections } from "@/app/lib/plans/toc_extract";
import { extractFirstJsonValue, parseJsonWithContext } from "@/app/lib/plans/schema/json_extract";
import { extractionDebugInfo } from "@/app/lib/llm/extract_json_value";
import { extractPlanToc, type ExtractedSection, type TocEntry } from "./extract_plan_toc";
import { resolveIntentElements } from "./section_intents";
import { validateDerivedSchema, type DerivedPlanSchemaJson, type DerivedSection } from "./validate_derived_schema";
import type { DerivedPlanSchema } from "./derived_schema_types";

export interface RequirementChunk {
  chunk_text: string;
  source_title: string;
  page_range?: string | null;
  locator?: string | null;
  source_registry_id?: string | null;
}

const OLLAMA_TIMEOUT_MS = 90_000;
const MAX_TEXT_FOR_TOC = 80_000;

function slug(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80) || "element";
}

/**
 * First pass: deterministic TOC/heading structure (legacy fallback when extractPlanToc returns []).
 * Exported for unit tests.
 */
export function extractSectionSkeleton(chunks: RequirementChunk[]): { section_title: string; section_key: string }[] {
  const fullText = chunks
    .map((c) => (c.chunk_text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  if (!fullText) return [];

  const textForToc = fullText.length > MAX_TEXT_FOR_TOC ? fullText.slice(0, MAX_TEXT_FOR_TOC) : fullText;
  const lines = extractTocLines(textForToc);
  if (lines.length > 0) {
    const entries = parseTocEntries(lines);
    const grouped = groupTocBySection(entries);
    if (grouped.sections.length > 0) {
      return grouped.sections.map((s) => ({ section_title: s.title, section_key: slug(s.title) || s.key }));
    }
  }
  const numbered = extractTocNumberedSections(textForToc);
  if (numbered.length > 0) {
    return numbered.map((title, i) => ({ section_title: title, section_key: slug(title) || `section_${i + 1}` }));
  }
  return [];
}

/** LLM response: canonical shape { "items": [ ... ] }; parser also accepts top-level array. */
const OFC_IMPACT_SYSTEM = `Your entire response must be exactly one JSON object in this shape. No explanation, no markdown, no prose.

Return JSON ONLY in this exact shape:
{
  "items": [
    { "element_key": "...", "ofc": "...", "impact": "...", "evidence_terms": ["..."] }
  ]
}

For each input element (element_title and observation), output one object with: element_key, ofc, impact, evidence_terms.
- element_key: lowercase slug with underscores (e.g. evacuation_assembly_point).
- ofc: ONE statement only—what the organization should document or consider. Neutral, advisory. No tiers, cost, timeline, regulatory, or vendor language.
- impact: 1–2 sentences, operational and neutral (why it matters for operations). Max 400 characters.
- evidence_terms: optional array of 3–10 keywords that implementation evidence might use (or null).

Same order as the input list.`;

/** Build user message: flat list of { element_title, observation } for each seed. */
function buildOfcImpactUserMessage(flatSeeds: { element_title: string; observation: string }[]): string {
  const lines = flatSeeds.map((s, i) => `${i + 1}. element_title: ${s.element_title}\n   observation: ${s.observation}`).join("\n\n");
  return `For each of the following elements, output exactly one object with element_key, ofc, impact, and evidence_terms (array or null). Same order.\n\n${lines}\n\nRespond with ONLY a JSON object: { "items": [ ... ] }.`;
}

const DEFAULT_OFC = "Document this element in the plan.";
const DEFAULT_IMPACT = "Clarity supports consistent implementation.";

export async function derivePlanSchema(
  requirementChunks: RequirementChunk[],
  options?: {
    model?: string;
    tocSkeleton?: Array<{ section_title: string; section_key: string }>;
    /** When present with at least one depth-1 entry: sections = depth 1, elements = depth >= 2 under parent; __core fallback when 0 children. */
    tocEntries?: TocEntry[];
  }
): Promise<DerivedPlanSchema> {
  const tocEntries = options?.tocEntries ?? [];
  const sectionEntries = tocEntries.filter((e) => e.depth === 1);

  // TOC-derived path: sections from depth 1, elements from depth >= 2 (vital); __core fallback when 0 children
  if (sectionEntries.length > 0) {
    const mergedSections: DerivedSection[] = [];
    for (const secEntry of sectionEntries) {
      const parentNumber = secEntry.numbering ?? "";
      const section_key = slug(secEntry.title);
      const section_title = secEntry.title;
      const childEntries = tocEntries.filter(
        (e) => e.depth >= 2 && e.numbering != null && e.numbering.startsWith(parentNumber + ".")
      );
      const elements: DerivedSection["elements"] = [];
      for (const child of childEntries) {
        const childTitle = child.title;
        const element_key = slug(parentNumber + "_" + childTitle);
        elements.push({
          element_title: childTitle,
          element_key: element_key || slug(childTitle),
          observation: `${childTitle} is not documented.`,
          ofc: DEFAULT_OFC,
          impact: DEFAULT_IMPACT,
          is_vital: true,
        });
      }
      if (elements.length === 0) {
        elements.push({
          element_title: `Core documentation for ${section_title}`,
          element_key: section_key + "__core",
          observation: "Core documentation for this section is not documented.",
          ofc: DEFAULT_OFC,
          impact: DEFAULT_IMPACT,
          is_vital: true,
        });
      }
      mergedSections.push({ section_title, section_key, elements });
    }
    const schemaResult: DerivedPlanSchema = { sections: mergedSections };
    const elementsTotal = schemaResult.sections.reduce((sum, s) => sum + s.elements.length, 0);
    if (elementsTotal === 0) {
      throw new Error("Derived elementsTotal=0. This is a hard failure. Do not persist.");
    }
    validateDerivedSchema(schemaResult as DerivedPlanSchemaJson);
    return schemaResult;
  }

  // C1) Clean sections: prefer passed tocSkeleton, else extractPlanToc, else legacy skeleton
  let sections: ExtractedSection[];
  if (options?.tocSkeleton?.length) {
    sections = options.tocSkeleton.map((s) => ({
      section_title: s.section_title,
      section_key: s.section_key,
      confidence: "TOC" as const,
    }));
  } else {
    const fromToc = extractPlanToc(requirementChunks.map((c) => c.chunk_text ?? ""));
    if (fromToc.length > 0) {
      sections = fromToc;
    } else {
      const legacy = extractSectionSkeleton(requirementChunks);
      if (legacy.length === 0) {
        throw new Error(
          "PLAN_DERIVE_NO_SECTIONS: No TOC or numbered sections found in requirement chunks. Ensure template/guide contains a Table of Contents or numbered headings (1. ... 12.)."
        );
      }
      sections = legacy.map((s) => ({ ...s, confidence: "NUMBERED" as const }));
    }
  }
  if (sections.length === 0) {
    throw new Error("No sections extracted. Check sources or extractor rules.");
  }

  // C2) Intent seeds per section (guarantees at least one element per section)
  const sectionSeeds: { section: ExtractedSection; seeds: { element_title: string; observation: string }[] }[] = [];
  const flatSeeds: { element_title: string; observation: string }[] = [];
  for (const sec of sections) {
    const seeds = resolveIntentElements(sec.section_title);
    if (seeds.length === 0) {
      throw new Error(`Intent resolver returned 0 seeds for section "${sec.section_title}" (BUG).`);
    }
    sectionSeeds.push({ section: sec, seeds });
    for (const s of seeds) flatSeeds.push({ element_title: s.element_title, observation: s.observation });
  }

  // LLM: only ofc, impact, evidence_terms (observations from seeds)
  const model = options?.model ?? getPlanStandardModel();
  const ollamaUrl = getOllamaUrl().replace(/\/+$/, "");
  const userMessage = buildOfcImpactUserMessage(flatSeeds);

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: OFC_IMPACT_SYSTEM },
        { role: "user", content: userMessage },
      ],
      stream: false,
      options: { temperature: 0, num_predict: 4000 },
    }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama plan schema derivation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const rawContent = (data.message?.content ?? "").trim();

  type LlmEntry = { element_key?: string; ofc?: string; impact?: string; evidence_terms?: string[] | null };
  const raw = rawContent ?? "";
  const trimmed = raw.trim();
  if (!trimmed) {
    const err = new Error("PLAN_DERIVE_JSON_FAILED: Empty model output") as Error & { debug?: ReturnType<typeof extractionDebugInfo> };
    err.debug = extractionDebugInfo(raw);
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.log("[derive_plan_schema] parsed JSON via direct JSON.parse (fast path)");
    }
  } catch {
    let jsonText: string;
    try {
      const extracted = extractFirstJsonValue(trimmed);
      jsonText = extracted.jsonText;
    } catch (_extractErr) {
      const debugObj = extractionDebugInfo(trimmed);
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.error("[derive_plan_schema] JSON extraction failed. Debug:", debugObj);
      }
      const err = new Error("PLAN_DERIVE_JSON_FAILED: No JSON object or array found in model output") as Error & { debug?: typeof debugObj };
      err.debug = debugObj;
      throw err;
    }
    const parseResult = parseJsonWithContext<unknown>(jsonText);
    if (!parseResult.ok) {
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.error("[derive_plan_schema] JSON.parse failed.", parseResult.debug);
      }
      const err = new Error("PLAN_DERIVE_JSON_FAILED: Extracted JSON could not be parsed") as Error & { debug?: Record<string, unknown> };
      err.debug = parseResult.debug;
      throw err;
    }
    parsed = parseResult.value;
  }

  let items: LlmEntry[];
  const parsedShape = parsed as LlmEntry[] | { items?: LlmEntry[]; elements?: LlmEntry[] } | LlmEntry;
  if (Array.isArray(parsedShape)) {
    items = parsedShape;
  } else if (parsedShape && typeof parsedShape === "object" && "items" in parsedShape && Array.isArray((parsedShape as { items: LlmEntry[] }).items)) {
    items = (parsedShape as { items: LlmEntry[] }).items;
  } else if (parsedShape && typeof parsedShape === "object" && "elements" in parsedShape && Array.isArray((parsedShape as { elements: LlmEntry[] }).elements)) {
    items = (parsedShape as { elements: LlmEntry[] }).elements;
  } else if (parsedShape && typeof parsedShape === "object" && parsedShape !== null && !Array.isArray(parsedShape)) {
    items = [parsedShape as LlmEntry];
  } else {
    const debug = extractionDebugInfo(trimmed);
    const err = new Error(
      "PLAN_DERIVE_JSON_FAILED: PLAN_DERIVE_SCHEMA_SHAPE_INVALID (expected array or object with items/elements)"
    ) as Error & { debug?: typeof debug };
    err.debug = debug;
    throw err;
  }
  const parsedList: LlmEntry[] = items;

  // C3) Build DerivedPlanSchema: observation from seed; ofc/impact/evidence_terms from model (same order); is_vital true for plans
  let idx = 0;
  const mergedSections: DerivedSection[] = [];
  for (const { section, seeds } of sectionSeeds) {
    const elements: DerivedSection["elements"] = [];
    for (const seed of seeds) {
      const llm = parsedList[idx] ?? {};
      const element_key = slug(llm.element_key || `${section.section_key}-${seed.element_title}`);
      const rawTerms = llm.evidence_terms;
      const evidence_terms =
        rawTerms == null ? undefined : Array.isArray(rawTerms) ? rawTerms.filter((t) => typeof t === "string").slice(0, 10) : undefined;
      elements.push({
        element_title: seed.element_title,
        element_key: element_key || slug(seed.element_title),
        observation: seed.observation,
        ofc: (llm.ofc ?? "").trim() || DEFAULT_OFC,
        impact: (llm.impact ?? "").trim().slice(0, 400) || DEFAULT_IMPACT,
        evidence_terms: evidence_terms?.length ? evidence_terms : undefined,
        is_vital: true,
      });
      idx++;
    }
    mergedSections.push({
      section_title: section.section_title,
      section_key: section.section_key,
      elements,
    });
  }

  const schemaResult: DerivedPlanSchema = { sections: mergedSections };
  const elementsTotal = schemaResult.sections.reduce((sum, s) => sum + s.elements.length, 0);
  if (elementsTotal === 0) {
    throw new Error("Derived elementsTotal=0. This is a hard failure. Do not persist.");
  }
  validateDerivedSchema(schemaResult as DerivedPlanSchemaJson);
  return schemaResult;
}
