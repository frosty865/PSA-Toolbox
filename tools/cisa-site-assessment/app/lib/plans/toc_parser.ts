/**
 * Multi-level TOC parsing for plan structure (Level-1 sections + Level-2 vitals).
 * Deterministic; no LLM. Used to build checklist and plan capabilities with vital elements.
 */

export interface TocEntry {
  raw: string;
  level: 1 | 2;
  /** e.g. "1", "6", "6.2" (subsection "6-2" normalized to "6.2") */
  key: string;
  /** Normalized title (no trailing page numbers, collapsed whitespace). */
  title: string;
  /** Level-1 only: page number from TOC line (dot-leaders). */
  start_page?: number | null;
}

export interface TocSection {
  key: string;
  title: string;
  /** Page number from TOC line (dot-leader format). Null if not parsed. */
  start_page: number | null;
  vitals: Array<{ key: string; title: string }>;
}

export interface TocGrouped {
  sections: TocSection[];
}

const TOC_HEADING = /table of contents/i;
/** End of TOC region: start of document body. */
const TOC_END = /^\s*(INTRODUCTION|SECTION\s*1)\b/i;
/** Level 1: "1. TITLE" or "10. TITLE" */
const LEVEL_1 = /^\s*(\d{1,2})\.\s+(.+?)\s*$/;
/** Level 2: "6.2 TITLE" or "6.02 TITLE" */
const LEVEL_2_DOT = /^\s*(\d{1,2})\.(\d{1,2})\s+(.+?)\s*$/;
/** Level 2: "6-2 TITLE" (normalize to 6.2) */
const LEVEL_2_HYPHEN = /^\s*(\d{1,2})-(\d{1,2})\s+(.+?)\s*$/;

const MIN_SECTION = 1;
const MAX_SECTION = 12;
const MAX_TOC_LINES = 300;

/** Dot leaders + trailing page number: "TITLE .............4" or "TITLE .............. 31" */
const DOT_LEADERS_AND_PAGE = /[.\s]{5,}(\d+)\s*$/;

/**
 * Strip dot leaders and trailing page numbers from a TOC line. Returns cleaned title and optional page number.
 * Examples: "APPLICABILITY AND SCOPE .............4" -> { title: "APPLICABILITY AND SCOPE", page: 4 }
 */
export function stripTocLeadersAndPage(rawLine: string): { title: string; page: number | null } {
  let t = (rawLine ?? "").trim();
  let page: number | null = null;
  const match = t.match(DOT_LEADERS_AND_PAGE);
  if (match) {
    t = t.slice(0, match.index).trim();
    page = parseInt(match[1], 10);
  }
  t = t.replace(/\s+\d+\s*$/g, "").trim();
  if (t.endsWith(".")) t = t.slice(0, -1).trim();
  t = t.replace(/\s+/g, " ").trim();
  return { title: t, page };
}

const PAGE_MIN = 1;
const PAGE_MAX = 2000;

function clampPage(n: number): number | null {
  return Number.isFinite(n) && n >= PAGE_MIN && n <= PAGE_MAX ? n : null;
}

/**
 * Parse a chunk locator (or page_range fallback) to a single page number (for section slicing).
 * Accepts: "p. 19" / "p.19" / "page 19" / "Page: 19", "pp. 19-20" / "19-20" (use first),
 * JSON-like: {"page":19}, bracket: "[p19]" or "(p19)".
 * If locator is empty, uses pageRangeFallback when provided.
 * Returns first integer in [1..2000] or null.
 */
export function parsePage(
  locator: string | null | undefined,
  pageRangeFallback?: string | null
): number | null {
  let s = (locator ?? "").trim();
  if (!s && pageRangeFallback != null) s = (pageRangeFallback ?? "").trim();
  if (!s) return null;
  // JSON-like: {"page":19} or {"page_start":19}
  const jsonMatch = s.match(/\{\s*"page(?:_start)?"\s*:\s*(\d+)/);
  if (jsonMatch) {
    const n = parseInt(jsonMatch[1], 10);
    return clampPage(n);
  }
  // "pp. 19-20" or "19-20" (use first)
  const range = /(\d+)\s*-\s*(\d+)/.exec(s);
  if (range) {
    return clampPage(parseInt(range[1], 10));
  }
  // "p. 19" / "p.19" / "page 19" / "Page: 19" / "[p19]" / "(p19)"
  const prefixed = /(?:p\.?\s*|pp\.?\s*|page\s*:?\s*|\[p\s*|\(p\s*)?(\d+)/i.exec(s);
  if (prefixed) {
    return clampPage(parseInt(prefixed[1], 10));
  }
  const bare = /^\d+$/.exec(s);
  if (bare) return clampPage(parseInt(bare[0], 10));
  return null;
}

function stripPageNumbers(s: string): string {
  return stripTocLeadersAndPage(s).title;
}

/**
 * Extract lines that form the TOC region: after "TABLE OF CONTENTS" until next major break.
 */
export function extractTocLines(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TOC_HEADING.test(lines[i] ?? "")) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start; i < lines.length && out.length < MAX_TOC_LINES; i++) {
    const line = lines[i] ?? "";
    if (TOC_END.test(line.trim())) break;
    const trimmed = line.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

/**
 * Parse TOC lines into Level-1 and Level-2 entries. Ignores deeper levels.
 */
export function parseTocEntries(lines: string[]): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const line of lines) {
    const trimmed = (line ?? "").trim();
    if (!trimmed) continue;

    // Try Level 2 first so "6.2 Title" is not parsed as Level 1 "6." with title "2 Title"
    const m2d = trimmed.match(LEVEL_2_DOT);
    if (m2d) {
      const parent = parseInt(m2d[1], 10);
      if (parent >= MIN_SECTION && parent <= MAX_SECTION) {
        const key = `${m2d[1]}.${m2d[2]}`;
        const title = stripPageNumbers(m2d[3]);
        if (title) entries.push({ raw: trimmed, level: 2, key, title });
      }
      continue;
    }

    const m2h = trimmed.match(LEVEL_2_HYPHEN);
    if (m2h) {
      const parent = parseInt(m2h[1], 10);
      if (parent >= MIN_SECTION && parent <= MAX_SECTION) {
        const key = `${m2h[1]}.${m2h[2]}`;
        const title = stripPageNumbers(m2h[3]);
        if (title) entries.push({ raw: trimmed, level: 2, key, title });
      }
      continue;
    }

    const m1 = trimmed.match(LEVEL_1);
    if (m1) {
      const num = parseInt(m1[1], 10);
      if (num >= MIN_SECTION && num <= MAX_SECTION) {
        const { title, page } = stripTocLeadersAndPage(m1[2]);
        if (title) entries.push({ raw: trimmed, level: 1, key: m1[1], title, start_page: page ?? null });
      }
    }
  }
  return entries;
}

/**
 * Group parsed TOC entries into sections with vitals. Each Level-2 belongs to the nearest prior Level-1 whose key matches its parent number.
 */
export function groupTocBySection(entries: TocEntry[]): TocGrouped {
  const sections: TocSection[] = [];
  let current: TocSection | null = null;

  for (const e of entries) {
    if (e.level === 1) {
      current = { key: e.key, title: e.title, start_page: e.start_page ?? null, vitals: [] };
      sections.push(current);
    } else if (e.level === 2 && current) {
      const parentNum = e.key.split(".")[0];
      if (parentNum === current.key) {
        current.vitals.push({ key: e.key, title: e.title });
      }
    }
  }

  // Sort by start_page asc; nulls at end
  sections.sort((a, b) => {
    const pa = a.start_page;
    const pb = b.start_page;
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  });

  return { sections };
}

/**
 * One-shot: extract TOC lines from text, parse, and group. Returns null if no TOC region or fewer than 8 Level-1 sections.
 */
export function extractAndGroupToc(text: string): TocGrouped | null {
  const lines = extractTocLines(text);
  if (lines.length === 0) return null;
  const entries = parseTocEntries(lines);
  const grouped = groupTocBySection(entries);
  if (grouped.sections.length < 8) return null;
  return grouped;
}

// ---------------------------------------------------------------------------
// Section boundaries (Level-1 headings in full text)
// ---------------------------------------------------------------------------

export interface SectionBoundary {
  title: string;
  startIndex: number;
  endIndex: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForMatch(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Build section boundaries from Level-1 titles (already normalized: no dot leaders/page numbers).
 * fullText = deterministic concatenation of chunk text. Matches clean ALL CAPS heading line (normalized whitespace).
 */
export function buildSectionBoundaries(fullText: string, sectionTitles: string[]): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];
  const lines = fullText.split(/\r?\n/);
  const textLength = fullText.length;

  for (const title of sectionTitles) {
    const cleanTitle = normalizeForMatch((title ?? "").trim());
    if (!cleanTitle) continue;

    let startIndex = -1;
    for (let i = 0, pos = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (normalizeForMatch(line) === cleanTitle) {
        startIndex = pos;
        break;
      }
      pos += line.length + 1;
    }
    if (startIndex < 0) {
      const escaped = escapeRegExp(cleanTitle);
      const onOwnLine = new RegExp(`^\\s*${escaped}\\s*$`, "im");
      for (let i = 0, pos = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (onOwnLine.test(line)) {
          startIndex = pos;
          break;
        }
        pos += line.length + 1;
      }
    }
    if (startIndex < 0) {
      const anywhere = new RegExp(escapeRegExp(cleanTitle), "i");
      const idx = fullText.search(anywhere);
      if (idx >= 0) startIndex = idx;
    }
    if (startIndex < 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[toc] section title not found in text:", JSON.stringify(cleanTitle.slice(0, 60)));
      }
      continue;
    }
    boundaries.push({ title: cleanTitle, startIndex, endIndex: textLength });
  }

  boundaries.sort((a, b) => a.startIndex - b.startIndex);
  for (let i = 0; i < boundaries.length - 1; i++) {
    boundaries[i].endIndex = boundaries[i + 1].startIndex;
  }
  return boundaries;
}

// ---------------------------------------------------------------------------
// Vital elements from section body (subheadings + template bullets)
// ---------------------------------------------------------------------------

export type VitalElement = { title: string; locator_type: "heading" | "template_bullet"; locator: string };

const MAX_VITALS_PER_SECTION = 10;
const MIN_TITLE_LENGTH = 4;
const MAX_TITLE_LENGTH = 120;
const BULLET_PATTERN = /^\s*(?:-|\u2022|•)\s+(.{6,160})$/;
const MARKER_LINE = /include.*(?:plan|template|consider)|(?:plan|template|consider).*include/i;
const NOISE = /^The facility has|^Source:|\.{10,}/i;

function normalizeVitalTitle(s: string): string {
  return (s ?? "").trim().replace(/\s*[:.]\s*$/, "").replace(/\s+/g, " ").trim();
}

function isMostlyCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  const upper = s.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.8;
}

function wordCount(s: string): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extract vital elements from a section body: subheadings (ALL CAPS or Title: style) and template bullets. Deterministic, no LLM.
 */
export function extractVitalElementsFromSectionBody(sectionText: string): VitalElement[] {
  const vitals: VitalElement[] = [];
  const seen = new Set<string>();
  const lines = (sectionText ?? "").split(/\r?\n/);

  let markerSeen = false;
  let linesSinceMarker = 0;
  const BULLET_WINDOW = 30;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (MARKER_LINE.test(trimmed)) {
      markerSeen = true;
      linesSinceMarker = 0;
    }
    if (markerSeen) linesSinceMarker++;

    if (trimmed.length >= MIN_TITLE_LENGTH && trimmed.length <= MAX_TITLE_LENGTH) {
      if (/^\.+$/.test(trimmed) || NOISE.test(trimmed)) continue;
      const dotCount = (trimmed.match(/\./g)?.length ?? 0);
      if (dotCount / trimmed.length > 0.5) continue;
      const prevBlank = i === 0 || (lines[i - 1] ?? "").trim() === "";
      const nextBlank = i === lines.length - 1 || (lines[i + 1] ?? "").trim() === "";
      if (!prevBlank && !nextBlank) continue;
      const normalized = normalizeVitalTitle(trimmed);
      if (!normalized || normalized.length < 8) continue;
      const isCaps = isMostlyCaps(normalized);
      const endsWithColon = /:\s*$/.test(trimmed);
      if (!isCaps && !endsWithColon) continue;
      if (wordCount(normalized) < 3 && !isCaps) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      vitals.push({ title: normalized, locator_type: "heading", locator: normalized });
      if (vitals.length >= MAX_VITALS_PER_SECTION) return vitals;
    }

    if (markerSeen && linesSinceMarker <= BULLET_WINDOW) {
      const bulletMatch = line.match(BULLET_PATTERN);
      if (bulletMatch) {
        const normalized = normalizeVitalTitle(bulletMatch[1]);
        if (normalized && wordCount(normalized) >= 2) {
          const key = normalized.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            vitals.push({ title: normalized, locator_type: "template_bullet", locator: normalized });
            if (vitals.length >= MAX_VITALS_PER_SECTION) return vitals;
          }
        }
      }
    }
  }

  return vitals;
}
