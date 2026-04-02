/**
 * Strict TOC/heading extraction from requirement chunks.
 * Trust mode: TOC (TOC only), INFERRED (headings only), BALANCED (TOC + guarded headings).
 */

import type { PlanStructureTrust } from "./structure_trust";

export type ExtractedSection = {
  section_title: string;
  section_key: string;
  confidence: "TOC" | "HEADING_REPEAT" | "NUMBERED";
};

/** Legacy stub type for callers that only need title/key. */
export interface TocSectionStub {
  section_title: string;
  section_key: string;
}

/** Top-level TOC entry (1–10 or 1–N contiguous). Used to seed sections when TOC exists. */
export type TocTopLevelEntry = {
  level: 1;
  number: number;
  title: string;
  pageToken: string;
  rawLine: string;
};

/** TOC entry with numbering depth (Level 1 = section, Level 2+ = element under parent). */
export type TocEntry = {
  rawLine: string;
  /** "6", "6.1", "10.2.3"; null for non-numbered entries. */
  numbering: string | null;
  /** 1 for "6", 2 for "6.1", etc.; 0 for non-numbered. */
  depth: number;
  title: string;
  pageToken: string | null;
};

function slugify(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80) || "section";
}

function normalizeWhitespace(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ").trim();
}

/** Normalize title for matching: remove punctuation, collapse whitespace, lowercase. Used to map headings into TOC sections. */
export function normalizeTitleForMatch(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Common truncation endings: drop lines that end with these. */
const TRUNCATION_ENDINGS = [" an", " the", " of", " and", " or", " to", " in", " on", " at", " for", " with"];
function isTruncatedFragment(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (lower.length < 8) return true;
  for (const end of TRUNCATION_ENDINGS) {
    if (lower.endsWith(end)) return true;
  }
  if (/\s(an|the|of|and|or|to|in|on|at|for|with)\s*$/i.test(lower)) return true;
  return false;
}

/** Sentence punctuation in body (reject prose). Ignore period after leading number e.g. "1. Title". */
function hasSentencePunctuation(line: string): boolean {
  const withoutLeadingNum = line.replace(/^\s*\d+\.\s*/, "");
  return /[.!?]/.test(withoutLeadingNum);
}

/** Forbidden line endings (not headings). */
const BAD_ENDINGS = /[.,]\s*$|\.\.\.\s*$|[,–—]\s*$/;
function hasBadEnding(line: string): boolean {
  return BAD_ENDINGS.test(line.trim());
}

/** Numbered heading: "1. Title" or "10. Title" — capture title. */
const NUMBERED_TOPLEVEL = /^\s*(\d{1,2})\.\s+([A-Za-z].+?)\s*$/;
/** Appendix lines: skip as main sections. */
const APPENDIX_LINE = /^\s*(?:Appendix|APPENDIX)\s+/i;

const MIN_SECTION_NUM = 1;
const MAX_SECTION_NUM = 20;
const MAX_TOC_LINES = 200;
const MIN_HEADING_LEN = 8;
const MAX_HEADING_LEN = 90;

/**
 * Check if a candidate heading line (no TOC) satisfies strict rules.
 * Length 8–90, no bad endings, no sentence punctuation; numbered or ALL CAPS with minimal punctuation.
 * Narrative check only for non-numbered lines (numbered headings are reference-like).
 */
function isStrictCandidateHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < MIN_HEADING_LEN || trimmed.length > MAX_HEADING_LEN) return false;
  if (hasBadEnding(trimmed)) return false;
  if (hasSentencePunctuation(trimmed)) return false;
  if (isTruncatedFragment(trimmed)) return false;
  const isNumbered = /^\s*\d+\.\s+\S/.test(trimmed);
  if (!isNumbered && hasNarrativeSignal(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  if (isNumbered) return true;

  // ALL CAPS with minimal punctuation
  if (trimmed !== trimmed.toUpperCase()) return false;
  const punctCount = (trimmed.match(/[:\/()]/g) ?? []).length;
  if (punctCount > 1) return false;
  return true;
}

const MIN_TOC_SECTIONS = 3;
/** TOC mode (trust=TOC): require at least this many TOP-level entries. */
const MIN_TOC_TOP_ENTRIES = 5;
const TOC_BOUNDED_WINDOW_CHUNKS = 8;
const TOC_CONSECUTIVE_NON_ENTRY_STOP = 8;
/** Require at least this many TOP entries in first N lines after marker, else treat as false positive. */
const TOC_MARKER_PROBE_LINES = 40;
const TOC_MARKER_MIN_TOP_IN_PROBE = 5;
/** Marker phrases for bounded TOC (case-insensitive). */
const TOC_MARKERS_BOUNDED = ["table of contents", "contents"];
/** Normalized marker strings for fuzzy search (no spaces). */
const _MARKERS_NORMALIZED = ["tableofcontents", "contents"];
/** Generic/junk section titles to exclude from results. */
const TOC_JUNK_TITLES = ["table of contents", "contents", "instructional guide", "toc", "index"];

/** Normalize text for fuzzy TOC marker detection: lowercase, collapse all whitespace and strip non-alphanumeric. */
function normalizeForMarker(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Normalize line for repeater detection: lowercase, strip digits, collapse whitespace, remove punctuation. */
function normalizeForRepeater(line: string): string {
  return (line ?? "")
    .toLowerCase()
    .replace(/\d/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?'"()[\]\-–—/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const REPEATER_MIN_OCCURRENCES = 6;
const REPEATER_SCAN_CHUNKS = 40;

/** Build set of lines that repeat across many chunks (headers/footers). Used to reject them in TOC parsing. */
function buildRepeaterLineSet(chunks: string[]): Set<string> {
  const countBySig = new Map<string, number>();
  const scan = Math.min(REPEATER_SCAN_CHUNKS, chunks.length);
  for (let i = 0; i < scan; i++) {
    const chunk = chunks[i] ?? "";
    const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const seenThisChunk = new Set<string>();
    for (const line of lines) {
      const sig = normalizeForRepeater(line);
      if (sig.length < 10) continue;
      if (!seenThisChunk.has(sig)) {
        seenThisChunk.add(sig);
        countBySig.set(sig, (countBySig.get(sig) ?? 0) + 1);
      }
    }
  }
  const out = new Set<string>();
  for (const [sig, count] of countBySig) {
    if (count >= REPEATER_MIN_OCCURRENCES) out.add(sig);
  }
  return out;
}

/** True if chunk has TOC-like reference density (dot leaders, trailing page numbers, numbered lines). */
function looksLikeTocChunk(raw: string): boolean {
  const t = raw ?? "";
  const hasDotLeaders = /\.{2,}/.test(t);
  const hasTrailingNums = /\n.*\d+\s*$/m.test(t) || /\s+\d+\s*$/.test(t);
  const hasNumbered = /^\s*\d+(\.\d+)*\s+\S/m.test(t);
  const score = (hasDotLeaders ? 1 : 0) + (hasTrailingNums ? 1 : 0) + (hasNumbered ? 1 : 0);
  return score >= 2;
}

/**
 * Find TOC marker in raw chunk text (fuzzy: survives line breaks, multiple spaces, spaced letters).
 * Returns chunk index and normalized marker; "contents" only accepted if chunk looks like TOC.
 */
function findTocMarker(chunks: string[]): { chunkIndex: number; marker: string } | null {
  for (let i = 0; i < chunks.length; i++) {
    const raw = chunks[i] ?? "";
    const norm = normalizeForMarker(raw);
    const idxToc = norm.indexOf("tableofcontents");
    if (idxToc >= 0) return { chunkIndex: i, marker: "tableofcontents" };
    const idxContents = norm.indexOf("contents");
    if (idxContents >= 0 && looksLikeTocChunk(raw)) return { chunkIndex: i, marker: "contents" };
  }
  return null;
}

/** TOC trust failure codes for actionable 400 responses. */
export const PLAN_TOC_NOT_FOUND = "PLAN_TOC_NOT_FOUND";
export const PLAN_TOC_TOO_SMALL = "PLAN_TOC_TOO_SMALL";
export const PLAN_TOC_REQUIRES_TEMPLATE = "PLAN_TOC_REQUIRES_TEMPLATE";
export const PLAN_TOC_NORMALIZATION_FAILED = "PLAN_TOC_NORMALIZATION_FAILED";
/** When TOC was used (>=5 top-level) but final schema sections dropped one or more TOC titles. */
export const PLAN_SCHEMA_TOC_SEED_DROPPED = "PLAN_SCHEMA_TOC_SEED_DROPPED";

export type PlanTocDebug = {
  tocFound?: boolean;
  markerText?: string;
  markerChunkIndex?: number;
  markerLineIndex?: number;
  windowSize?: number;
  acceptedCount?: number;
  markersSearched?: string[];
  densityTriggered?: boolean;
  clusterFound?: boolean;
  markerFound?: boolean;
  bestWindow?: { candidates: number; references: number; startLineIndex: number };
  sampleRejectedLines?: Array<{ line: string; reason: string }>;
  tocLinesParsed?: number;
  topEntriesAccepted?: number;
  subEntriesSeen?: number;
  rejectedReasonsHistogram?: Record<string, number>;
  chunksScanned?: number;
  bestClusterCounts?: { candidates: number; references: number; startLineIndex: number };
  acceptedTopLevel?: number;
  acceptedSubRejected?: number;
  rejectedExamples?: number;
  rejectedNarrative?: number;
  rejectedTooLong?: number;
  rejectLowDiversity?: boolean;
  acceptedEntrySample?: string[];
};

export class PlanTocTrustError extends Error {
  code: string;
  debug?: PlanTocDebug;
  constructor(code: string, message: string, debug?: PlanTocDebug) {
    super(message);
    this.name = "PlanTocTrustError";
    this.code = code;
    this.debug = debug;
  }
}

const TOC_MARKERS = ["table of contents", "contents", "toc", "index"];

/** Case-insensitive: true if line looks like a TOC section header (whole line or line starts with marker). */
export function isTocMarker(text: string): boolean {
  const t = (text ?? "").trim().toLowerCase();
  return TOC_MARKERS.some((m) => t === m || t.startsWith(m + " ") || t.startsWith(m + "\n"));
}

/** Result of normalizing a TOC line (A1). */
export type NormalizedTocLine = { raw: string; normalized: string; strippedPageToken?: string | null };

/**
 * Strip trailing page tokens and dot leaders using regex only (no index/slice).
 * Prevents off-by-one truncation (e.g. "Internal..." -> "ternal...").
 */
function stripTrailingPageTokenAndDotLeadersRegexOnly(t: string): string {
  let s = (t ?? "").trim().replace(/\s+/g, " ");
  s = s.replace(/\s+\d+-\d+\s*$/, "");
  s = s.replace(/\s+[A-Z]-\d+\s*$/i, "");
  s = s.replace(/\.{2,}\s*\d+\s*$/, " ");
  s = s.replace(/\s+\d+\s*$/, "");
  s = s.replace(/\s+[ivxlcdm]+\s*$/i, "");
  s = s.replace(/\.{2,}/g, " ");
  s = s.replace(/[,;:]\s*$/, "");
  return s.trim().replace(/\s+/g, " ");
}

/** A1) Normalize a line: trim, collapse whitespace, strip dot leaders, trailing page tokens, trailing punctuation. */
function normalizeTocLineExtended(raw: string): NormalizedTocLine {
  const rawTrim = (raw ?? "").trim().replace(/\s+/g, " ");
  let s = stripTrailingPageTokenAndDotLeadersRegexOnly(rawTrim);
  let strippedPageToken: string | null = null;
  const pageNumMatch = rawTrim.match(/\s+(\d+)\s*$/);
  if (pageNumMatch) strippedPageToken = pageNumMatch[1];
  else {
    const romanMatch = rawTrim.match(/\s+([ivxlcdm]+)\s*$/i);
    if (romanMatch) strippedPageToken = romanMatch[1];
    else {
      const a3Match = rawTrim.match(/\s+([A-Z]-\d+)\s*$/i);
      if (a3Match) strippedPageToken = a3Match[1];
      else {
        const rangeMatch = rawTrim.match(/\s+(\d+-\d+)\s*$/);
        if (rangeMatch) strippedPageToken = rangeMatch[1];
      }
    }
  }
  // Safety: if raw starts with a letter and cleaned looks like raw without first char, redo with regex-only (no slice).
  if (/^[A-Za-z]/.test(rawTrim) && s.length > 0 && rawTrim.slice(1).startsWith(s)) {
    s = stripTrailingPageTokenAndDotLeadersRegexOnly(rawTrim);
  }
  return { raw: (raw ?? "").trim(), normalized: s, strippedPageToken };
}

/** A2) Reference signals: dot leaders, trailing page token, numbering prefix. */
function hasReferenceSignal(raw: string, normalized: string): boolean {
  if (/\.{2,}/.test(raw)) return true;
  if (/\s+\d+\s*$/.test(raw)) return true;
  if (/\s+[ivxlcdm]+\s*$/i.test(raw)) return true;
  if (/\s+[A-Z]-\d+\s*$/.test(raw)) return true;
  if (/\s+\d+-\d+\s*$/.test(raw)) return true;
  if (/^\s*(\d+(\.\d+)*)\s+/.test(normalized)) return true;
  return false;
}

/** Max top-level section number to keep (1..N contiguous from 1). */
const TOC_TOP_LEVEL_MAX_NUM = 20;

/**
 * Parse top-level numbered TOC lines (1., 2., … 10.). After normalizing dot leaders and page tokens:
 * - Accept lines matching: optional space, number, period, space, title; optional trailing page token in raw.
 * - Reject sub-entries (1.1, 2.3). Keep only 1..N contiguous starting from 1 (cap at TOC_TOP_LEVEL_MAX_NUM).
 * Returns entries in TOC order.
 */
export function parseTocTopLevel(
  lines: string[],
  startIdx: number = 0,
  maxLines: number = 120
): TocTopLevelEntry[] {
  const byNum = new Map<number, TocTopLevelEntry>();
  const end = Math.min(lines.length, startIdx + maxLines);

  for (let i = startIdx; i < end; i++) {
    const rawLine = (lines[i] ?? "").trim();
    if (!rawLine) continue;

    const { normalized, strippedPageToken } = normalizeTocLineExtended(rawLine);
    // Top-level only: single number prefix (no 1.1, 2.3)
    const match = normalized.match(/^\s*(\d+)\.\s+(.+)\s*$/);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (num < 1 || num > TOC_TOP_LEVEL_MAX_NUM) continue;
    if (/^\d+\.\d+/.test(normalized)) continue; // reject "1.1 Title"
    const title = normalizeWhitespace(match[2]);
    if (title.length < 4) continue;
    if (isTruncatedFragment(title)) continue; // drop truncated fragments (e.g. ending with AN, THE, OF)
    if (byNum.has(num)) continue; // first occurrence wins
    byNum.set(num, {
      level: 1,
      number: num,
      title,
      pageToken: strippedPageToken ?? "",
      rawLine,
    });
  }

  // Keep 1..N contiguous from 1
  const out: TocTopLevelEntry[] = [];
  for (let n = 1; n <= TOC_TOP_LEVEL_MAX_NUM; n++) {
    const e = byNum.get(n);
    if (!e) break;
    out.push(e);
  }
  return out;
}

/**
 * Get top-level TOC entries (1–N) from chunk texts when a TOC marker is present.
 * Returns entries when >= MIN_TOC_TOP_ENTRIES contiguous from 1; otherwise empty array.
 */
export function getTocTopLevelFromChunks(chunkTexts: string[]): TocTopLevelEntry[] {
  const fullText = (chunkTexts ?? [])
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  if (!fullText) return [];
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isTocMarker(lines[i] ?? "")) {
      startIdx = i + 1;
      break;
    }
  }
  const tocTop = parseTocTopLevel(lines, startIdx, 120);
  return tocTop.length >= MIN_TOC_TOP_ENTRIES ? tocTop : [];
}

/** Numbered TOC line after normalization: optional space, numbering (e.g. 6 or 6.1), optional period, space, title. */
const TOC_NUMBERED_NORMALIZED = /^\s*(\d+(?:\.\d+)*)\.?\s+(.+)\s*$/;
const MAX_TOC_ENTRY_DEPTH = 5;

/**
 * Parse TOC lines with numbering depth. Level 1 => section, Level 2+ => element under nearest Level 1.
 * After dot-leader normalization: match numbering and title; pageToken from raw line.
 * Optionally accept non-numbered entries (e.g. "Plan Approval") as depth 0.
 * Returns entries in document order.
 */
export function parseTocEntriesWithDepth(
  lines: string[],
  startIdx: number = 0,
  maxLines: number = 150
): TocEntry[] {
  const entries: TocEntry[] = [];
  const end = Math.min(lines.length, startIdx + maxLines);

  for (let i = startIdx; i < end; i++) {
    const rawLine = (lines[i] ?? "").trim();
    if (!rawLine) continue;

    const { normalized, strippedPageToken } = normalizeTocLineExtended(rawLine);
    const numberedMatch = normalized.match(TOC_NUMBERED_NORMALIZED);
    if (numberedMatch) {
      const numbering = numberedMatch[1].trim();
      const title = normalizeWhitespace(numberedMatch[2]);
      if (title.length < 4 || isTruncatedFragment(title)) continue;
      const depth = numbering.split(".").length;
      if (depth > MAX_TOC_ENTRY_DEPTH) continue;
      entries.push({
        rawLine,
        numbering,
        depth,
        title,
        pageToken: strippedPageToken ?? null,
      });
      continue;
    }
    // Optional non-numbered structural entry (e.g. "Plan Approval", "Appendix A")
    if (normalized.length >= 6 && normalized.length <= 90 && !hasNarrativeSignal(normalized)) {
      const hasRef = hasReferenceSignal(rawLine, normalized);
      if (hasRef || normalized === normalized.toUpperCase()) {
        entries.push({
          rawLine,
          numbering: null,
          depth: 0,
          title: normalized,
          pageToken: strippedPageToken ?? null,
        });
      }
    }
  }
  return entries;
}

/**
 * Get full TOC entries (with depth) from chunk texts when a TOC marker is present.
 * Use for schema derivation: sections = depth 1, elements = depth >= 2 under parent.
 */
export function getTocEntriesFromChunks(chunkTexts: string[]): TocEntry[] {
  const fullText = (chunkTexts ?? [])
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  if (!fullText) return [];
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isTocMarker(lines[i] ?? "")) {
      startIdx = i + 1;
      break;
    }
  }
  return parseTocEntriesWithDepth(lines, startIdx, 150);
}

/** A3) Narrative signals: instructional/modal starts and verbs, sentence punctuation, long comma-separated. */
function hasNarrativeSignal(normalized: string): boolean {
  let t = normalized.trim();
  t = t.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, ""); // ignore numbering prefix (e.g. "1. " or "1.2.3 ") for punctuation check
  if (/^(when|if|after|before|during)\s+/i.test(t)) return true;
  if (/\b(will|should|must|shall|may)\b/i.test(t)) return true;
  if (/\b(plan|use|follow|avoid|relocate|determine|establish|assess)\b/i.test(t)) return true;
  if (/\b(thoughtfully|carefully|properly|appropriately)\s*$/i.test(t)) return true;
  if (/[.?!]/.test(t)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (normalized.includes(",") && words.length > 10) return true;
  return false;
}

function isAllCapsTitle(normalized: string): boolean {
  if (normalized !== normalized.toUpperCase()) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length >= 2;
}

const MIN_TOC_WORDS = 2;
const MAX_TOC_WORDS = 14;

/** A4) TOC-like title candidate: word count 2–14, length 8–90, not narrative, and (reference OR allCaps OR numbering). */
export function isTocTitleCandidate(line: string): boolean {
  const { raw, normalized } = normalizeTocLineExtended(line);
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount < MIN_TOC_WORDS || wordCount > MAX_TOC_WORDS) return false;
  if (normalized.length < MIN_HEADING_LEN || normalized.length > MAX_HEADING_LEN) return false;
  if (hasNarrativeSignal(normalized)) return false;
  const ref = hasReferenceSignal(raw, normalized);
  const allCaps = isAllCapsTitle(normalized);
  const numbering = /^\s*(\d+(\.\d+)*)\s+/.test(normalized);
  return ref || allCaps || numbering;
}

/** Reason a line was rejected (for diagnostics). */
export function rejectReasonTocLine(line: string): "narrative" | "format" | null {
  const { normalized } = normalizeTocLineExtended(line);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < MIN_TOC_WORDS || words.length > MAX_TOC_WORDS) return "format";
  if (normalized.length < MIN_HEADING_LEN || normalized.length > MAX_HEADING_LEN) return "format";
  if (hasNarrativeSignal(normalized)) return "narrative";
  const ref = hasReferenceSignal(line.trim(), normalized);
  const allCaps = isAllCapsTitle(normalized);
  const numbering = /^\s*(\d+(\.\d+)*)\s+/.test(normalized);
  if (ref || allCaps || numbering) return null;
  return "format";
}

/** Truncated endings for TOC titles (reject). */
const TOC_TRUNCATED_WORD_ENDINGS = /\s+(AN|THE|OF|AND)\s*$|,\s*$/i;

const MAX_TOC_TITLE_LENGTH = 90;
const MAX_TOC_TITLE_WORDS = 12;

/**
 * Split a line that may contain multiple TOC entries (e.g. "... 30 10. TRAINING ...").
 * Splits when a new numbered entry pattern appears: \d+\.\s+[A-Za-z]
 */
function splitPotentialMultiEntries(rawLine: string): string[] {
  const s = (rawLine ?? "").trim();
  if (!s) return [];
  const normalized = s.replace(/\.{2,}/g, " ").replace(/\s+/g, " ").trim();
  const parts = normalized.split(/\s+(?=\d+\.\s+[A-Za-z])/);
  if (parts.length <= 1) return [s];
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Parse trailing page token from raw segment (regex-only, no index/slice).
 * Accepts: " ... 31", " ... iv", " ... A-3", " ... 12-13", "Title .... 5", "Title.....5" (dot leaders + page).
 * Returns { pageToken, stem } with stem normalized (no trailing page token).
 */
function parseTrailingPageToken(raw: string): { pageToken: string | null; stem: string } {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  let pageToken: string | null = null;
  const rangeMatch = s.match(/\s+(\d+-\d+)\s*$/);
  if (rangeMatch) pageToken = rangeMatch[1];
  else {
    const a3Match = s.match(/\s+([A-Z]-\d+)\s*$/i);
    if (a3Match) pageToken = a3Match[1];
    else {
      const dotPageMatch = s.match(/\.{2,}\s*(\d+)\s*$/);
      if (dotPageMatch) pageToken = dotPageMatch[1];
      else {
        const pageNumMatch = s.match(/\s+(\d+)\s*$/);
        if (pageNumMatch) pageToken = pageNumMatch[1];
        else {
          const romanMatch = s.match(/\s+([ivxlcdm]+)\s*$/i);
          if (romanMatch) pageToken = romanMatch[1];
        }
      }
    }
  }
  let stem = stripTrailingPageTokenAndDotLeadersRegexOnly(s);
  // Safety: if raw (trimmed) starts with letter and stem looks like s without first char, redo with regex-only.
  if (/^[A-Za-z]/.test(s) && stem.length > 0 && s.slice(1).startsWith(stem)) {
    stem = stripTrailingPageTokenAndDotLeadersRegexOnly(s);
  }
  return { pageToken, stem };
}

/** Strip trailing page tokens (A-3, 12-13, 12, roman) from a segment. */
function stripPageTokensFromSegment(segment: string): string {
  let t = segment.replace(/\.{2,}/g, " ").replace(/\s+/g, " ").trim();
  let prev: string;
  do {
    prev = t;
    t = t.replace(/\s+[A-Z]-\d+\s*$/, "").replace(/\s+\d+\s*-\s*\d+\s*$/, "").replace(/\s+\d+\s*$/, "").replace(/\s+[ivxlcdm]+\s*$/i, "");
    t = t.trim().replace(/\s+/g, " ");
  } while (t !== prev);
  return t;
}

/** Hard-reject keywords (case-insensitive). */
const TOC_REJECT_CONTAINS = ["example", "figure", "table", "resource", "appendix", "instructional guide"];
/** Reject "instructional guide" only when title is not top-level numbered (handled in caller). */

/** Tokens that indicate document title fragment (not a real TOC section). */
const DOC_TITLE_FRAGMENT_TOKENS = [
  "instructional",
  "guide",
  "cisa",
  "active",
  "assailant",
  "emergency",
  "action",
  "plan",
  "template",
];

/** Topic diversity: require at least this many distinct significant words beyond stopwords. */
const MIN_DISTINCT_TOPIC_WORDS = 6;
/** Stopwords excluded from topic diversity count. */
const TOPIC_DIVERSITY_STOPWORDS = new Set([
  "active",
  "assailant",
  "cisa",
  "template",
  "instructional",
  "guide",
  "emergency",
  "action",
  "plan",
]);

function isDocTitleFragment(title: string, isNumbered: boolean): boolean {
  if (isNumbered || (title ?? "").length >= 40) return false;
  const lower = title.trim().toLowerCase();
  let count = 0;
  for (const tok of DOC_TITLE_FRAGMENT_TOKENS) {
    if (lower.includes(tok)) count++;
  }
  return count >= 3;
}

function countDistinctTopicWordsBeyondStopwords(titles: string[]): number {
  const significant = new Set<string>();
  for (const title of titles) {
    const words = (title ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (w.length >= 5 && !TOPIC_DIVERSITY_STOPWORDS.has(w)) significant.add(w);
    }
  }
  return significant.size;
}

/** Cluster mode: accept stem length/word bounds (no ALL CAPS or numbering required). */
const CLUSTER_STEM_MIN_LEN = 8;
const CLUSTER_STEM_MAX_LEN = 110;
const CLUSTER_STEM_MIN_WORDS = 2;
const CLUSTER_STEM_MAX_WORDS = 16;

/** Check if line looks like narrative (reject in cluster mode too). */
function isNarrativeForCluster(stem: string): boolean {
  const t = stem.trim();
  if (/[.?!]/.test(t)) return true;
  if (/^(when|if|after|before|during)\s+/i.test(t)) return true;
  if (/\b(will|should|must|shall|may)\b/i.test(t)) return true;
  if (t.includes("●")) return true;
  return false;
}

/** Check if next line is only a page token (e.g. "31" or "iv"). */
function isOnlyPageToken(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^\d+$/.test(t) || /^[ivxlcdm]+$/i.test(t) || /^[A-Z]-\d+$/i.test(t) || /^\d+-\d+$/.test(t);
}

/** Check if line looks like continuation of previous (no page ref; starts lowercase or and/of/to/for; not narrative). */
function looksLikeContinuation(line: string): boolean {
  const t = line.trim();
  if (!t || isNarrativeForCluster(t)) return false;
  const first = t[0];
  if (first === first.toLowerCase()) return true;
  if (/^(and|of|to|for)\s+/i.test(t)) return true;
  return false;
}

/** Reduce to top-level: drop <=2-word entries that are substrings of a longer entry; keep only depth-1 numbering if present. */
function reduceToTopLevelSections(entries: ExtractedSection[]): ExtractedSection[] {
  const titles = entries.map((e) => e.section_title);
  const kept: ExtractedSection[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const words = e.section_title.split(/\s+/).filter(Boolean);
    if (words.length <= 2) {
      const lower = e.section_title.toLowerCase();
      const isSubstringOfLonger = titles.some(
        (t, j) => j !== i && t.length > e.section_title.length && t.toLowerCase().includes(lower)
      );
      if (isSubstringOfLonger) continue;
    }
    kept.push(e);
  }
  return kept;
}

/**
 * Parse TOC from a cluster window (markerFound=false).
 * - Accept lines with trailing page token; ignore indentation.
 * - Join wrapped lines (continuation lines appended to previous).
 * - Attach orphan page token from next line when current has no page ref.
 * - Apply non-narrative rejects only; no SUB for indentation.
 */
function parseTocFromClusterWindow(
  lines: string[],
  startIdx: number,
  repeaterSet: Set<string>
): {
  sections: ExtractedSection[];
  acceptedEntrySample: string[];
  rejectedReasonsHistogram: Record<string, number>;
} {
  const acceptedStems: string[] = [];
  const rejectedReasonsHistogram: Record<string, number> = {};
  const seenKeys = new Set<string>();
  const maxLines = Math.min(lines.length, startIdx + 200);
  let pendingTitle: string | null = null;

  function recordReject(reason: string): void {
    rejectedReasonsHistogram[reason] = (rejectedReasonsHistogram[reason] ?? 0) + 1;
  }

  function acceptStem(stem: string): void {
    const title = stem.replace(TOC_TRUNCATED_WORD_ENDINGS, "").trim().replace(/\s+/g, " ");
    if (title.length < 6) return;
    const lower = title.toLowerCase();
    for (const kw of TOC_REJECT_CONTAINS) {
      if (lower.includes(kw)) {
        recordReject("REJECT_EXAMPLE");
        return;
      }
    }
    if (repeaterSet.has(normalizeForRepeater(title))) {
      recordReject("REJECT_REPEATER_HEADER");
      return;
    }
    if (isDocTitleFragment(title, false)) {
      recordReject("REJECT_DOC_TITLE_FRAGMENT");
      return;
    }
    const key = slugify(title);
    if (seenKeys.has(key)) {
      recordReject("REJECT_DUPLICATE");
      return;
    }
    seenKeys.add(key);
    acceptedStems.push(title);
  }

  for (let i = startIdx; i < maxLines; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line) {
      if (pendingTitle) acceptStem(pendingTitle);
      pendingTitle = null;
      continue;
    }

    const segments = splitPotentialMultiEntries(line);
    const toProcess = segments.length >= 1 ? segments : [line];

    for (let segIdx = 0; segIdx < toProcess.length; segIdx++) {
      const raw = toProcess[segIdx] ?? "";
      let pageTokenFromNext: string | null = null;
      const nextLineIdx = segIdx === toProcess.length - 1 ? i + 1 : -1;
      if (nextLineIdx >= 0 && nextLineIdx < lines.length) {
        const nextLine = (lines[nextLineIdx] ?? "").trim();
        if (isOnlyPageToken(nextLine)) {
          pageTokenFromNext = nextLine;
          i = nextLineIdx;
        }
      }

      const { pageToken, stem: rawStem } = parseTrailingPageToken(raw);
      const hasPageRef = pageToken !== null || pageTokenFromNext !== null;
      const stem = rawStem.replace(/\.{2,}/g, " ").trim().replace(/\s+/g, " ");

      if (!hasPageRef && pendingTitle && looksLikeContinuation(stem)) {
        pendingTitle = (pendingTitle + " " + stem).replace(/\s+/g, " ").trim();
        continue;
      }

      if (hasPageRef) {
        const wordCount = stem.split(/\s+/).filter(Boolean).length;
        if (
          stem.length >= CLUSTER_STEM_MIN_LEN &&
          stem.length <= CLUSTER_STEM_MAX_LEN &&
          wordCount >= CLUSTER_STEM_MIN_WORDS &&
          wordCount <= CLUSTER_STEM_MAX_WORDS
        ) {
          if (!isNarrativeForCluster(stem)) {
            if (pendingTitle) acceptStem(pendingTitle);
            acceptStem(stem);
            pendingTitle = null;
          } else recordReject("REJECT_NARRATIVE");
        } else recordReject("REJECT_FORMAT");
      } else {
        if (pendingTitle && looksLikeContinuation(stem)) {
          pendingTitle = (pendingTitle + " " + stem).replace(/\s+/g, " ").trim();
        } else if (pendingTitle) {
          acceptStem(pendingTitle);
          pendingTitle = null;
        }
      }
    }
  }
  if (pendingTitle) acceptStem(pendingTitle);

  const sections: ExtractedSection[] = acceptedStems.map((title) => ({
    section_title: title,
    section_key: slugify(title),
    confidence: "TOC" as const,
  }));

  const reduced = reduceToTopLevelSections(sections);
  const acceptedEntrySample = acceptedStems.slice(0, 10);

  return {
    sections: reduced,
    acceptedEntrySample,
    rejectedReasonsHistogram,
  };
}

/** Parse TOP-level sections from a bounded window (used for marker path only). */
function _parseBoundedTocFromWindow(
  allWindowLines: string[],
  startIdx: number,
  repeaterSet: Set<string>,
  options: { probeOnly?: number }
): {
  sections: ExtractedSection[];
  rejectedReasonsHistogram: Record<string, number>;
  tocLinesParsed: number;
  subEntriesSeen: number;
  rejectedExamples: number;
  rejectedNarrative: number;
  rejectedTooLong: number;
} {
  const sections: ExtractedSection[] = [];
  const seenKeys = new Set<string>();
  const rejectedReasonsHistogram: Record<string, number> = {};
  let consecutiveNonEntry = 0;
  let tocLinesParsed = 0;
  let subEntriesSeen = 0;
  let rejectedExamples = 0;
  let rejectedNarrative = 0;
  let rejectedTooLong = 0;
  const probeOnly = options.probeOnly;
  const maxLineIndex = allWindowLines.length;

  function recordReject(reason: string): void {
    rejectedReasonsHistogram[reason] = (rejectedReasonsHistogram[reason] ?? 0) + 1;
  }

  function isJunkOrInvalid(title: string): boolean {
    const lower = title.toLowerCase().trim();
    if (TOC_JUNK_TITLES.some((j) => lower === j || lower.startsWith(j + " "))) return true;
    if (/^\d+$/.test(title.trim()) || /\s\d+\s*$/.test(title)) return true;
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length === 1 && title.length < 25) return true;
    return false;
  }

  for (let i = startIdx; i < maxLineIndex && consecutiveNonEntry < TOC_CONSECUTIVE_NON_ENTRY_STOP; i++) {
    if (probeOnly !== undefined && i >= startIdx + probeOnly) break;
    const line = allWindowLines[i] ?? "";
    tocLinesParsed++;

    const segments = splitPotentialMultiEntries(line);
    const toProcess = segments.length >= 1 ? segments : [line];

    for (const segment of toProcess) {
      const parsed = cleanTocLine(segment, repeaterSet);
      if (parsed.rejectReason === "REJECT_REPEATER_HEADER") {
        recordReject("REJECT_REPEATER_HEADER");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.rejectReason === "REJECT_EXAMPLE") {
        rejectedExamples++;
        recordReject("REJECT_EXAMPLE");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.rejectReason === "REJECT_NARRATIVE") {
        rejectedNarrative++;
        recordReject("REJECT_NARRATIVE");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.rejectReason === "REJECT_TOO_LONG") {
        rejectedTooLong++;
        recordReject("REJECT_TOO_LONG");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.level === "SUB") {
        subEntriesSeen++;
        recordReject("REJECT_SUB");
        consecutiveNonEntry = 0;
        continue;
      }
      if (!parsed.title || !parsed.level) {
        if (segment.length > 0) recordReject(parsed.rejectReason ?? "REJECT_FORMAT");
        consecutiveNonEntry++;
        continue;
      }

      if (parsed.level === "TOP") {
        let title = parsed.title;
        const segmentIsNumbered = /^\s*\d+\.\s+/.test(segment) && !/^\s*\d+\.\d+/.test(segment);
        const titleIsNumbered = segmentIsNumbered;
        let j = i + 1;
        while (j < allWindowLines.length && (probeOnly === undefined || j < startIdx + probeOnly)) {
          const nextLine = (allWindowLines[j] ?? "").trim();
          if (!nextLine) break;
          const nextParsed = cleanTocLine(nextLine, repeaterSet);
          if (nextParsed.level !== null) break;
          const looksLikeContinuation =
            !/\s+\d+\s*$/.test(nextLine) &&
            !/\s+[ivxlcdm]+\s*$/i.test(nextLine) &&
            !/\s+[A-Z]-\d+\s*$/.test(nextLine) &&
            (nextLine[0] === nextLine[0].toLowerCase() || /^(and|of|to)\s+/i.test(nextLine));
          if (!looksLikeContinuation) break;
          title = (title + " " + nextLine).replace(/\s+/g, " ").trim();
          title = title.replace(TOC_TRUNCATED_WORD_ENDINGS, "").trim();
          j++;
          tocLinesParsed++;
          i = j - 1;
        }
        if (title.length < 6) {
          recordReject("REJECT_TOO_SHORT");
          consecutiveNonEntry++;
          continue;
        }
        if (isDocTitleFragment(title, titleIsNumbered)) {
          recordReject("REJECT_DOC_TITLE_FRAGMENT");
          consecutiveNonEntry++;
          continue;
        }
        if (isJunkOrInvalid(title)) {
          recordReject("REJECT_JUNK");
          consecutiveNonEntry++;
          continue;
        }
        const key = slugify(title);
        if (seenKeys.has(key)) {
          recordReject("REJECT_DUPLICATE");
          consecutiveNonEntry++;
          continue;
        }
        seenKeys.add(key);
        sections.push({ section_title: title, section_key: key, confidence: "TOC" });
        consecutiveNonEntry = 0;
      }
    }
  }

  return {
    sections,
    rejectedReasonsHistogram,
    tocLinesParsed,
    subEntriesSeen,
    rejectedExamples,
    rejectedNarrative,
    rejectedTooLong,
  };
}

/**
 * Clean and classify a single TOC segment for bounded extraction.
 * Strict TOP-only: single number "5. TITLE" or ALL CAPS 2+ words not indented <=8 words.
 * SUB: 10.1, indented, or single word (unless numbered top-level). Hard rejects: example/figure/table/narrative/too long.
 */
export function cleanTocLine(
  raw: string,
  repeaterSet?: Set<string>
): { title: string | null; level: "TOP" | "SUB" | null; rejectReason?: string } {
  const rawTrimmed = (raw ?? "").trim();
  if (!rawTrimmed) return { title: null, level: null };

  if (repeaterSet?.has(normalizeForRepeater(rawTrimmed))) {
    return { title: null, level: null, rejectReason: "REJECT_REPEATER_HEADER" };
  }

  const lower = rawTrimmed.toLowerCase();
  if (TOC_MARKERS_BOUNDED.some((m) => lower === m || lower.startsWith(m + " "))) return { title: null, level: null };

  // Title + page token: accept as TOP within TOC region when unnumbered (bypasses number/ALL CAPS requirement)
  if (!/^[\t ]{2,}/.test(rawTrimmed)) {
    const { pageToken, stem: rawStem } = parseTrailingPageToken(rawTrimmed);
    const stem = rawStem.replace(/\.{2,}/g, " ").trim().replace(/\s+/g, " ");
    if (pageToken !== null && stem.length >= MIN_HEADING_LEN && stem.length <= MAX_HEADING_LEN) {
      const words = stem.split(/\s+/).filter(Boolean);
      if (
        words.length >= MIN_TOC_WORDS &&
        words.length <= MAX_TOC_WORDS &&
        !hasNarrativeSignal(stem) &&
        !stem.includes("●") &&
        !stem.trim().startsWith("●")
      ) {
        const lowerStem = stem.toLowerCase();
        const hasRejectKw = TOC_REJECT_CONTAINS.some((kw) => lowerStem.includes(kw));
        const purelyNumericOrRoman = /^\d+$/.test(stem.trim()) || /^[ivxlcdm]+$/i.test(stem.trim());
        if (!hasRejectKw && !purelyNumericOrRoman) {
          const title = stem.replace(TOC_TRUNCATED_WORD_ENDINGS, "").trim().replace(/\s+/g, " ");
          if (title.length >= 6 && title.length <= MAX_TOC_TITLE_LENGTH) {
            return { title, level: "TOP" };
          }
        }
      }
    }
  }

  const s = stripPageTokensFromSegment(rawTrimmed);
  if (s.length < 6) return { title: null, level: null, rejectReason: "REJECT_FORMAT_TOO_SHORT" };

  const words = s.split(/\s+/).filter(Boolean);

  if (/^\d+(\.\d+)*\.?\s*$/.test(s)) return { title: null, level: null, rejectReason: "REJECT_DANGLING_NUMBER" };

  if (/[.?!●]/.test(s)) return { title: null, level: null, rejectReason: "REJECT_NARRATIVE" };
  if (/^(when|if|after|before|during)\s+/i.test(s)) return { title: null, level: null, rejectReason: "REJECT_NARRATIVE" };
  if (/\b(will|should|must)\b/i.test(s)) return { title: null, level: null, rejectReason: "REJECT_NARRATIVE" };
  if (words.length > 6 && /:/.test(s)) return { title: null, level: null, rejectReason: "REJECT_NARRATIVE" };

  if (s.length > MAX_TOC_TITLE_LENGTH) return { title: null, level: null, rejectReason: "REJECT_TOO_LONG" };
  if (words.length > MAX_TOC_TITLE_WORDS) return { title: null, level: null, rejectReason: "REJECT_TOO_LONG" };

  for (const kw of TOC_REJECT_CONTAINS) {
    if (lower.includes(kw)) return { title: null, level: null, rejectReason: "REJECT_EXAMPLE" };
  }

  const numberedMatch = s.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  let level: "TOP" | "SUB" | null = null;
  let title = s;

  if (numberedMatch) {
    const prefix = numberedMatch[1];
    title = numberedMatch[2].trim();
    if (/\.\d+/.test(prefix)) level = "SUB";
    else level = "TOP";
  } else if ((raw ?? "").match(/^[\t ]{2,}/)) {
    level = "SUB";
  } else {
    if (words.length <= 1) return { title: null, level: null, rejectReason: "REJECT_SUB" };
    if (words.length >= 2 && words.length <= MAX_TOC_TITLE_WORDS && s === s.toUpperCase()) level = "TOP";
  }

  if (!level || !title || title.length < 6)
    return {
      title: null,
      level: null,
      rejectReason: title.length > 0 && title.length < 6 ? "REJECT_FORMAT_TOO_SHORT" : "REJECT_FORMAT_NO_PAGE_NO_NUMBER",
    };
  title = title.replace(TOC_TRUNCATED_WORD_ENDINGS, "").trim();
  if (title.length < 6) return { title: null, level: null, rejectReason: "REJECT_FORMAT_TOO_SHORT" };
  if (level === "SUB") return { title, level };
  if (title.length > MAX_TOC_TITLE_LENGTH || title.split(/\s+/).filter(Boolean).length > MAX_TOC_TITLE_WORDS)
    return { title: null, level: null, rejectReason: "REJECT_TOO_LONG" };
  const titleLower = title.toLowerCase();
  for (const kw of TOC_REJECT_CONTAINS) {
    if (titleLower.includes(kw)) return { title: null, level: null, rejectReason: "REJECT_EXAMPLE" };
  }
  return { title, level };
}

/** Normalize a single line for TOC parsing (legacy): trim, collapse space, remove dot leaders and trailing page/roman. */
function normalizeTocLine(raw: string): string {
  return normalizeTocLineExtended(raw).normalized;
}

/** Reject lines that look like prose (legacy). */
function looksLikeProse(line: string): boolean {
  return hasNarrativeSignal(normalizeTocLineExtended(line).normalized);
}

const TOC_FILTER_STARTS = ["page", "appendix", "figure", "table"];
function isFilteredTitleCaseStart(title: string): boolean {
  const lower = title.trim().toLowerCase();
  return TOC_FILTER_STARTS.some((w) => lower === w || lower.startsWith(w + " "));
}

/** P1: Numbered heading e.g. "5. EMERGENCY COMMUNICATIONS" or "1.2.3 Subsection". */
const NUMBERED_TOC = /^\s*(\d+(?:\.\d+)*)\s+(.+)$/;
/** Check if line is an accepted TOC entry after normalization. Returns title or null. */
function _acceptTocLine(line: string): string | null {
  const n = normalizeTocLine(line);
  if (!n || n.length < MIN_HEADING_LEN || n.length > MAX_HEADING_LEN) return null;
  if (looksLikeProse(n)) return null;
  if (isTruncatedFragment(n)) return null;
  if (n.endsWith(",")) return null;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const p1 = n.match(NUMBERED_TOC);
  if (p1) {
    const title = normalizeWhitespace(p1[2]);
    if (title.length >= MIN_HEADING_LEN && title.length <= MAX_HEADING_LEN && !isTruncatedFragment(title)) return title;
    return null;
  }
  if (n === n.toUpperCase()) {
    if ((n.match(/[:\/()]/g) ?? []).length > 1) return null;
    return n;
  }
  if (/[.?!]/.test(n)) return null;
  if (isFilteredTitleCaseStart(n)) return null;
  return n;
}

/** TOC-density heuristic: count lines that look like TOC entries (end with number or have dot leaders). */
function _tocDensityScore(lines: string[]): number {
  let score = 0;
  for (const line of lines) {
    const t = line.trim();
    if (/\d+\s*$/.test(t)) score++;
    if (/\.{2,}/.test(t)) score++;
  }
  return score;
}

const _CONSECUTIVE_REJECT_THRESHOLD = 10;
const TOC_CLUSTER_WINDOW_LINES = 20;
const TOC_CLUSTER_MIN_CANDIDATES = 4;
const TOC_CLUSTER_MIN_REFERENCES = 2;
const TOC_SCAN_LINES_AFTER_MARKER = 200;
const _TOC_WINDOW_CHUNKS = 10;
const TOC_NO_MARKER_SCAN_CHUNKS = 30;

/** Truncated title endings (word boundary): drop from section title. */
const TOC_TRUNCATED_ENDINGS = /\s+(AN|THE|OF|AND)\s*$|,\s*$/i;

/** Count reference signals in a line (for cluster scoring). */
function countReferenceSignalsInLine(raw: string, normalized: string): number {
  let n = 0;
  if (/\.{2,}/.test(raw)) n++;
  if (/\s+\d+\s*$/.test(raw) || /\s+[ivxlcdm]+\s*$/i.test(raw) || /\s+[A-Z]-\d+\s*$/.test(raw) || /\s+\d+-\d+\s*$/.test(raw)) n++;
  if (/^\s*(\d+(\.\d+)*)\s+/.test(normalized)) n++;
  return n;
}

/** Weighted TOC window score: prefer real TOC over title/header regions. */
function scoreTocWindow(
  lines: string[],
  start: number,
  repeaterSet: Set<string>
): {
  referenceLines: number;
  dotLeaderLines: number;
  numberedPrefixLines: number;
  distinctTitleKeys: number;
  repeaterHits: number;
  narrativeHits: number;
  score: number;
} {
  const W = TOC_CLUSTER_WINDOW_LINES;
  let referenceLines = 0;
  let dotLeaderLines = 0;
  let numberedPrefixLines = 0;
  const titleKeys = new Set<string>();
  let repeaterHits = 0;
  let narrativeHits = 0;

  for (let j = 0; j < W && start + j < lines.length; j++) {
    const line = lines[start + j] ?? "";
    const raw = line.trim();
    if (!raw) continue;

    if (/\s+\d+\s*$/.test(raw) || /\s+[ivxlcdm]+\s*$/i.test(raw) || /\s+[A-Z]-\d+\s*$/.test(raw) || /\s+\d+-\d+\s*$/.test(raw) || /\.{2,}\s*\d+\s*$/.test(raw))
      referenceLines++;
    if (/\.{2,}/.test(raw)) dotLeaderLines++;
    if (/^\s*\d+\.\s+/.test(raw)) numberedPrefixLines++;

    const sig = normalizeForRepeater(raw);
    if (repeaterSet.has(sig)) repeaterHits++;
    const { normalized } = normalizeTocLineExtended(raw);
    if (hasNarrativeSignal(normalized)) narrativeHits++;

    const stem = stripPageTokensFromSegment(raw);
    if (stem.length >= 6) titleKeys.add(slugify(stem));
  }

  const score =
    referenceLines * 3 +
    dotLeaderLines * 2 +
    numberedPrefixLines * 2 +
    titleKeys.size * 2 -
    repeaterHits * 5 -
    narrativeHits * 3;

  return {
    referenceLines,
    dotLeaderLines,
    numberedPrefixLines,
    distinctTitleKeys: titleKeys.size,
    repeaterHits,
    narrativeHits,
    score,
  };
}

/**
 * Find best TOC cluster windows by weighted score (sorted desc). Prefers real TOC over header/title regions.
 */
function findBestTocClusterWindowsScored(
  lines: string[],
  repeaterSet: Set<string>
): Array<{ startLineIndex: number; score: number }> {
  const candidates: Array<{ startLineIndex: number; score: number }> = [];

  for (let start = 0; start < lines.length; start++) {
    const { score } = scoreTocWindow(lines, start, repeaterSet);
    if (score > 0) candidates.push({ startLineIndex: start, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export type TocExtractResult = {
  sections: ExtractedSection[];
  debug: PlanTocDebug;
  /** When sections were seeded from parseTocTopLevel (>=5), titles in TOC order for guard. */
  tocTopLevelTitles?: string[];
};

/**
 * Find best TOC cluster: slide 20-line window, require >= 6 candidates and >= 3 reference signals.
 * Returns best window or null. Caller passes lines already scoped (e.g. from marker onward or first N chunks).
 */
function findBestTocCluster(lines: string[]): { startLineIndex: number; candidates: number; references: number } | null {
  let best: { startLineIndex: number; candidates: number; references: number } | null = null;
  const W = TOC_CLUSTER_WINDOW_LINES;

  for (let start = 0; start < lines.length; start++) {
    let candidates = 0;
    let references = 0;
    for (let j = 0; j < W && start + j < lines.length; j++) {
      const line = lines[start + j] ?? "";
      if (!line.trim()) continue;
      const { raw, normalized } = normalizeTocLineExtended(line);
      if (isTocTitleCandidate(line)) candidates++;
      references += countReferenceSignalsInLine(raw, normalized);
    }
    if (candidates >= TOC_CLUSTER_MIN_CANDIDATES && references >= TOC_CLUSTER_MIN_REFERENCES) {
      if (!best || candidates + references > best.candidates + best.references) {
        best = { startLineIndex: start, candidates, references };
      }
    }
  }
  return best;
}

/** C) Parse section titles from lines in range; reject truncated, dedupe by key. */
function parseSectionsFromWindow(
  lines: string[],
  startIndex: number,
  maxLines: number
): { sections: ExtractedSection[]; rejected: Array<{ line: string; reason: string }> } {
  const sections: ExtractedSection[] = [];
  const seenKeys = new Set<string>();
  const rejected: Array<{ line: string; reason: string }> = [];

  for (let i = startIndex; i < lines.length && i < startIndex + maxLines && sections.length < MAX_TOC_LINES; i++) {
    const raw = (lines[i] ?? "").trim();
    if (!raw) continue;
    if (!isTocTitleCandidate(raw)) {
      const reason = rejectReasonTocLine(raw);
      if (rejected.length < 10) rejected.push({ line: raw.slice(0, 80), reason: reason ?? "format" });
      continue;
    }
    const { normalized } = normalizeTocLineExtended(raw);
    let title = normalized.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, "").trim();
    title = title.replace(TOC_TRUNCATED_ENDINGS, "").trim();
    if (title.length < MIN_HEADING_LEN) continue;
    if (isTruncatedFragment(title)) continue;
    const key = slugify(title);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    sections.push({ section_title: title, section_key: key, confidence: "TOC" });
  }
  return { sections, rejected };
}

/**
 * TOC invariant extraction: reference + non-narrative + density cluster.
 * Throws PlanTocTrustError if no usable TOC (with debug including bestWindow, sampleRejectedLines).
 */
export function extractTocSectionsOrThrow(chunkTexts: string[]): TocExtractResult {
  const chunks = (chunkTexts ?? []).map((t) => (t ?? "").trim()).filter(Boolean);
  const debug: PlanTocDebug = { markersSearched: TOC_MARKERS };

  let markerChunkIndex = -1;
  let markerText: string | undefined;
  let markerLineEndIndex: number | null = null;

  const allLinesFromChunks: string[] = [];
  let currentLineIndex = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkLines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of chunkLines) {
      if (isTocMarker(line)) {
        markerChunkIndex = i;
        markerText = line.slice(0, 80);
        markerLineEndIndex = currentLineIndex + 1;
      }
      allLinesFromChunks.push(line);
      currentLineIndex++;
    }
  }

  debug.markerFound = markerChunkIndex >= 0;
  if (markerChunkIndex >= 0) {
    debug.markerText = markerText;
    debug.markerChunkIndex = markerChunkIndex;
  }

  let linesToScan: string[];
  if (markerLineEndIndex != null) {
    linesToScan = allLinesFromChunks.slice(
      markerLineEndIndex,
      Math.min(allLinesFromChunks.length, markerLineEndIndex + TOC_SCAN_LINES_AFTER_MARKER)
    );
  } else {
    const scanEndChunks = Math.min(TOC_NO_MARKER_SCAN_CHUNKS, chunks.length);
    linesToScan = [];
    for (let i = 0; i < scanEndChunks; i++) {
      const chunk = chunks[i] ?? "";
      linesToScan.push(...chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    }
  }

  if (debug.markerFound && linesToScan.length > 0) {
    const tocTop = parseTocTopLevel(linesToScan, 0, TOC_SCAN_LINES_AFTER_MARKER);
    if (tocTop.length >= MIN_TOC_TOP_ENTRIES) {
      const sectionsFromToc: ExtractedSection[] = tocTop.map((e) => ({
        section_title: e.title,
        section_key: slugify(e.title),
        confidence: "TOC" as const,
      }));
      debug.clusterFound = false;
      debug.tocFound = true;
      debug.bestWindow = { candidates: sectionsFromToc.length, references: 0, startLineIndex: 0 };
      debug.acceptedCount = sectionsFromToc.length;
      debug.windowSize = linesToScan.length;
      return {
        sections: sectionsFromToc,
        debug,
        tocTopLevelTitles: tocTop.map((e) => e.title),
      };
    }
    const { sections: fallbackSections, rejected } = parseSectionsFromWindow(linesToScan, 0, linesToScan.length);
    if (fallbackSections.length >= MIN_TOC_SECTIONS) {
      debug.clusterFound = false;
      debug.tocFound = true;
      debug.bestWindow = { candidates: fallbackSections.length, references: 0, startLineIndex: 0 };
      debug.acceptedCount = fallbackSections.length;
      debug.sampleRejectedLines = rejected.slice(0, 10);
      debug.windowSize = linesToScan.length;
      return { sections: fallbackSections, debug };
    }
    if (fallbackSections.length > 0) {
      throw new PlanTocTrustError(
        PLAN_TOC_TOO_SMALL,
        `TOC trust selected but TOC produced ${fallbackSections.length} sections (need at least ${MIN_TOC_SECTIONS}).`,
        { ...debug, acceptedCount: fallbackSections.length }
      );
    }
  }

  const best = findBestTocCluster(linesToScan);

  if (!best) {
    const bestWindowCounts = { candidates: 0, references: 0, startLineIndex: 0 };
    for (let start = 0; start < Math.min(linesToScan.length, 500); start += TOC_CLUSTER_WINDOW_LINES) {
      let c = 0, r = 0;
      for (let j = 0; j < TOC_CLUSTER_WINDOW_LINES && start + j < linesToScan.length; j++) {
        const line = linesToScan[start + j] ?? "";
        if (isTocTitleCandidate(line)) c++;
        const { raw, normalized } = normalizeTocLineExtended(line);
        r += countReferenceSignalsInLine(raw, normalized);
      }
      if (c + r > bestWindowCounts.candidates + bestWindowCounts.references) {
        bestWindowCounts.candidates = c;
        bestWindowCounts.references = r;
        bestWindowCounts.startLineIndex = start;
      }
    }
    throw new PlanTocTrustError(
      PLAN_TOC_NOT_FOUND,
      "TOC trust selected but no TOC cluster was detected (need dense reference-style lines).",
      { ...debug, tocFound: false, bestWindow: bestWindowCounts }
    );
  }

  debug.clusterFound = true;
  debug.tocFound = true;
  debug.bestWindow = { candidates: best.candidates, references: best.references, startLineIndex: best.startLineIndex };

  const { sections, rejected } = parseSectionsFromWindow(linesToScan, best.startLineIndex, MAX_TOC_LINES);
  debug.acceptedCount = sections.length;
  debug.sampleRejectedLines = rejected.slice(0, 10);
  debug.windowSize = linesToScan.length;

  if (sections.length < MIN_TOC_SECTIONS) {
    throw new PlanTocTrustError(
      PLAN_TOC_TOO_SMALL,
      `TOC trust selected but TOC cluster produced ${sections.length} sections (need at least ${MIN_TOC_SECTIONS}).`,
      { ...debug }
    );
  }

  return { sections, debug };
}

/**
 * Bounded TOC extraction for trust=TOC only.
 * 1) Fuzzy marker search in raw chunks; if found, parse from marker window.
 * 2) If no marker, fall back to density cluster over first N chunks; if cluster found, parse from that window.
 * TOP-level only, >= 5 entries.
 */
function extractTocSectionsBoundedOrThrow(chunkTexts: string[]): TocExtractResult {
  const chunks = (chunkTexts ?? []).map((t) => (t ?? "").trim()).filter(Boolean);
  const debug: PlanTocDebug = { markersSearched: TOC_MARKERS_BOUNDED };

  const repeaterSet = buildRepeaterLineSet(chunks);

  const markerResult = findTocMarker(chunks);
  debug.markerFound = markerResult !== null;

  let allWindowLines: string[] = [];
  let startIdx: number;
  const sections: ExtractedSection[] = [];
  const seenKeys = new Set<string>();
  const rejectedReasonsHistogram: Record<string, number> = {};
  let consecutiveNonEntry = 0;
  let tocLinesParsed = 0;
  let subEntriesSeen = 0;
  let rejectedExamples = 0;
  let rejectedNarrative = 0;
  let rejectedTooLong = 0;
  let skipMainLoop = false;

  if (markerResult) {
    const { chunkIndex: markerChunkIndex, marker } = markerResult;
    const chunkLines = (chunks[markerChunkIndex] ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let normSoFar = "";
    let markerLineIndex = -1;
    for (let L = 0; L < chunkLines.length; L++) {
      normSoFar += normalizeForMarker(chunkLines[L]);
      if (normSoFar.includes(marker)) {
        markerLineIndex = L;
        break;
      }
    }
    if (markerLineIndex < 0) markerLineIndex = 0;
    const windowChunks = chunks.slice(markerChunkIndex, markerChunkIndex + TOC_BOUNDED_WINDOW_CHUNKS);
    for (const ch of windowChunks) {
      allWindowLines.push(...(ch ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    }
    startIdx = markerLineIndex + 1;
    debug.markerChunkIndex = markerChunkIndex;
    debug.markerLineIndex = markerLineIndex;
    if (startIdx >= allWindowLines.length) {
      throw new PlanTocTrustError(
        PLAN_TOC_NOT_FOUND,
        "TOC marker found but no lines after marker in window.",
        { ...debug, tocFound: false }
      );
    }
    // When TOC exists: seed sections from top-level numbered entries (1–10) so INFERRED/BALANCED get full set
    const tocTop = parseTocTopLevel(allWindowLines, startIdx, TOC_MARKER_PROBE_LINES);
    if (tocTop.length >= MIN_TOC_TOP_ENTRIES) {
      const sectionsFromToc: ExtractedSection[] = tocTop.map((e) => ({
        section_title: e.title,
        section_key: slugify(e.title),
        confidence: "TOC" as const,
      }));
      const tocTopLevelTitles = tocTop.map((e) => e.title);
      debug.tocLinesParsed = tocTop.length;
      debug.topEntriesAccepted = sectionsFromToc.length;
      debug.acceptedTopLevel = sectionsFromToc.length;
      debug.tocFound = true;
      debug.acceptedCount = sectionsFromToc.length;
      debug.windowSize = allWindowLines.length;
      if (debug.markerFound) debug.acceptedEntrySample = tocTopLevelTitles.slice(0, 10);
      return { sections: sectionsFromToc, debug, tocTopLevelTitles: tocTopLevelTitles };
    }
  } else {
    // markerFound is false: use weighted window scoring and topic diversity; try windows in score order
    const scanChunks = Math.min(TOC_NO_MARKER_SCAN_CHUNKS, chunks.length);
    debug.chunksScanned = scanChunks;
    const linesToScan: string[] = [];
    for (let i = 0; i < scanChunks; i++) {
      linesToScan.push(...(chunks[i] ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    }
    const windows = findBestTocClusterWindowsScored(linesToScan, repeaterSet);
    let chosenResult: ReturnType<typeof parseTocFromClusterWindow> | null = null;
    let chosenStart = 0;
    let chosenScore = 0;
    let chosenTocTop: TocTopLevelEntry[] | null = null;
    for (const { startLineIndex, score } of windows) {
      const tocTop = parseTocTopLevel(linesToScan, startLineIndex, 80);
      if (tocTop.length >= MIN_TOC_TOP_ENTRIES) {
        chosenTocTop = tocTop;
        chosenStart = startLineIndex;
        chosenScore = score;
        break;
      }
      const r = parseTocFromClusterWindow(linesToScan, startLineIndex, repeaterSet);
      if (r.sections.length < MIN_TOC_TOP_ENTRIES) continue;
      if (countDistinctTopicWordsBeyondStopwords(r.sections.map((s) => s.section_title)) < MIN_DISTINCT_TOPIC_WORDS)
        continue;
      chosenResult = r;
      chosenStart = startLineIndex;
      chosenScore = score;
      break;
    }
    if (chosenTocTop && chosenTocTop.length >= MIN_TOC_TOP_ENTRIES) {
      const sectionsFromToc: ExtractedSection[] = chosenTocTop.map((e) => ({
        section_title: e.title,
        section_key: slugify(e.title),
        confidence: "TOC" as const,
      }));
      debug.clusterFound = true;
      debug.tocFound = true;
      debug.acceptedCount = sectionsFromToc.length;
      debug.bestClusterCounts = { candidates: sectionsFromToc.length, references: chosenScore, startLineIndex: chosenStart };
      debug.acceptedEntrySample = chosenTocTop.map((e) => e.title).slice(0, 10);
      return {
        sections: sectionsFromToc,
        debug,
        tocTopLevelTitles: chosenTocTop.map((e) => e.title),
      };
    }
    if (!chosenResult || chosenResult.sections.length < MIN_TOC_TOP_ENTRIES) {
      const bestClusterCounts = { candidates: 0, references: 0, startLineIndex: 0 };
      if (windows.length > 0) {
        bestClusterCounts.startLineIndex = windows[0].startLineIndex;
        const first = scoreTocWindow(linesToScan, windows[0].startLineIndex, repeaterSet);
        bestClusterCounts.candidates = first.distinctTitleKeys + first.numberedPrefixLines;
        bestClusterCounts.references = first.referenceLines + first.dotLeaderLines;
      }
      throw new PlanTocTrustError(
        PLAN_TOC_NOT_FOUND,
        "TOC trust selected but no TOC marker found and no cluster window passed diversity or had enough sections.",
        { ...debug, tocFound: false, bestClusterCounts, rejectLowDiversity: true }
      );
    }
    debug.clusterFound = true;
    debug.bestClusterCounts = {
      candidates: chosenResult.sections.length,
      references: chosenScore,
      startLineIndex: chosenStart,
    };
    debug.acceptedEntrySample = chosenResult.acceptedEntrySample;
    allWindowLines = linesToScan;
    startIdx = chosenStart;
    sections.push(...chosenResult.sections);
    Object.assign(rejectedReasonsHistogram, chosenResult.rejectedReasonsHistogram);
    tocLinesParsed = chosenResult.sections.length * 2;
    skipMainLoop = true;
  }

  function recordReject(reason: string): void {
    rejectedReasonsHistogram[reason] = (rejectedReasonsHistogram[reason] ?? 0) + 1;
  }

  function isJunkOrInvalid(title: string): boolean {
    const lower = title.toLowerCase().trim();
    if (TOC_JUNK_TITLES.some((j) => lower === j || lower.startsWith(j + " "))) return true;
    if (/^\d+$/.test(title.trim()) || /\s\d+\s*$/.test(title)) return true;
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length === 1 && title.length < 25) return true;
    return false;
  }

  const maxLineIndex = allWindowLines.length;
  const probeOnly = debug.markerFound ? TOC_MARKER_PROBE_LINES : undefined;

  if (!skipMainLoop) {
  for (let i = startIdx; i < maxLineIndex && consecutiveNonEntry < TOC_CONSECUTIVE_NON_ENTRY_STOP; i++) {
    if (probeOnly !== undefined && i >= startIdx + probeOnly) break;
    const line = allWindowLines[i] ?? "";
    tocLinesParsed++;

    const segments = splitPotentialMultiEntries(line);
    const toProcess = segments.length >= 1 ? segments : [line];

    for (const segment of toProcess) {
      const parsed = cleanTocLine(segment, repeaterSet);
      if (parsed.rejectReason === "REJECT_REPEATER_HEADER") {
        recordReject("REJECT_REPEATER_HEADER");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.rejectReason === "REJECT_EXAMPLE") {
        rejectedExamples++;
        recordReject("REJECT_EXAMPLE");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.rejectReason === "REJECT_NARRATIVE") {
        rejectedNarrative++;
        recordReject("REJECT_NARRATIVE");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.rejectReason === "REJECT_TOO_LONG") {
        rejectedTooLong++;
        recordReject("REJECT_TOO_LONG");
        consecutiveNonEntry++;
        continue;
      }
      if (parsed.level === "SUB") {
        subEntriesSeen++;
        recordReject("REJECT_SUB");
        consecutiveNonEntry = 0;
        continue;
      }
      if (!parsed.title || !parsed.level) {
        if (segment.length > 0) recordReject(parsed.rejectReason ?? "REJECT_FORMAT");
        consecutiveNonEntry++;
        continue;
      }

      if (parsed.level === "TOP") {
        let title = parsed.title;
        const segmentIsNumbered = /^\s*\d+\.\s+/.test(segment) && !/^\s*\d+\.\d+/.test(segment);
        const titleIsNumbered = segmentIsNumbered;
        let j = i + 1;
        while (j < allWindowLines.length && (probeOnly === undefined || j < startIdx + probeOnly)) {
          const nextLine = (allWindowLines[j] ?? "").trim();
          if (!nextLine) break;
          const nextParsed = cleanTocLine(nextLine, repeaterSet);
          if (nextParsed.level !== null) break;
          const looksLikeContinuation =
            !/\s+\d+\s*$/.test(nextLine) &&
            !/\s+[ivxlcdm]+\s*$/i.test(nextLine) &&
            !/\s+[A-Z]-\d+\s*$/.test(nextLine) &&
            (nextLine[0] === nextLine[0].toLowerCase() || /^(and|of|to)\s+/i.test(nextLine));
          if (!looksLikeContinuation) break;
          title = (title + " " + nextLine).replace(/\s+/g, " ").trim();
          title = title.replace(TOC_TRUNCATED_WORD_ENDINGS, "").trim();
          j++;
          tocLinesParsed++;
          i = j - 1;
        }
        if (title.length < 6) {
          recordReject("REJECT_TOO_SHORT");
          consecutiveNonEntry++;
          continue;
        }
        if (isDocTitleFragment(title, titleIsNumbered)) {
          recordReject("REJECT_DOC_TITLE_FRAGMENT");
          consecutiveNonEntry++;
          continue;
        }
        if (isJunkOrInvalid(title)) {
          recordReject("REJECT_JUNK");
          consecutiveNonEntry++;
          continue;
        }
        const key = slugify(title);
        if (seenKeys.has(key)) {
          recordReject("REJECT_DUPLICATE");
          consecutiveNonEntry++;
          continue;
        }
        seenKeys.add(key);
        sections.push({ section_title: title, section_key: key, confidence: "TOC" });
        consecutiveNonEntry = 0;
      }
    }
  }
  }

  if (probeOnly !== undefined && sections.length < TOC_MARKER_MIN_TOP_IN_PROBE) {
    debug.markerFound = false;
    delete debug.markerChunkIndex;
    delete debug.markerLineIndex;
    const scanChunks = Math.min(TOC_NO_MARKER_SCAN_CHUNKS, chunks.length);
    debug.chunksScanned = scanChunks;
    const linesToScan: string[] = [];
    for (let i = 0; i < scanChunks; i++) {
      linesToScan.push(...(chunks[i] ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    }
    const windows = findBestTocClusterWindowsScored(linesToScan, repeaterSet);
    let fallbackResult: ReturnType<typeof parseTocFromClusterWindow> | null = null;
    let fallbackStart = 0;
    let fallbackScore = 0;
    for (const { startLineIndex, score } of windows) {
      const r = parseTocFromClusterWindow(linesToScan, startLineIndex, repeaterSet);
      if (r.sections.length < MIN_TOC_TOP_ENTRIES) continue;
      if (countDistinctTopicWordsBeyondStopwords(r.sections.map((s) => s.section_title)) < MIN_DISTINCT_TOPIC_WORDS)
        continue;
      fallbackResult = r;
      fallbackStart = startLineIndex;
      fallbackScore = score;
      break;
    }
    if (!fallbackResult || fallbackResult.sections.length < MIN_TOC_TOP_ENTRIES) {
      const bestClusterCounts = { candidates: 0, references: 0, startLineIndex: 0 };
      if (windows.length > 0) {
        bestClusterCounts.startLineIndex = windows[0].startLineIndex;
        const first = scoreTocWindow(linesToScan, windows[0].startLineIndex, repeaterSet);
        bestClusterCounts.candidates = first.distinctTitleKeys + first.numberedPrefixLines;
        bestClusterCounts.references = first.referenceLines + first.dotLeaderLines;
      }
      throw new PlanTocTrustError(
        PLAN_TOC_NOT_FOUND,
        "TOC trust selected but marker probe failed and no cluster window passed diversity or had enough sections.",
        { ...debug, tocFound: false, bestClusterCounts, rejectLowDiversity: true }
      );
    }
    debug.clusterFound = true;
    debug.bestClusterCounts = {
      candidates: fallbackResult.sections.length,
      references: fallbackScore,
      startLineIndex: fallbackStart,
    };
    debug.acceptedEntrySample = fallbackResult.acceptedEntrySample;
    sections.length = 0;
    sections.push(...fallbackResult.sections);
    Object.assign(rejectedReasonsHistogram, fallbackResult.rejectedReasonsHistogram);
    tocLinesParsed = fallbackResult.sections.length * 2;
  }

  debug.tocLinesParsed = tocLinesParsed;
  debug.topEntriesAccepted = sections.length;
  debug.acceptedTopLevel = sections.length;
  debug.subEntriesSeen = subEntriesSeen;
  debug.acceptedSubRejected = subEntriesSeen;
  debug.rejectedExamples = rejectedExamples;
  debug.rejectedNarrative = rejectedNarrative;
  debug.rejectedTooLong = rejectedTooLong;
  debug.rejectedReasonsHistogram = rejectedReasonsHistogram;
  debug.tocFound = true;
  debug.acceptedCount = sections.length;
  debug.windowSize = allWindowLines.length;

  if (sections.length < MIN_TOC_TOP_ENTRIES) {
    const source = debug.markerFound ? "marker-bounded TOC" : "cluster-window TOC";
    throw new PlanTocTrustError(
      PLAN_TOC_TOO_SMALL,
      `TOC trust selected but ${source} produced ${sections.length} top-level sections (need at least ${MIN_TOC_TOP_ENTRIES}).`,
      { ...debug, acceptedCount: sections.length }
    );
  }

  if (debug.markerFound && !debug.acceptedEntrySample) {
    debug.acceptedEntrySample = sections.slice(0, 10).map((s) => s.section_title);
  }

  return { sections, debug };
}

/** TOC only: detect + normalize TOC; return { sections, tocPresent }. */
function extractTocSectionsOnly(lines: string[], fullText: string): { sections: ExtractedSection[]; tocPresent: boolean } {
  if (!fullText) return { sections: [], tocPresent: false };
  let tocStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/table of contents/i.test(lines[i] ?? "")) {
      tocStartIdx = i + 1;
      break;
    }
  }
  if (tocStartIdx < 0) return { sections: [], tocPresent: false };

  const tocSections: ExtractedSection[] = [];
  const seenKeys = new Set<string>();
  for (let i = tocStartIdx; i < lines.length && tocSections.length < MAX_TOC_LINES; i++) {
    const raw = (lines[i] ?? "").trim();
    if (!raw) continue;
    if (/^(INTRODUCTION|SECTION\s*1)\b/i.test(raw)) break;

    const numMatch = raw.match(NUMBERED_TOPLEVEL);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= MIN_SECTION_NUM && num <= MAX_SECTION_NUM && !APPENDIX_LINE.test(raw)) {
        const title = normalizeWhitespace(numMatch[2].replace(/\s*[.\s]+\d+\s*$/g, ""));
        if (title.length >= MIN_HEADING_LEN && title.length <= MAX_HEADING_LEN && !isTruncatedFragment(title)) {
          const key = slugify(title);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            tocSections.push({ section_title: title, section_key: key, confidence: "TOC" });
          }
        }
      }
      continue;
    }
    if (raw === raw.toUpperCase() && raw.length >= MIN_HEADING_LEN && raw.length <= MAX_HEADING_LEN && !hasSentencePunctuation(raw) && !hasBadEnding(raw) && !isTruncatedFragment(raw)) {
      const words = raw.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && (raw.match(/[:\/()]/g) ?? []).length <= 1) {
        const title = normalizeWhitespace(raw);
        const key = slugify(title);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          tocSections.push({ section_title: title, section_key: key, confidence: "TOC" });
        }
      }
    }
  }
  return { sections: tocSections, tocPresent: true };
}

/** Headings only: strict heading extraction, no TOC. Reject prose, fragments, truncated; require repeat or numbering. */
function extractHeadingSectionsOnly(lines: string[]): ExtractedSection[] {
  const candidateLines: { title: string; key: string; num?: number }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !isStrictCandidateHeading(trimmed)) continue;

    const numMatch = trimmed.match(/^\s*(\d{1,2})\.\s+(.+)$/);
    const num = numMatch ? parseInt(numMatch[1], 10) : undefined;
    const title = normalizeWhitespace(numMatch ? numMatch[2] : trimmed);
    if (num !== undefined && (num < MIN_SECTION_NUM || num > MAX_SECTION_NUM)) continue;
    const key = slugify(title);
    candidateLines.push({ title, key, num });
  }

  const keyCount = new Map<string, number>();
  const keyToFirst = new Map<string, { title: string; num?: number }>();
  for (const c of candidateLines) {
    keyCount.set(c.key, (keyCount.get(c.key) ?? 0) + 1);
    if (!keyToFirst.has(c.key)) keyToFirst.set(c.key, { title: c.title, num: c.num });
  }

  const kept: (ExtractedSection & { sortNum: number })[] = [];
  const seen = new Set<string>();
  for (const c of candidateLines) {
    if (seen.has(c.key)) continue;
    const count = keyCount.get(c.key) ?? 0;
    const isNumbered = c.num !== undefined;
    if (count >= 2 || isNumbered) {
      seen.add(c.key);
      const first = keyToFirst.get(c.key)!;
      kept.push({
        section_title: first.title,
        section_key: c.key,
        confidence: isNumbered ? "NUMBERED" : "HEADING_REPEAT",
        sortNum: first.num ?? 999,
      });
    }
  }

  const hasAnyNumber = kept.some((s) => s.sortNum < 999);
  if (hasAnyNumber) kept.sort((a, b) => a.sortNum - b.sortNum);
  return kept.map(({ sortNum: _n, ...s }) => s);
}

/** Legacy: extract sections using BALANCED trust. */
export function extractPlanToc(chunkTexts: string[]): ExtractedSection[] {
  return extractPlanSections(chunkTexts, { trust: "BALANCED" }).sections;
}

/** Debug: reason why a line would be accepted or rejected as a section heading. */
export type CandidateReason =
  | "ACCEPT_TOC"
  | "ACCEPT_NUMBERED"
  | "ACCEPT_ALLCAPS_REPEAT"
  | "REJECT_HAS_PUNCT"
  | "REJECT_TOO_SHORT"
  | "REJECT_TRUNCATED_ENDWORD"
  | "REJECT_NOT_REPEAT"
  | "REJECT_LOOKS_LIKE_SENTENCE"
  | "REJECT_BAD_ENDING"
  | "REJECT_TOO_FEW_WORDS";

function classifyLineForDebug(line: string): CandidateReason {
  const trimmed = line.trim();
  if (trimmed.length < MIN_HEADING_LEN) return "REJECT_TOO_SHORT";
  if (trimmed.length > MAX_HEADING_LEN) return "REJECT_LOOKS_LIKE_SENTENCE";
  if (hasBadEnding(trimmed)) return "REJECT_BAD_ENDING";
  if (hasSentencePunctuation(trimmed)) return "REJECT_HAS_PUNCT";
  if (isTruncatedFragment(trimmed)) return "REJECT_TRUNCATED_ENDWORD";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "REJECT_TOO_FEW_WORDS";
  if (/^\s*\d+\.\s+\S/.test(trimmed)) return "ACCEPT_NUMBERED";
  if (trimmed === trimmed.toUpperCase() && (trimmed.match(/[:\/()]/g) ?? []).length <= 1) return "ACCEPT_ALLCAPS_REPEAT";
  return "REJECT_LOOKS_LIKE_SENTENCE";
}

function lineToNormalizedTitle(line: string): string {
  const trimmed = line.trim();
  const numMatch = trimmed.match(/^\s*(\d{1,2})\.\s+(.+)$/);
  return normalizeWhitespace(numMatch ? numMatch[2] : trimmed);
}

function _sectionMatchesLine(section: ExtractedSection, line: string): boolean {
  const title = lineToNormalizedTitle(line);
  return slugify(section.section_title) === slugify(title) || section.section_key === slugify(title);
}

export type ExtractionCandidate = { line: string; accepted: boolean; reason: string };

export type ExtractPlanSectionsOptions = {
  trust: PlanStructureTrust;
  debug?: boolean;
};

export type ExtractPlanSectionsResult = {
  sections: ExtractedSection[];
  candidates?: ExtractionCandidate[];
  tocFound?: boolean;
  tocSectionsCount?: number;
  /** When TOC was used and sections came from parseTocTopLevel (>=5), titles in TOC order for guard. */
  tocTopLevelTitles?: string[];
};

/**
 * Extract sections by trust mode.
 * TOC: TOC only; throw PlanTocTrustError if no TOC, normalization fails, or <3 sections.
 * INFERRED: headings only (strict, no TOC).
 * BALANCED: TOC when available, then add non-duplicate headings that pass rules.
 */
export function extractPlanSections(
  chunkTexts: string[],
  opts: ExtractPlanSectionsOptions
): ExtractPlanSectionsResult {
  const fullText = chunkTexts
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  const lines = fullText ? fullText.split(/\r?\n/) : [];

  const trust = opts.trust ?? "BALANCED";
  let sections: ExtractedSection[] = [];
  let tocFound = false;
  let tocSectionsCount = 0;
  let tocTopLevelTitles: string[] | undefined;

  if (trust === "TOC") {
    const result = extractTocSectionsBoundedOrThrow(chunkTexts);
    sections = result.sections;
    tocFound = true;
    tocSectionsCount = result.sections.length;
    tocTopLevelTitles = result.tocTopLevelTitles;
  } else if (trust === "INFERRED") {
    // When TOC exists, always seed sections from TOC top-level (1–10) so we get full set, not partial headings
    const tocTop = getTocTopLevelFromChunks(chunkTexts);
    if (tocTop.length >= MIN_TOC_TOP_ENTRIES) {
      sections = tocTop.map((e) => ({
        section_title: e.title,
        section_key: slugify(e.title),
        confidence: "TOC" as const,
      }));
      tocFound = true;
      tocSectionsCount = sections.length;
      tocTopLevelTitles = tocTop.map((e) => e.title);
    } else {
      sections = extractHeadingSectionsOnly(lines);
    }
  } else {
    // BALANCED: try TOC invariant detector first; on success use those sections and add non-duplicate strict headings; on fail fall back to headings only
    try {
      const tocResult = extractTocSectionsOrThrow(chunkTexts);
      tocFound = true;
      tocSectionsCount = tocResult.sections.length;
      tocTopLevelTitles = tocResult.tocTopLevelTitles;
      sections = [...tocResult.sections];
      const tocKeys = new Set(sections.map((s) => s.section_key));
      const tocNormSet = new Set(sections.map((s) => normalizeTitleForMatch(s.section_title)));
      const headingSections = extractHeadingSectionsOnly(lines);
      for (const h of headingSections) {
        if (tocNormSet.has(normalizeTitleForMatch(h.section_title))) continue; // map into existing TOC section, do not create new
        if (!tocKeys.has(h.section_key)) {
          tocKeys.add(h.section_key);
          tocNormSet.add(normalizeTitleForMatch(h.section_title));
          sections.push(h);
        }
      }
    } catch {
      const tocTop = getTocTopLevelFromChunks(chunkTexts);
      if (tocTop.length >= MIN_TOC_TOP_ENTRIES) {
        tocFound = true;
        tocTopLevelTitles = tocTop.map((e) => e.title);
        sections = tocTop.map((e) => ({
          section_title: e.title,
          section_key: slugify(e.title),
          confidence: "TOC" as const,
        }));
        tocSectionsCount = sections.length;
      } else {
        const { sections: tocSections, tocPresent } = extractTocSectionsOnly(lines, fullText);
        tocFound = tocPresent;
        tocSectionsCount = tocSections.length;
        const headingSections = extractHeadingSectionsOnly(lines);
        if (tocSections.length > 0) {
          const tocKeys = new Set(tocSections.map((s) => s.section_key));
          sections = [...tocSections];
          for (const h of headingSections) {
            if (!tocKeys.has(h.section_key)) {
              tocKeys.add(h.section_key);
              sections.push(h);
            }
          }
        } else {
          sections = headingSections;
        }
      }
    }
  }

  if (!opts.debug) return { sections, tocFound, tocSectionsCount, tocTopLevelTitles };

  const linesTrimmed = fullText ? fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const candidates: ExtractionCandidate[] = [];
  const maxCandidates = 50;
  for (let i = 0; i < linesTrimmed.length && candidates.length < maxCandidates; i++) {
    const line = linesTrimmed[i] ?? "";
    const reason = classifyLineForDebug(line);
    const accepted = reason.startsWith("ACCEPT_");
    candidates.push({ line: line.slice(0, 120), accepted, reason });
  }
  return { sections, candidates, tocFound, tocSectionsCount, tocTopLevelTitles };
}
