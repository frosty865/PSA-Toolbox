/**
 * TOC-based section extraction for plan checklist (authoritative scaffold).
 * When source text contains a numbered Table of Contents (1.–12.), use it so
 * required_elements cannot omit TOC-defined major sections (e.g. CISA section 6 Evacuation).
 */

/** Match numbered TOC line: optional whitespace, number 1-12, period, space, title (capitals/numbers/punctuation). */
const NUMBERED_TOC_LINE = /^\s*(\d{1,2})\.\s+(.+?)\s*$/;

const MIN_SECTION = 1;
const MAX_SECTION = 12;

/**
 * Extract numbered TOC section titles from concatenated chunk text.
 * - Finds lines matching "N. TITLE" (N 1–12).
 * - Deduplicates by section number (keeps first occurrence).
 * - Returns titles sorted by section number; normalizes whitespace in title.
 */
export function extractTocNumberedSections(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const byNum = new Map<number, string>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const m = line.match(NUMBERED_TOC_LINE);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (num < MIN_SECTION || num > MAX_SECTION) continue;
    const title = m[2].replace(/\s+/g, " ").trim();
    if (!title) continue;
    if (!byNum.has(num)) byNum.set(num, title);
  }

  const out: string[] = [];
  for (let n = MIN_SECTION; n <= MAX_SECTION; n++) {
    const t = byNum.get(n);
    if (t) out.push(t);
  }
  return out;
}

/** True if text contains "TABLE OF CONTENTS" and a line with "6." and "EVACUATION" (case-insensitive). */
export function sourceHasTableOfContentsAndSection6Evacuation(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const upper = text.toUpperCase();
  if (!upper.includes("TABLE OF CONTENTS")) return false;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^\s*6\.\s+/i.test(trimmed)) continue;
    if (/evacuation/i.test(trimmed)) return true;
  }
  return false;
}

/** True if any checklist item text contains "evacuation" (case-insensitive). */
export function checklistIncludesEvacuation(
  checklistItems: Array<{ text?: string }>
): boolean {
  if (!Array.isArray(checklistItems)) return false;
  return checklistItems.some(
    (item) => typeof item.text === "string" && /evacuation/i.test(item.text)
  );
}
