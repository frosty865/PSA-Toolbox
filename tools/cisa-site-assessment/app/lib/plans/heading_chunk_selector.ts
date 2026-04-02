/**
 * Select heading-rich chunks for plan section extraction (TOC, dot leaders, numbered headings).
 * When any chunk contains "Table of Contents", only chunks with TOC signals are used.
 */

const TOC_SIGNAL = /table of contents/i;
const DOT_LEADERS = /\.{4,}/;
const PAGE_NUM_AT_END = /\d+\s*$/m;
const NUMBERED_SECTION = /\n\s*\d+\.\s+[A-Z]/;
const NUMBERED_SECTION_ALT = /\n\s*\d+\s+[A-Z]/;
const LEADING_NUMBERED = /^\d+\.\s+/m;

function hasTocSignal(text: string): boolean {
  return TOC_SIGNAL.test(text) || DOT_LEADERS.test(text) || PAGE_NUM_AT_END.test(text);
}

function scoreChunk(text: string): number {
  let score = 0;
  if (TOC_SIGNAL.test(text)) score += 50;
  if (DOT_LEADERS.test(text)) score += 25;
  if (PAGE_NUM_AT_END.test(text)) score += 20;
  if (NUMBERED_SECTION.test(text)) score += 20;
  if (NUMBERED_SECTION_ALT.test(text)) score += 10;
  if (LEADING_NUMBERED.test(text)) score += 10;
  return score;
}

export function pickHeadingChunks(
  chunks: Array<{ id: string; text: string }>,
  max = 25
): Array<{ id: string; text: string }> {
  const list = chunks ?? [];
  const anyHasToc = list.some((c) => TOC_SIGNAL.test(c.text ?? ""));
  const candidate =
    anyHasToc
      ? list.filter((c) => hasTocSignal(c.text ?? ""))
      : list;

  const scored = candidate.map((c) => {
    const score = scoreChunk(c.text ?? "");
    return { c, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.c);
}
