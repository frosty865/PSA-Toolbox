/**
 * Plan structure pipeline: heading extraction via Ollama → gate + checklist (sections).
 * Use when plan_mode is true. No CAP01–CAP09, no OFCs.
 */

import * as fs from "fs";
import * as path from "path";
import { getOllamaUrl } from "@/app/lib/config/ollama";
import { getPlanStandardModel } from "@/app/lib/ollama/model_router";
import { pickHeadingChunks } from "@/app/lib/plans/heading_chunk_selector";
import { buildPlanGateQuestion } from "@/app/lib/plans/gate_question";
import { resolvePlanType } from "@/app/lib/plans/plan_type_resolver";
import { buildPlanChecklist, buildPlanChecklistFromTocTitles, assertChecklistLooksValid, MIN_CHECKLIST_ITEMS } from "@/app/lib/plans/plan_checklist_builder";
import { isActiveAssailantStructureSource } from "@/app/lib/plans/structure_sources";
import {
  extractTocNumberedSections,
  sourceHasTableOfContentsAndSection6Evacuation,
  checklistIncludesEvacuation,
} from "@/app/lib/plans/toc_extract";
import { extractAndGroupToc, buildSectionBoundaries as _buildSectionBoundaries, stripTocLeadersAndPage, parsePage } from "@/app/lib/plans/toc_parser";
import {
  extractVitalsAnchoredToSectionsWithDiagnostics,
  extractBulletsOnlyAnchoredToSections,
} from "@/app/lib/plans/vitals_section_anchored";
import { buildPlanCapabilitiesFromSections, buildPlanCapabilitiesFromToc, type PlanCapability, type VitalElementFromBody } from "@/app/lib/plans/plan_capabilities";
import { parseJsonWithExtraction } from "@/app/lib/llm/parse_json_strict";
import {
  buildCanonicalPlanExtractUserMessage,
  buildTocPlanExtractUserMessage,
  buildPlanExtractRepairUserMessage,
  CANONICAL_PLAN_EXTRACT_SYSTEM_PROMPT,
  TOC_PLAN_EXTRACT_SYSTEM_PROMPT,
  PLAN_EXTRACT_REPAIR_SYSTEM_PROMPT,
  type CanonicalPlanElement,
  type CanonicalPlanExtract,
} from "@/app/lib/modules/plan_extract/canonical";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");
const OLLAMA_TIMEOUT_MS = 90_000;
/**
 * Plan structure / heading extraction model. Independent from "standards" generation (plan required_elements).
 * Uses PSA_OLLAMA_PLAN_MODEL or psa-plan-standard:latest. Optional future: OLLAMA_PLAN_VITALS_MODEL for vitals-only.
 */
function getPlanOllamaModel(): string {
  const vitalsModel = process.env.OLLAMA_PLAN_VITALS_MODEL?.trim();
  if (vitalsModel) return vitalsModel;
  const planModel = process.env.PSA_OLLAMA_PLAN_MODEL?.trim();
  if (planModel?.startsWith("PSA_Ollama_Model")) return getPlanStandardModel();
  return planModel || getPlanStandardModel();
}
/** Hard cap on heading text sent to Ollama to reduce drift. */
const MAX_HEADING_CHARS = 60_000;
/** Stop tokens to prevent commentary (e.g. "Based on the text..."). */
const OLLAMA_STOP = ["```", "\n\nBased on", "\n\nHere", "\n\nI ", "\n\nExplanation"];

export interface PlanStructureChunk {
  source_registry_id: string;
  doc_id: string;
  chunk_id: string;
  locator_type: string;
  locator_value: string;
  /** When set, pipeline can filter to top source only. */
  module_source_id?: string | null;
  page_range?: string;
  text: string;
}

/** When plan_vital_elements_count is 0, diagnostic counts for debugging. */
export interface PlanVitalElementsDiagnostics {
  top_source_chunks: number;
  parsed_pages_count: number;
  sections_with_nonempty_text: number;
  sections_with_marker_present: number;
}

export interface PlanStructureResult {
  plan_type: string;
  gate_question: { id: string; text: string; response_type: "YES_NO_NA" };
  checklist_prompt: string;
  checklist_items: Array<{ id: string; text: string; subitems?: string[] }>;
  /** PLAN capabilities (1:1 with sections); deterministic from TOC. */
  capabilities: PlanCapability[];
  /** When vitals total is 0, concrete reason for diagnostics. */
  plan_vital_elements_reason?: string;
  /** When vitals total is 0, diagnostic counts (preflight / logs). */
  plan_vital_elements_diagnostics?: PlanVitalElementsDiagnostics;
  /** Section-anchored extraction: sections whose header was found in fullText. */
  plan_sections_found_in_text?: number;
  /** Section-anchored extraction: marker phrases found. */
  plan_markers_found?: number;
  /** Section-anchored extraction: bullets captured. */
  plan_bullets_captured?: number;
  /** Chunks used for plan structure (top source only when top_source_id set). */
  chunks_used_count?: number;
}

export interface PlanStructurePipelineOpts {
  moduleCode: string;
  /** Fallback when resolver does not have module/request/source info (never "Physical Security Plan"). */
  planTypeFallback?: string;
  module_plan_type?: string | null;
  request_plan_type?: string | null;
  /** Source titles from preflight "Top sources used" labels; used for plan type resolution when no module/request override. */
  source_titles?: string[] | null;
  /** Top source id/label for capability traceability (e.g. Instructional Guide). When set, only chunks with matching module_source_id are used for vitals. */
  top_source_id?: string | null;
  top_source_label?: string | null;
  /** Expected chunk count for top source (from preflight); log mismatch if provided. */
  top_source_chunks_expected?: number | null;
}

function loadChunks(moduleCode: string): { chunks: PlanStructureChunk[]; source_index: Record<string, string> } {
  const p = path.join(CHUNKS_DIR, `${moduleCode}.json`);
  if (!fs.existsSync(p)) throw new Error(`CHUNK_EXPORT_MISSING: No chunk export at data/module_chunks/${moduleCode}.json`);
  const raw = fs.readFileSync(p, "utf-8");
  const data = JSON.parse(raw) as { chunks?: PlanStructureChunk[]; source_index?: Record<string, string> };
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];
  const source_index = (data.source_index && typeof data.source_index === "object") ? data.source_index : {};
  return { chunks, source_index };
}

const KEYWORD_WINDOW_MIN = 6_000;
const KEYWORD_WINDOW_MAX = 12_000;

/**
 * Fallback slice: find first occurrence of section title (case-insensitive) in fullText,
 * take a window of text following it (up to KEYWORD_WINDOW_MAX chars), stopping early if next section title appears.
 */
function _sliceSectionByKeywordWindow(
  fullText: string,
  sectionTitle: string,
  nextSectionTitle?: string | null
): string {
  const clean = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
  const needle = clean(sectionTitle);
  if (!needle) return "";
  const idx = fullText.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return "";
  let end = Math.min(idx + KEYWORD_WINDOW_MAX, fullText.length);
  if (nextSectionTitle) {
    const nextNeedle = clean(nextSectionTitle);
    if (nextNeedle) {
      const nextIdx = fullText.toLowerCase().indexOf(nextNeedle.toLowerCase(), idx + needle.length);
      if (nextIdx > idx && nextIdx < end) end = nextIdx;
    }
  }
  let slice = fullText.slice(idx, end);
  if (slice.length > KEYWORD_WINDOW_MAX) slice = slice.slice(0, KEYWORD_WINDOW_MAX);
  if (slice.length < KEYWORD_WINDOW_MIN && slice.length < fullText.length - idx) slice = fullText.slice(idx, Math.min(idx + KEYWORD_WINDOW_MIN, fullText.length));
  return slice;
}

/** Collapse whitespace for log sample (first 280 chars). */
function _sampleForLog(sectionText: string, maxLen = 280): string {
  return (sectionText ?? "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/** Marker phrase used by extractor; presence suggests correct section body. */
function _sectionHasMarker(sectionText: string): boolean {
  return (sectionText ?? "").toLowerCase().includes("consider the following");
}

/** Bullet glyph / dash list presence. */
function _sectionHasBulletGlyph(sectionText: string): boolean {
  const t = sectionText ?? "";
  return /●|•/.test(t) || /\n-\s/.test(t);
}

/** Error code when plan extract JSON cannot be parsed even after one retry. */
export const PLAN_EXTRACT_JSON_FAILED = "PLAN_EXTRACT_JSON_FAILED";
/** Error code when TOC extraction returns no sections (do not mine arbitrary headings). */
export const PLAN_TOC_NOT_FOUND = "PLAN_TOC_NOT_FOUND";

const ACTIVE_ASSAILANT_EAP_PLAN_TYPE = "Active Assailant Emergency Action Plan";

export async function runPlanStructurePipeline(
  opts: PlanStructurePipelineOpts | string,
  planTypeDisplay?: string
): Promise<PlanStructureResult> {
  const moduleCode = typeof opts === "string" ? opts : opts.moduleCode;
  const { chunks, source_index } = loadChunks(moduleCode);
  if (chunks.length === 0) throw new Error("NO_CHUNKS: No chunks in export.");

  const source_titles =
    (typeof opts === "object" && Array.isArray(opts.source_titles) ? opts.source_titles : null) ??
    (Object.values(source_index).filter(Boolean) as string[]);
  const resolved =
    typeof opts === "object"
      ? resolvePlanType({
          module_plan_type: opts.module_plan_type ?? null,
          request_plan_type: opts.request_plan_type ?? null,
          source_titles,
        })
      : resolvePlanType({
          request_plan_type: (planTypeDisplay ?? "").trim() || null,
          source_titles,
        });
  const plan_type_for_prompt = resolved.plan_type;
  const isActiveAssailantEap = plan_type_for_prompt === ACTIVE_ASSAILANT_EAP_PLAN_TYPE;

  let chunksForExtraction = chunks;
  if (isActiveAssailantEap) {
    const getLabel = (c: PlanStructureChunk): string => {
      const rec = c as PlanStructureChunk & { source_label?: string; source_title?: string; source_name?: string };
      return (
        (rec.source_label ?? rec.source_title ?? rec.source_name ?? source_index[c.source_registry_id] ?? "").trim()
      );
    };
    chunksForExtraction = chunks.filter((c) => isActiveAssailantStructureSource(getLabel(c)));

    if (chunksForExtraction.length === 0 && process.env.NODE_ENV !== "production") {
      const byLabel = new Map<string, number>();
      for (const ch of chunks) {
        const lab = getLabel(ch);
        byLabel.set(lab, (byLabel.get(lab) ?? 0) + 1);
      }
      console.log("[plan] structure source allowlist evaluation:");
      for (const [lab, count] of byLabel.entries()) {
        const ok = isActiveAssailantStructureSource(lab);
        console.log("  ", { ok, count, lab: lab || "(empty)" });
      }
    }

    if (chunksForExtraction.length === 0) {
      throw new Error(
        "PLAN_STRUCTURE_SOURCES_MISSING: No chunks from template/guide sources. Allow: title contains 'active shooter' or 'active assailant' and ('template' or 'guide'). Add a source titled like 'Active Assailant EAP Template' or 'Active Shooter Emergency Action Plan (Guide)'."
      );
    }
  }

  // Top source only: when top_source_id is set, use only chunks from that source for TOC + vitals.
  const topSourceId = typeof opts === "object" ? opts.top_source_id ?? null : null;
  const topSourceChunksExpected = typeof opts === "object" ? opts.top_source_chunks_expected ?? null : null;
  let topChunks = chunksForExtraction;
  if (topSourceId) {
    topChunks = chunksForExtraction.filter((c) => (c.module_source_id ?? "") === topSourceId);
    if (topChunks.length === 0) {
      console.warn("[plan] top_source_id filter yielded 0 chunks; using full chunksForExtraction for vitals.");
      topChunks = chunksForExtraction;
    } else if (topSourceChunksExpected != null && topChunks.length !== topSourceChunksExpected) {
      console.warn(
        "[plan] top source chunk count mismatch: pipeline topChunks=",
        topChunks.length,
        "preflight top source used=",
        topSourceChunksExpected
      );
    }
  }

  const chunkIdTexts = topChunks.map((c) => ({ id: c.chunk_id, text: c.text ?? "" }));
  let selected = pickHeadingChunks(chunkIdTexts, 25);
  if (selected.length === 0) selected = chunkIdTexts.slice(0, 25);
  let sourceText = selected.map((c, i) => `[Chunk ${i + 1}]\n${c.text}`).join("\n\n");
  if (sourceText.length > MAX_HEADING_CHARS) {
    sourceText = sourceText.slice(0, MAX_HEADING_CHARS);
  }

  const useTocPrompt = isActiveAssailantEap;
  const systemPrompt = useTocPrompt ? TOC_PLAN_EXTRACT_SYSTEM_PROMPT : CANONICAL_PLAN_EXTRACT_SYSTEM_PROMPT;
  const userMessage = useTocPrompt
    ? buildTocPlanExtractUserMessage(plan_type_for_prompt, sourceText)
    : buildCanonicalPlanExtractUserMessage(plan_type_for_prompt, sourceText);

  const ollamaUrl = getOllamaUrl().replace(/\/+$/, "");
  const ollamaBody = (messages: { role: string; content: string }[]) => ({
    model: getPlanOllamaModel(),
    messages,
    stream: false,
    options: {
      temperature: 0,
      num_predict: 1200,
      stop: OLLAMA_STOP,
    },
  });

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      ollamaBody([
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ])
    ),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama plan extract failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  let rawContent = (data.message?.content ?? "").trim();

  let parsed: CanonicalPlanExtract;
  try {
    parsed = parseJsonWithExtraction<CanonicalPlanExtract>(rawContent);
  } catch (_firstErr) {
    // Retry once with repair prompt: convert prior output into strict JSON only.
    const repairUser = buildPlanExtractRepairUserMessage(plan_type_for_prompt, rawContent);
    const res2 = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        ollamaBody([
          { role: "system", content: PLAN_EXTRACT_REPAIR_SYSTEM_PROMPT },
          { role: "user", content: repairUser },
        ])
      ),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res2.ok) {
      const text = await res2.text().catch(() => "");
      throw new Error(`Ollama plan extract retry failed: ${res2.status} ${text}`);
    }
    const data2 = (await res2.json()) as { message?: { content?: string } };
    rawContent = (data2.message?.content ?? "").trim();
    try {
      parsed = parseJsonWithExtraction<CanonicalPlanExtract>(rawContent);
    } catch (retryErr) {
      const preview = rawContent.slice(0, 200).replace(/\s+/g, " ");
      const err = new Error(
        `${PLAN_EXTRACT_JSON_FAILED}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}. Output preview: ${preview}`
      ) as Error & { code: string; preview?: string };
      err.code = PLAN_EXTRACT_JSON_FAILED;
      err.preview = preview;
      throw err;
    }
  }

  const plan_type = (parsed.plan_type ?? plan_type_for_prompt).trim() || plan_type_for_prompt;
  const elements = (parsed.elements ?? []) as CanonicalPlanElement[];

  // A) Instrument: after Ollama parse
  if (process.env.NODE_ENV !== "production") {
    console.log("[plan] extracted elements:", elements?.length ?? 0);
    console.log("[plan] first titles:", (elements || []).slice(0, 3).map((e) => e?.title));
  }

  if (elements.length === 0) {
    const err = new Error(
      `${PLAN_TOC_NOT_FOUND}: No Table of Contents sections extracted. Adjust chunk selection or include first pages of template where TOC exists. Do not mine arbitrary headings.`
    ) as Error & { code: string; failure_reason?: string; hint?: string };
    err.code = PLAN_TOC_NOT_FOUND;
    (err as Error & { failure_reason: string }).failure_reason = PLAN_TOC_NOT_FOUND;
    (err as Error & { hint: string }).hint =
      "Include PDF pages that contain the plan's Table of Contents. Ensure structure sources are template/guide (allowlist) and not the CISA instructional guide only.";
    throw err;
  }

  // TOC-based authoritative scaffold: prefer multi-level TOC (Level-1 + Level-2 vitals), else single-level numbered sections.
  const tocGrouped = extractAndGroupToc(sourceText);
  const tocSections = tocGrouped
    ? tocGrouped.sections.map((s) => s.title)
    : extractTocNumberedSections(sourceText).map((t) => stripTocLeadersAndPage(t).title).filter(Boolean);
  const useTocScaffold = tocSections.length >= 8;

  let checklist_items: Array<{ id: string; text: string; subitems?: string[] }>;
  if (useTocScaffold) {
    checklist_items = buildPlanChecklistFromTocTitles(tocSections);
    if (process.env.NODE_ENV !== "production") {
      console.log("[plan] using TOC scaffold; checklist_items:", checklist_items.length, "sections:", tocSections.slice(0, 3), "grouped:", !!tocGrouped);
    }
  } else {
    if (elements.length < MIN_CHECKLIST_ITEMS) {
      const err = new Error(
        `PLAN_CHECKLIST_EXTRACTION_FAILED: too few sections (${elements.length}, minimum ${MIN_CHECKLIST_ITEMS}). heading_chunk_count=${selected.length} top_chunk_ids=${JSON.stringify(selected.slice(0, 2).map((c) => c.id))}`
      ) as Error & { failure_reason: string; counts?: { elements: number }; heading_chunk_count?: number; top_chunk_ids?: string[]; hint?: string };
      err.failure_reason = "PLAN_CHECKLIST_EXTRACTION_FAILED";
      err.counts = { elements: elements.length };
      err.heading_chunk_count = selected.length;
      err.top_chunk_ids = selected.slice(0, 2).map((c) => c.id);
      err.hint =
        "No TOC/headings detected in chunk set. Ensure sources include a table of contents or numbered section headings.";
      throw err;
    }
    checklist_items = buildPlanChecklist(elements);
  }

  assertChecklistLooksValid(checklist_items);

  // Hard guard: if source has TABLE OF CONTENTS and section 6 Evacuation, checklist must include it.
  if (sourceHasTableOfContentsAndSection6Evacuation(sourceText) && !checklistIncludesEvacuation(checklist_items)) {
    const err = new Error(
      "Checklist omitted TOC section 6: Procedures for Evacuation, Lockdown, and Shelter-in-Place."
    ) as Error & { failure_reason?: string };
    err.failure_reason = "CHECKLIST_OMITTED_TOC_SECTION_6";
    throw err;
  }

  // Capabilities: from grouped TOC; extract vitals from section bodies by page range (TOC start_page + chunk locator). Use topChunks only.
  const capabilityOpts = {
    topSourceId: typeof opts === "object" && opts?.top_source_id ? opts.top_source_id : undefined,
    topSourceLabel: typeof opts === "object" && opts?.top_source_label ? opts.top_source_label : undefined,
  };
  let vitalsPerSection: VitalElementFromBody[][] | null = null;
  let planVitalElementsReason: string | undefined;
  let planVitalElementsDiagnostics: PlanStructureResult["plan_vital_elements_diagnostics"];
  type SectionStat = {
    start_page: number | null;
    end_page: number | null;
    selected_chunks_count: number;
    section_text_chars: number;
    vitals_found: number;
    marker_present?: boolean;
    bullet_present?: boolean;
    found_heading?: boolean;
    pages_min?: number | null;
    pages_max?: number | null;
  };
  const sectionSliceStats: SectionStat[] = [];

  let planSectionsFoundInText: number | undefined;
  let planMarkersFound: number | undefined;
  let planBulletsCaptured: number | undefined;

  if (useTocScaffold && tocGrouped) {
    const sections = tocGrouped.sections;
    const fullTextFromTopChunks = topChunks.map((c) => (c.text ?? "").trim()).filter(Boolean).join("\n\n");
    const sectionTitles = sections.map((s) => s.title);

    // A) Section-anchored bullet extraction (no page/locator slicing)
    const anchoredResult = extractVitalsAnchoredToSectionsWithDiagnostics(fullTextFromTopChunks, sectionTitles);
    const vitalsBySectionTitle = new Map(anchoredResult.vitalsBySectionTitle);
    if (anchoredResult.markersFound === 0) {
      const bulletOnly = extractBulletsOnlyAnchoredToSections(fullTextFromTopChunks, sectionTitles);
      for (const [sec, texts] of bulletOnly) {
        const existing = vitalsBySectionTitle.get(sec) ?? [];
        const seen = new Set(existing.map((t) => t.toLowerCase()));
        for (const t of texts) {
          if (!seen.has(t.toLowerCase())) {
            existing.push(t);
            seen.add(t.toLowerCase());
          }
        }
        vitalsBySectionTitle.set(sec, existing.slice(0, 12));
      }
    }
    const normalizeSectionTitle = (s: string) => (s ?? "").trim().replace(/\s+/g, " ");
    vitalsPerSection = sections.map((sec) =>
      (vitalsBySectionTitle.get(normalizeSectionTitle(sec.title)) ?? []).map((text) => ({
        title: text,
        locator_type: "bullet" as const,
        locator: text,
      }))
    );
    planSectionsFoundInText = anchoredResult.sectionsFoundInText;
    planMarkersFound = anchoredResult.markersFound;
    planBulletsCaptured = [...vitalsBySectionTitle.values()].reduce((sum, arr) => sum + arr.length, 0);

    for (let i = 0; i < sections.length; i++) {
      const vitalsInSec = vitalsPerSection[i] ?? [];
      sectionSliceStats.push({
        start_page: null,
        end_page: null,
        selected_chunks_count: 0,
        section_text_chars: 0,
        vitals_found: vitalsInSec.length,
      });
    }

    const vital_elements_total = (vitalsPerSection ?? []).reduce((sum, arr) => sum + arr.length, 0);
    if (vital_elements_total === 0) {
      if (planSectionsFoundInText === 0) {
        planVitalElementsReason = "No section headers found in extracted text; cannot anchor vital elements.";
      } else if ((planMarkersFound ?? 0) === 0) {
        planVitalElementsReason =
          "Section headers found but no marker phrases found; refine marker set or use bullet-only detector.";
      } else {
        planVitalElementsReason = "Markers found but no bullets captured; refine bullet detection/wrap logic.";
      }
      planVitalElementsDiagnostics = {
        top_source_chunks: topChunks.length,
        parsed_pages_count: topChunks.map((c) => parsePage(c.locator_value, c.page_range)).filter((p) => p != null).length,
        sections_with_nonempty_text: 0,
        sections_with_marker_present: 0,
      };
      if (process.env.DEBUG_PLAN_VITALS === "1") {
        console.log("[plan] vital_elements_total=0 reason:", planVitalElementsReason);
      }
    }
  }

  const capabilities =
    useTocScaffold && tocGrouped
      ? buildPlanCapabilitiesFromToc(tocGrouped, { ...capabilityOpts, vitalsPerSection: vitalsPerSection ?? undefined })
      : buildPlanCapabilitiesFromSections(
          useTocScaffold ? tocSections : (elements as { title?: string }[]).map((e) => (e.title ?? "").trim()).filter(Boolean),
          capabilityOpts
        );

  // DEBUG_PLAN_VITALS=1: single server-side log block (summary + per-section). No client logs.
  if (process.env.DEBUG_PLAN_VITALS === "1") {
    const totalChunksRetrieved = chunksForExtraction.length;
    const topSourceChunks = topChunks.length;
    const pagesParsedCount = topChunks.map((c) => parsePage(c.locator_value, c.page_range)).filter((p) => p != null).length;
    const sectionsWithNonEmptyText = sectionSliceStats.filter((s) => (s.section_text_chars ?? 0) > 0).length;
    const sectionsWithMarkerPresent = sectionSliceStats.filter((s) => s.marker_present === true).length;
    console.log("[plan-vitals] SUMMARY totalChunksRetrieved=" + totalChunksRetrieved + " topSourceChunks=" + topSourceChunks + " pagesParsedCount=" + pagesParsedCount + " sectionsWithNonEmptyText=" + sectionsWithNonEmptyText + " sectionsWithMarkerPresent=" + sectionsWithMarkerPresent);
    if (sectionSliceStats.length > 0) {
      sectionSliceStats.forEach((s, i) => {
        const title = (capabilities[i]?.capability_title ?? capabilities[i]?.locator ?? "sec" + (i + 1)).toString().slice(0, 50);
        console.log("[plan-vitals] section " + (i + 1) + " title=" + title + " sectionTextChars=" + (s.section_text_chars ?? 0) + " vitalsCount=" + (s.vitals_found ?? 0) + " markerPresent=" + (s.marker_present === true) + " bulletPresent=" + (s.bullet_present === true));
      });
    } else {
      console.log("[plan-vitals] (no section stats — TOC path not used or no sections)");
    }
  }
  if (process.env.NODE_ENV !== "production" && process.env.DEBUG_PLAN_VITALS !== "1") {
    console.log("[plan] checklist_items:", checklist_items.length);
    console.log("[plan] PLAN capabilities:", capabilities.length);
    console.log("[plan] first checklist:", checklist_items.slice(0, 3).map((x) => x.text));
  }

  const gate_question = {
    id: "GATE_001",
    text: buildPlanGateQuestion(plan_type, {
      moduleCode: typeof opts === "object" ? opts.moduleCode : undefined,
      topSourceLabel: typeof opts === "object" ? opts.top_source_label : undefined,
    }),
    response_type: "YES_NO_NA" as const,
  };

  return {
    plan_type,
    gate_question,
    checklist_prompt: "Does it include the following sections?",
    checklist_items,
    capabilities,
    ...(planVitalElementsReason != null ? { plan_vital_elements_reason: planVitalElementsReason } : {}),
    ...(planVitalElementsDiagnostics != null ? { plan_vital_elements_diagnostics: planVitalElementsDiagnostics } : {}),
    ...(planSectionsFoundInText != null ? { plan_sections_found_in_text: planSectionsFoundInText } : {}),
    ...(planMarkersFound != null ? { plan_markers_found: planMarkersFound } : {}),
    ...(planBulletsCaptured != null ? { plan_bullets_captured: planBulletsCaptured } : {}),
    chunks_used_count: topChunks.length,
  };
}
