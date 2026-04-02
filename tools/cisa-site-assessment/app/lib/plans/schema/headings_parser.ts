/**
 * Headings fallback for plan schema: strict numbered headings from document text.
 * Anti-drift: cap 12 sections, monotonic order, numbered 1..25 only.
 */

import type { PlanSchemaSnapshot, PlanSchemaSection, PlanSchemaElement, PlanSourceLocator } from "./types";

export type PageLines = { page: number; lines: string[] };

const NUMBERED_HEADING = /^\s*(\d{1,2})[.)]\s+(.+?)\s*$/;
const SECTION_STYLE = /^\s*Section\s+(\d{1,2})\s*[-:]?\s*(.*?)\s*$/i;
const MAX_SECTIONS = 12;
const MIN_SECTIONS = 5;
const MAX_HEADING_LEN = 120;

function slug(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80) || "section";
}

function makeLocator(page: number): PlanSourceLocator {
  const p = String(Math.max(1, page));
  return { locator_type: "pdf_page", locator: p, page_range: `${p}-${p}` };
}

export type HeadingCandidate = { ord: number; title: string; page: number; rawLine: string };

/**
 * Extract candidate headings from page lines. Only numbered "N. Title" or "Section N ...".
 * Deduplicate by normalized title; preserve first occurrence order.
 */
export function extractNumberedHeadings(pages: PageLines[]): HeadingCandidate[] {
  const seen = new Set<string>();
  const result: HeadingCandidate[] = [];
  for (const { page, lines } of pages) {
    for (const line of lines) {
      const t = line.trim();
      if (t.length > MAX_HEADING_LEN) continue;
      let ord: number | null = null;
      let title = "";
      const numMatch = t.match(NUMBERED_HEADING);
      const secMatch = t.match(SECTION_STYLE);
      if (numMatch) {
        ord = parseInt(numMatch[1], 10);
        title = (numMatch[2] ?? "").trim();
      } else if (secMatch) {
        ord = parseInt(secMatch[1], 10);
        title = (secMatch[2] ?? "").trim();
      }
      if (ord == null || ord < 1 || ord > 25) continue;
      const norm = title.toLowerCase().replace(/\s+/g, " ").trim();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      result.push({ ord, title: norm ? title : `Section ${ord}`, page, rawLine: t });
    }
  }
  return result;
}

/**
 * Anti-drift: keep only sequentially ordered headings (1..N with small gaps). Cap at MAX_SECTIONS.
 */
export function applyAntiDrift(candidates: HeadingCandidate[]): HeadingCandidate[] {
  if (candidates.length === 0) return [];
  const byOrd = new Map<number, HeadingCandidate>();
  for (const c of candidates) {
    if (!byOrd.has(c.ord)) byOrd.set(c.ord, c);
  }
  const ords = Array.from(byOrd.keys()).sort((a, b) => a - b);
  const kept: HeadingCandidate[] = [];
  let lastOrd = 0;
  for (const ord of ords) {
    if (kept.length >= MAX_SECTIONS) break;
    if (ord > lastOrd + 3 && kept.length > 0) break;
    const c = byOrd.get(ord);
    if (c) {
      kept.push(c);
      lastOrd = ord;
    }
  }
  return kept.slice(0, MAX_SECTIONS);
}

/**
 * Build PlanSchemaSnapshot from headings: one section per heading, one __core element per section.
 */
export function headingsToSnapshot(opts: {
  headings: HeadingCandidate[];
  module_code: string;
  structure_source_registry_id: string;
}): PlanSchemaSnapshot {
  const { headings, module_code, structure_source_registry_id } = opts;
  const sections: PlanSchemaSection[] = headings.map((h, i) => {
    const section_title = h.title;
    const section_key = `${i + 1}_${slug(section_title)}`;
    const element: PlanSchemaElement = {
      element_key: `${section_key}__core`,
      element_label: `Core elements for: ${section_title}`,
      element_ord: 1,
      is_core: true,
      source_excerpt: h.rawLine,
      source_locator: makeLocator(h.page),
    };
    return {
      section_key,
      section_title,
      section_ord: i + 1,
      source_locator: makeLocator(h.page),
      elements: [element],
    };
  });
  const confidence =
    sections.length >= 8 && sections.length <= 12 ? "MEDIUM" : sections.length >= MIN_SECTIONS ? "LOW" : "LOW";
  return {
    module_code,
    structure_source_registry_id,
    derive_method: "HEADINGS",
    confidence,
    sections,
  };
}
