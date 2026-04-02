/**
 * Section-anchored vital element extraction from fullText.
 * No page/locator slicing: find section headers in text, then capture bullets after marker phrases.
 * Deterministic; no LLM.
 */

export type RawVital = { section_title: string; text: string; marker?: string };

const MAX_BULLETS_PER_SECTION = 12;
const MIN_BULLET_TEXT_LENGTH = 6;
const MAX_BULLET_WINDOW_LINES = 80;
const BLANK_LINES_STOP = 2;

const MARKER_PHRASES = [
  "consider the following",
  "include the following",
  "at a minimum",
  "ensure the plan includes",
];

/** Bullet line: ● • - (unicode bullets) or hyphen; optional "o " when in list context. */
const BULLET_START = /^\s*(?:●|•|-|\u2013|\*)\s+(.+)$/;
const _BULLET_START_OPTIONAL_O = /^\s*o\s+(.+)$/;

const JUNK_URL = /https?:\/\//i;
const JUNK_WWW = /^www\./i;
const JUNK_CITATION = /^\s*(?:source:|citation|ref\.?)\s*[:.]/i;

function normalizeForMatch(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function lineMatchesSectionTitle(line: string, sectionTitleSet: Set<string>): string | null {
  const t = normalizeForMatch(line);
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const title of sectionTitleSet) {
    if (title.toLowerCase() === lower) return title;
  }
  return null;
}

function lineHasMarker(line: string): boolean {
  const lower = (line ?? "").toLowerCase();
  return MARKER_PHRASES.some((m) => lower.includes(m));
}

function isBulletLine(line: string): { text: string } | null {
  const m = line.match(BULLET_START);
  if (m) return { text: normalizeForMatch(m[1]) };
  return null;
}

function isJunk(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < MIN_BULLET_TEXT_LENGTH) return true;
  if (JUNK_URL.test(t) || JUNK_WWW.test(t)) return true;
  if (JUNK_CITATION.test(t)) return true;
  return false;
}

function isIndentedContinuation(line: string): boolean {
  const trimmed = (line ?? "").trim();
  if (!trimmed) return false;
  return (line ?? "").match(/^\s{2,}\S/) != null;
}

/**
 * Extract vitals anchored to section headers: scan fullText by line, track current section,
 * when a marker phrase is seen capture bullets until stop condition. Dedupe and cap per section.
 */
export function extractVitalsAnchoredToSections(
  fullText: string,
  sectionTitles: string[]
): RawVital[] {
  const sectionTitleSet = new Set(sectionTitles.map((t) => normalizeForMatch(t)).filter(Boolean));
  const lines = (fullText ?? "").split(/\r?\n/);
  const raw: RawVital[] = [];
  let currentSectionTitle: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const t = line.trim();

    const matchedSection = lineMatchesSectionTitle(t, sectionTitleSet);
    if (matchedSection != null) {
      currentSectionTitle = matchedSection;
      continue;
    }

    if (currentSectionTitle == null) continue;

    if (lineHasMarker(t)) {
      let blankCount = 0;
      const windowEnd = Math.min(i + MAX_BULLET_WINDOW_LINES, lines.length);
      for (let j = i + 1; j < windowEnd; j++) {
        const cur = lines[j] ?? "";
        const curTrim = cur.trim();

        if (curTrim === "") {
          blankCount++;
          if (blankCount >= BLANK_LINES_STOP) break;
          continue;
        }
        blankCount = 0;

        if (lineMatchesSectionTitle(curTrim, sectionTitleSet) != null) break;

        const bullet = isBulletLine(cur);
        if (bullet) {
          let bulletText = bullet.text;
          let k = j + 1;
          while (k < windowEnd) {
            const nxt = lines[k] ?? "";
            if (nxt.trim() === "") break;
            if (lineMatchesSectionTitle(nxt.trim(), sectionTitleSet) != null) break;
            if (isBulletLine(nxt)) break;
            if (isIndentedContinuation(nxt)) {
              bulletText = normalizeForMatch(bulletText + " " + nxt.trim());
              k++;
            } else break;
          }
          j = k - 1;
          if (!isJunk(bulletText)) {
            raw.push({
              section_title: currentSectionTitle,
              text: bulletText,
              marker: "marker",
            });
          }
          continue;
        }
      }
    }
  }

  // Dedupe per section by lowercased text; cap per section
  const bySection = new Map<string, string[]>();
  const seenPerSection = new Map<string, Set<string>>();
  for (const v of raw) {
    const key = v.text.toLowerCase();
    let seen = seenPerSection.get(v.section_title);
    if (!seen) {
      seen = new Set();
      seenPerSection.set(v.section_title, seen);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const arr = bySection.get(v.section_title) ?? [];
    if (arr.length < MAX_BULLETS_PER_SECTION) arr.push(v.text);
    bySection.set(v.section_title, arr);
  }

  const result: RawVital[] = [];
  for (const [section_title, texts] of bySection.entries()) {
    for (const text of texts) {
      result.push({ section_title, text, marker: "marker" });
    }
  }
  return result;
}

/** Result of extraction with diagnostic counts for preflight. */
export interface AnchoredVitalsResult {
  rawVitals: RawVital[];
  vitalsBySectionTitle: Map<string, string[]>;
  sectionsFoundInText: number;
  markersFound: number;
  bulletsCaptured: number;
}

/**
 * Run section-anchored extraction and return vitals map + diagnostic counts.
 * sectionTitles = list of section titles (e.g. from TOC); we count how many appear in fullText.
 */
export function extractVitalsAnchoredToSectionsWithDiagnostics(
  fullText: string,
  sectionTitles: string[]
): AnchoredVitalsResult {
  const sectionTitleSet = new Set(sectionTitles.map((t) => (t ?? "").trim().replace(/\s+/g, " ")).filter(Boolean));
  const lines = (fullText ?? "").split(/\r?\n/);
  const raw: RawVital[] = [];
  let currentSectionTitle: string | null = null;
  let sectionsFoundInText = 0;
  const sectionsSeen = new Set<string>();
  let markersFound = 0;
  let bulletsCaptured = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const t = line.trim();

    const matchedSection = lineMatchesSectionTitle(t, sectionTitleSet);
    if (matchedSection != null) {
      currentSectionTitle = matchedSection;
      if (!sectionsSeen.has(matchedSection)) {
        sectionsSeen.add(matchedSection);
        sectionsFoundInText++;
      }
      continue;
    }

    if (currentSectionTitle == null) continue;

    if (lineHasMarker(t)) {
      markersFound++;
      let blankCount = 0;
      const windowEnd = Math.min(i + MAX_BULLET_WINDOW_LINES, lines.length);
      for (let j = i + 1; j < windowEnd; j++) {
        const cur = lines[j] ?? "";
        const curTrim = cur.trim();

        if (curTrim === "") {
          blankCount++;
          if (blankCount >= BLANK_LINES_STOP) break;
          continue;
        }
        blankCount = 0;

        if (lineMatchesSectionTitle(curTrim, sectionTitleSet) != null) break;

        const bullet = isBulletLine(cur);
        if (bullet) {
          let bulletText = bullet.text;
          let k = j + 1;
          while (k < windowEnd) {
            const nxt = lines[k] ?? "";
            if (nxt.trim() === "") break;
            if (lineMatchesSectionTitle(nxt.trim(), sectionTitleSet) != null) break;
            if (isBulletLine(nxt)) break;
            if (isIndentedContinuation(nxt)) {
              bulletText = normalizeForMatch(bulletText + " " + nxt.trim());
              k++;
            } else break;
          }
          j = k - 1;
          if (!isJunk(bulletText)) {
            bulletsCaptured++;
            raw.push({
              section_title: currentSectionTitle,
              text: bulletText,
              marker: "marker",
            });
          }
          continue;
        }
      }
    }
  }

  const bySection = new Map<string, string[]>();
  const seenPerSection = new Map<string, Set<string>>();
  for (const v of raw) {
    const key = v.text.toLowerCase();
    let seen = seenPerSection.get(v.section_title);
    if (!seen) {
      seen = new Set();
      seenPerSection.set(v.section_title, seen);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const arr = bySection.get(v.section_title) ?? [];
    if (arr.length < MAX_BULLETS_PER_SECTION) arr.push(v.text);
    bySection.set(v.section_title, arr);
  }

  return {
    rawVitals: raw,
    vitalsBySectionTitle: bySection,
    sectionsFoundInText,
    markersFound,
    bulletsCaptured,
  };
}

/**
 * Bullet-only pass: capture bullets under section headers without requiring a marker phrase.
 * Use when markers_found === 0 to improve coverage. Same window and dedupe rules.
 */
export function extractBulletsOnlyAnchoredToSections(
  fullText: string,
  sectionTitles: string[]
): Map<string, string[]> {
  const sectionTitleSet = new Set(sectionTitles.map((t) => normalizeForMatch(t)).filter(Boolean));
  const lines = (fullText ?? "").split(/\r?\n/);
  const bySection = new Map<string, string[]>();
  const seenPerSection = new Map<string, Set<string>>();
  let currentSectionTitle: string | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const t = line.trim();

    const matchedSection = lineMatchesSectionTitle(t, sectionTitleSet);
    if (matchedSection != null) {
      currentSectionTitle = matchedSection;
      i++;
      continue;
    }

    if (currentSectionTitle == null) {
      i++;
      continue;
    }

    const bullet = isBulletLine(line);
    if (bullet) {
      let bulletText = bullet.text;
      let k = i + 1;
      const windowEnd = Math.min(i + 25, lines.length);
      while (k < windowEnd) {
        const nxt = lines[k] ?? "";
        if (nxt.trim() === "") break;
        if (lineMatchesSectionTitle(nxt.trim(), sectionTitleSet) != null) break;
        if (isBulletLine(nxt)) break;
        if (isIndentedContinuation(nxt)) {
          bulletText = normalizeForMatch(bulletText + " " + nxt.trim());
          k++;
        } else break;
      }
      if (!isJunk(bulletText)) {
        const key = bulletText.toLowerCase();
        let seen = seenPerSection.get(currentSectionTitle);
        if (!seen) {
          seen = new Set();
          seenPerSection.set(currentSectionTitle, seen);
        }
        if (!seen.has(key)) {
          seen.add(key);
          const arr = bySection.get(currentSectionTitle) ?? [];
          if (arr.length < MAX_BULLETS_PER_SECTION) {
            arr.push(bulletText);
            bySection.set(currentSectionTitle, arr);
          }
        }
      }
      i = k;
      continue;
    }
    i++;
  }

  return bySection;
}
