/**
 * Validate extracted plan sections: reject too few, scenario phrasing, unstripped dot leaders.
 */

export function validateElements(elements: Array<{ title: string }>): string[] {
  const errs: string[] = [];
  if (!elements || elements.length < 6) errs.push("TOO_FEW_ELEMENTS");
  for (const e of elements || []) {
    const t = (e.title || "").toLowerCase();
    if (t.includes("what to do") || t.includes("should you")) errs.push(`SCENARIO_NOT_ALLOWED: ${e.title}`);
    if (/\.+\s*\d+\s*$/.test(e.title ?? "")) errs.push(`DOT_LEADERS_NOT_STRIPPED: ${e.title}`);
  }
  return errs;
}
