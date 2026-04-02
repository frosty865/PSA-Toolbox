/**
 * Multi-detector pipeline for vital element extraction from section bodies.
 * Deterministic; no LLM. Works across diverse plan sources via fallbacks.
 */

export type VitalConfidence = 0.0 | 0.5 | 0.8 | 1.0;

export type VitalDetector =
  | "marker_bullets"
  | "bullets"
  | "numbered"
  | "prompts"
  | "subheadings";

export type VitalElement = {
  title: string;
  kind: "bullet" | "numbered" | "prompt" | "subheading";
  locator_type: "bullet" | "numbered" | "prompt" | "heading";
  locator: string;
  confidence: VitalConfidence;
  detector: VitalDetector;
};

const MAX_VITALS_PER_SECTION = 12;
const MAX_TITLE_LENGTH = 80;
/** Bullet: ● • - * (asterisk) or – (en-dash U+2013); require at least 2 chars of content. */
const BULLET_RE = /^\s*(?:●|•|-|\*|\u2013)\s+(.{2,}?)\s*$/;
const NUMBERED_RE = /^\s*(?:\d+[.)]|[a-z]\))\s+(.+?)\s*$/;
const DOT_LEADERS_PAGE = /[.\s]{5,}\d+\s*$/;

function normalizeLine(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(raw: string): string {
  let t = (raw ?? "").replace(/\s+/g, " ").trim();
  t = t.replace(DOT_LEADERS_PAGE, "").trim();
  t = t.replace(/\s*[.:;,]+\s*$/, "").trim();
  if (t.length > MAX_TITLE_LENGTH) t = t.slice(0, MAX_TITLE_LENGTH - 3) + "...";
  return t;
}

function isBlank(s: string): boolean {
  return normalizeLine(s).length === 0;
}

function isSectionHeader(line: string): boolean {
  const t = normalizeLine(line);
  if (t.length < 6 || t.length > 140) return false;
  if (t.includes("http") || t.includes("www")) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.85;
}

function looksLikeMarker(line: string): boolean {
  const t = normalizeLine(line).toLowerCase();
  return (
    t.includes("consider the following") ||
    t.includes("include the following") ||
    t.includes("ensure the plan includes") ||
    t.includes("at a minimum") ||
    (t.includes("the plan should") && t.length < 120) ||
    (t.includes("when developing") && t.includes("consider"))
  );
}

function wordCount(s: string): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function isMostlyCaps(s: string): boolean {
  const letters = (s ?? "").replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  return letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.85;
}

function isJunk(title: string, _opts?: { forbidCadence?: boolean }): boolean {
  const t = (title ?? "").toLowerCase();
  if (/https?:\/\//.test(t) || /www\./.test(t)) return true;
  if (t.startsWith("source:") || t.includes("fbi.gov") || t.includes("cisa.gov") || t.includes(".gov/")) return true;
  if (/^\s*$/.test(t)) return true;
  return false;
}

// ---- Detector 1: marker_bullets (confidence 1.0) ----
function detectMarkerBullets(lines: string[]): VitalElement[] {
  const out: VitalElement[] = [];
  const MAX_WINDOW = 80;
  for (let i = 0; i < lines.length; i++) {
    if (!looksLikeMarker(lines[i] ?? "")) continue;
    const _marker = normalizeLine(lines[i] ?? "");
    void _marker;
    let blanks = 0;
    for (let j = i + 1; j < lines.length && j - i < MAX_WINDOW; j++) {
      const cur = lines[j] ?? "";
      if (isSectionHeader(cur)) break;
      if (looksLikeMarker(cur)) break;
      if (isBlank(cur)) {
        blanks++;
        if (blanks >= 2) break;
        continue;
      }
      blanks = 0;
      const m = cur.match(BULLET_RE);
      if (m) {
        let bullet = normalizeLine(m[1]);
        let k = j + 1;
        while (k < lines.length) {
          const nxt = lines[k] ?? "";
          if (isBlank(nxt)) break;
          if (isSectionHeader(nxt)) break;
          if (looksLikeMarker(nxt)) break;
          if (BULLET_RE.test(nxt)) break;
          if (!/^\s{2,}\S/.test(nxt)) break;
          bullet = normalizeLine(bullet + " " + normalizeLine(nxt));
          k++;
        }
        j = k - 1;
        if (bullet.length >= 6) {
          out.push({
            title: normalizeTitle(bullet),
            kind: "bullet",
            locator_type: "bullet",
            locator: normalizeTitle(bullet),
            confidence: 1.0,
            detector: "marker_bullets",
          });
        }
      }
    }
  }
  return out;
}

// ---- Detector 2: bullets without marker (confidence 0.8) ----
function detectBullets(lines: string[]): VitalElement[] {
  const out: VitalElement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    if (isBlank(cur)) continue;
    const m = cur.match(BULLET_RE);
    if (!m) continue;
    let bullet = normalizeLine(m[1]);
    let k = i + 1;
    while (k < lines.length) {
      const nxt = lines[k] ?? "";
      if (isBlank(nxt)) break;
      if (BULLET_RE.test(nxt)) break;
      if (!/^\s{2,}\S/.test(nxt)) break;
      bullet = normalizeLine(bullet + " " + normalizeLine(nxt));
      k++;
    }
    const title = normalizeTitle(bullet);
    if (title.length < 6) continue;
    if (wordCount(title) >= 2 && (wordCount(title) >= 6 || isMostlyCaps(title) || title.length >= 15)) {
      out.push({
        title,
        kind: "bullet",
        locator_type: "bullet",
        locator: title,
        confidence: 0.8,
        detector: "bullets",
      });
    }
  }
  return out;
}

// ---- Detector 3: numbered (confidence 0.8) ----
function detectNumbered(lines: string[]): VitalElement[] {
  const out: VitalElement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    if (isBlank(cur)) continue;
    const m = cur.match(NUMBERED_RE);
    if (!m) continue;
    let text = normalizeLine(m[1]);
    let k = i + 1;
    while (k < lines.length) {
      const nxt = lines[k] ?? "";
      if (isBlank(nxt)) break;
      if (NUMBERED_RE.test(nxt)) break;
      if (!/^\s{2,}\S/.test(nxt)) break;
      text = normalizeLine(text + " " + normalizeLine(nxt));
      k++;
    }
    const title = normalizeTitle(text);
    if (title.length >= 6) {
      out.push({
        title,
        kind: "numbered",
        locator_type: "numbered",
        locator: title,
        confidence: 0.8,
        detector: "numbered",
      });
    }
  }
  return out;
}

// ---- Detector 4: prompts (confidence 0.8) ----
function detectPrompts(lines: string[]): VitalElement[] {
  const out: VitalElement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    const t = normalizeLine(cur);
    if (!t.endsWith(":") || t.length < 4 || t.length > 100) continue;
    if (isSectionHeader(cur)) continue;
    const label = t.replace(/\s*:\s*$/, "").trim();
    let combined = label;
    let count = 0;
    for (let j = i + 1; j < lines.length && count < 5; j++) {
      const nxt = lines[j] ?? "";
      if (isBlank(nxt)) break;
      if (BULLET_RE.test(nxt) || NUMBERED_RE.test(nxt)) break;
      if (!/^\s{2,}\S/.test(nxt)) break;
      combined = normalizeLine(combined + " " + normalizeLine(nxt));
      count++;
    }
    const title = count > 0 ? `${label} information is specified` : label;
    if (normalizeTitle(title).length >= 4) {
      out.push({
        title: normalizeTitle(title),
        kind: "prompt",
        locator_type: "prompt",
        locator: normalizeTitle(combined),
        confidence: 0.8,
        detector: "prompts",
      });
    }
  }
  return out;
}

// ---- Detector 5: subheadings (confidence 0.5) ----
function detectSubheadings(lines: string[]): VitalElement[] {
  const out: VitalElement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    if (isBlank(cur)) continue;
    const t = normalizeLine(cur);
    if (t.length < 6 || t.length > 140) continue;
    if (t.includes("http") || t.includes("www")) continue;
    const prevBlank = i === 0 || isBlank(lines[i - 1] ?? "");
    const nextBlank = i === lines.length - 1 || isBlank(lines[i + 1] ?? "");
    if (!prevBlank && !nextBlank) continue;
    const letters = t.replace(/[^A-Za-z]/g, "");
    if (letters.length < 4) continue;
    const isCaps = letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.85;
    const isTitleCase = /^[A-Z][a-z]/.test(t) && !t.includes("...");
    if (!isCaps && !isTitleCase) continue;
    if (isJunk(t)) continue;
    out.push({
      title: normalizeTitle(t),
      kind: "subheading",
      locator_type: "heading",
      locator: normalizeTitle(t),
      confidence: 0.5,
      detector: "subheadings",
    });
  }
  return out;
}

// ---- Merge, filter, dedupe, sort, cap ----
function mergeAndRank(
  candidates: VitalElement[],
  opts?: { forbidCadence?: boolean }
): VitalElement[] {
  const normalized: VitalElement[] = [];
  for (const v of candidates) {
    const title = normalizeTitle(v.title);
    if (title.length < 2) continue;
    if (isJunk(title, opts)) continue;
    normalized.push({
      ...v,
      title: title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH - 3) + "..." : title,
      locator: normalizeTitle(v.locator),
    });
  }
  const seen = new Set<string>();
  const deduped: VitalElement[] = [];
  for (const v of normalized) {
    const key = v.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(v);
  }
  deduped.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (b.title.length - a.title.length);
  });
  return deduped.slice(0, MAX_VITALS_PER_SECTION);
}

/**
 * Extract vital elements using a multi-detector pipeline with fallbacks.
 * If no vitals are found, subheadings alone can populate 1–3 items.
 */
export function extractVitalElementsFromSectionBody(
  sectionText: string,
  opts?: { forbidCadence?: boolean }
): VitalElement[] {
  const lines = (sectionText ?? "").split(/\r?\n/);

  const all: VitalElement[] = [
    ...detectMarkerBullets(lines),
    ...detectBullets(lines),
    ...detectNumbered(lines),
    ...detectPrompts(lines),
    ...detectSubheadings(lines),
  ];

  let result = mergeAndRank(all, opts);

  if (result.length === 0) {
    const subOnly = detectSubheadings(lines);
    const fallback = mergeAndRank(subOnly, opts);
    result = fallback.slice(0, 3);
  }

  return result;
}
