/**
 * TOC parsing for schema-first pipeline: call Python outline extractor or use pre-parsed TOC JSON.
 * Maps outline to PlanSchemaSnapshot sections/elements (Level-1 => section, Level-2+ => element).
 */

import { spawn } from "child_process";
import * as path from "path";
import { extractFirstJsonValue, parseJsonWithContext } from "./json_extract";
import type { PlanSchemaSnapshot, PlanSchemaSection, PlanSchemaElement, PlanSourceLocator } from "./types";

export type TocOutlineEntry = { level: number; title: string; page: number };

/** Discriminate payload shape: TOC extractor returns { toc: [...] }; LLM/legacy returns { items: [...] }. */
export function detectPayloadKind(v: unknown): "toc" | "items" | "unknown" {
  if (v && typeof v === "object") {
    if (Array.isArray((v as { toc?: unknown }).toc)) return "toc";
    if (Array.isArray((v as { items?: unknown }).items)) return "items";
  }
  return "unknown";
}

const MIN_LEVEL1_FOR_TOC = 8;
const MAX_SECTIONS = 12;

function slug(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80) || "section";
}

/** Strip leading numbering from title (e.g. "1. Purpose" -> "Purpose"). */
function stripLeadingNumbering(title: string): string {
  const t = (title ?? "").trim();
  const m = t.match(/^\s*(?:\d{1,2}[.)]\s*|Section\s+\d+\s*[-:]?\s*)/i);
  return m ? t.slice(m[0].length).trim() : t;
}

function makeLocator(page: number): PlanSourceLocator {
  const p = String(Math.max(1, page));
  return { locator_type: "pdf_outline", locator: "outline", page_range: `${p}-${p}` };
}

/**
 * Convert outline entries to PlanSchemaSnapshot (sections + elements).
 * Level-1 => section; Level-2 under last Level-1 => elements; Level-3 folded into Level-2 label.
 */
export function outlineToSnapshot(opts: {
  toc: TocOutlineEntry[];
  module_code: string;
  structure_source_registry_id: string;
}): { snapshot: PlanSchemaSnapshot; confidence: "HIGH" | "MEDIUM" | "LOW" } {
  const { toc, module_code, structure_source_registry_id } = opts;
  const sections: PlanSchemaSection[] = [];
  let level1Count = 0;
  let level2WithPage = 0;
  let level1WithPage = 0;

  const l1Entries = toc.filter((e) => e.level === 1);
  const l2Entries = toc.filter((e) => e.level === 2);
  level1Count = l1Entries.length;
  level1WithPage = l1Entries.filter((e) => e.page > 0).length;
  level2WithPage = l2Entries.filter((e) => e.page > 0).length;

  const seenKeysPerSection = new Map<PlanSchemaSection, Set<string>>();
  let currentSection: PlanSchemaSection | null = null;
  for (let i = 0; i < toc.length; i++) {
    const e = toc[i];
    if (e.level === 1) {
      const section_title = stripLeadingNumbering(e.title) || e.title;
      const section_key = `${sections.length + 1}_${slug(section_title)}`;
      currentSection = {
        section_key,
        section_title,
        section_ord: sections.length + 1,
        source_locator: e.page > 0 ? makeLocator(e.page) : undefined,
        elements: [],
      };
      sections.push(currentSection);
      seenKeysPerSection.set(currentSection, new Set());
    } else if (e.level >= 2 && currentSection) {
      const rawTitle = (e.title ?? "").trim();
      const element_label = stripLeadingNumbering(rawTitle) || rawTitle;
      let baseKey = slug(rawTitle);
      if (e.level === 3 && toc[i - 1]?.level === 2) {
        const prevTitle = (toc[i - 1].title ?? "").trim();
        const prevLabel = stripLeadingNumbering(prevTitle) || prevTitle;
        baseKey = slug(`${prevLabel}_${rawTitle}`);
      }
      const seen = seenKeysPerSection.get(currentSection)!;
      let element_key = baseKey || `element_${currentSection.elements.length + 1}`;
      if (seen.has(element_key)) {
        let n = 2;
        while (seen.has(`${element_key}_${n}`)) n++;
        element_key = `${element_key}_${n}`;
      }
      seen.add(element_key);
      const el: PlanSchemaElement = {
        element_key,
        element_label,
        element_ord: currentSection.elements.length + 1,
        is_core: false,
        source_excerpt: rawTitle,
        source_locator: e.page > 0 ? makeLocator(e.page) : undefined,
      };
      currentSection.elements.push(el);
    }
  }

  // If any section has no elements, add __core
  for (const sec of sections) {
    if (sec.elements.length === 0) {
      sec.elements.push({
        element_key: `${sec.section_key}__core`,
        element_label: `Core documentation for: ${sec.section_title}`,
        element_ord: 1,
        is_core: true,
        source_excerpt: sec.section_title,
        source_locator: sec.source_locator ?? undefined,
      });
    }
  }

  let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (level1WithPage >= level1Count * 0.7 && level2WithPage > 0) confidence = "HIGH";
  else if (level1Count >= MIN_LEVEL1_FOR_TOC || (sections.length >= 5 && sections.some((s) => s.elements.length > 0)))
    confidence = "MEDIUM";

  const snapshot: PlanSchemaSnapshot = {
    module_code,
    structure_source_registry_id,
    derive_method: "TOC",
    confidence,
    sections: sections.slice(0, MAX_SECTIONS),
  };
  return { snapshot, confidence };
}

type TocPayload = { toc?: TocOutlineEntry[]; error?: string };

/**
 * Run Python TOC extractor; stdout = JSON only. Parse with robust extractor.
 */
async function runPythonTocJson(scriptPath: string, pdfPath: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", [scriptPath, pdfPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUTF8: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (d: string | Buffer) => (stdout += typeof d === "string" ? d : d.toString("utf8")));
    child.stderr?.on("data", (d: string | Buffer) => (stderr += typeof d === "string" ? d : d.toString("utf8")));
    child.on("error", (err) => reject(err));
    child.on("close", (code, _signal) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

/**
 * Call Python script to extract PDF outline. Returns parsed TOC or empty on error.
 * Uses robust JSON extraction; on parse failure throws PLAN_SCHEMA_PARSE_FAILED with debug (message, position, snippet).
 * Requires payload shape { toc: [...] }; throws PLAN_SCHEMA_UNEXPECTED_PAYLOAD_FOR_TOC if shape is items/unknown.
 */
export function extractPdfOutline(pdfPath: string): Promise<TocOutlineEntry[]> {
  const scriptPath = path.join(process.cwd(), "tools", "plans", "extract_pdf_toc.py");
  return runPythonTocJson(scriptPath, pdfPath).then(({ stdout, stderr, code }) => {
    let jsonText: string;
    try {
      const extracted = extractFirstJsonValue(stdout);
      jsonText = extracted.jsonText;
  } catch (_extractErr) {
      console.error("[derive_plan_schema] JSON extraction failed (no start token or unbalanced).", {
        stderr_preview: (stderr ?? "").slice(0, 400),
        length: stdout?.length ?? 0,
        first40: (stdout ?? "").slice(0, 40),
      });
      const err = new Error("PLAN_SCHEMA_PARSE_FAILED") as Error & { code?: string };
      err.code = "PLAN_SCHEMA_PARSE_FAILED";
      throw err;
    }

    const parsed = parseJsonWithContext<TocPayload>(jsonText);
    if (!parsed.ok) {
      console.error("[derive_plan_schema] JSON.parse failed.", {
        ...parsed.debug,
        stderr_preview: (stderr ?? "").slice(0, 400),
      });
      const err = new Error("PLAN_SCHEMA_PARSE_FAILED") as Error & { code?: string };
      err.code = "PLAN_SCHEMA_PARSE_FAILED";
      throw err;
    }

    const kind = detectPayloadKind(parsed.value);
    if (kind !== "toc") {
      console.error("[derive_plan_schema] Unexpected payload for TOC_PREFERRED.", {
        kind,
        keys: Object.keys(parsed.value ?? {}),
      });
      const err = new Error("PLAN_SCHEMA_UNEXPECTED_PAYLOAD_FOR_TOC") as Error & { code?: string };
      err.code = "PLAN_SCHEMA_UNEXPECTED_PAYLOAD_FOR_TOC";
      throw err;
    }

    const payload = parsed.value;
    if (!payload || !Array.isArray(payload.toc)) {
      const err = new Error("PLAN_SCHEMA_TOC_PAYLOAD_INVALID") as Error & { code?: string };
      err.code = "PLAN_SCHEMA_TOC_PAYLOAD_INVALID";
      throw err;
    }
    if (payload.error && code !== 0) return [];
    return payload.toc;
  });
}

/**
 * Check if TOC is usable: enough Level-1 entries and at least one subordinate.
 */
export function isTocUsable(toc: TocOutlineEntry[]): boolean {
  const l1 = toc.filter((e) => e.level === 1).length;
  const hasSub = toc.some((e) => e.level >= 2);
  return l1 >= MIN_LEVEL1_FOR_TOC && hasSub;
}
